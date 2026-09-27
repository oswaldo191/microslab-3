import { createHash } from 'node:crypto';
import { assertPermission } from '../access/permissions.js';
import { writeAudit } from '../audit/audit-writer.js';
import { toSessionSettings, type TenantContext } from '../context/request-context.js';
import type { TenantDatabase } from '../database/sql.js';
import { DomainError } from '../errors/domain-error.js';
import { enqueueEvents } from '../events/outbox.js';
import { assertModuleEnabled } from '../modules/module-registry.js';
import type { CommandContext, CommandDefinition } from './command.js';
import { stableStringify } from './stable-json.js';

export interface ExecuteOptions {
  /** Evita ejecutar dos veces la misma petición (doble clic, reintento de red). */
  readonly idempotencyKey?: string;
  readonly reason?: string;
}

const MIN_REASON_LENGTH = 5;

/**
 * Tubería única de escritura:
 *   módulo habilitado → permiso → motivo → validación →
 *   [transacción con RLS: idempotencia → manejador → auditoría → outbox] → resultado
 * Si cualquier paso falla dentro de la transacción, no queda ni el cambio, ni la auditoría, ni el evento.
 */
export class CommandBus {
  constructor(private readonly db: TenantDatabase) {}

  async execute<I, O>(
    command: CommandDefinition<I, O>,
    rawInput: unknown,
    ctx: TenantContext,
    options: ExecuteOptions = {},
  ): Promise<O> {
    assertModuleEnabled(ctx, command.module);
    assertPermission(ctx, command.permission);

    const reason = options.reason?.trim();
    if (command.requiresReason && (!reason || reason.length < MIN_REASON_LENGTH)) {
      throw new DomainError('REASON_REQUIRED', 'Esta acción requiere un motivo', [
        {
          field: 'reason',
          message: `Escriba un motivo de al menos ${MIN_REASON_LENGTH} caracteres`,
        },
      ]);
    }

    const input = command.parse(rawInput);
    const commandCtx: CommandContext = reason ? { ...ctx, reason } : ctx;
    const requestHash = createHash('sha256')
      .update(stableStringify({ command: command.name, input }))
      .digest('hex');

    try {
      return await this.db.transaction(toSessionSettings(ctx), async (tx) => {
        if (options.idempotencyKey) {
          const previous = await tx.query<{ request_hash: string; response: O }>(
            'SELECT request_hash, response FROM kernel.idempotency_keys WHERE key = $1',
            [options.idempotencyKey],
          );
          const hit = previous.rows[0];
          if (hit) {
            if (hit.request_hash !== requestHash) {
              throw new DomainError(
                'IDEMPOTENCY_MISMATCH',
                'La clave de idempotencia ya se usó con otra petición',
              );
            }
            return hit.response; // repetición: se devuelve el mismo resultado sin ejecutar de nuevo
          }
        }

        const outcome = await command.handle(tx, input, commandCtx);

        for (const entry of outcome.audit) {
          await writeAudit(tx, ctx, {
            ...entry,
            module: entry.module ?? command.module,
            ...(reason ? { reason: entry.reason ?? reason } : {}),
          });
        }
        await enqueueEvents(tx, ctx, outcome.events ?? []);

        if (options.idempotencyKey) {
          await tx.query(
            `INSERT INTO kernel.idempotency_keys (key, command, request_hash, response)
             VALUES ($1, $2, $3, $4)`,
            [
              options.idempotencyKey,
              command.name,
              requestHash,
              JSON.stringify(outcome.result ?? null),
            ],
          );
        }
        return outcome.result;
      });
    } catch (error) {
      throw translateDatabaseError(error);
    }
  }
}

/** Traduce errores de PostgreSQL a errores de dominio con mensajes comprensibles. */
export function translateDatabaseError(error: unknown): unknown {
  if (error instanceof DomainError) return error;
  const code = (error as { code?: unknown })?.code;
  switch (code) {
    case '23505':
      return new DomainError('CONFLICT', 'Ya existe un registro con esos datos');
    case '23503':
      return new DomainError(
        'VALIDATION_FAILED',
        'Hace referencia a un registro que no existe en este laboratorio',
      );
    case '42501':
      return new DomainError(
        'PERMISSION_DENIED',
        'La operación no está permitida para este laboratorio o sucursal',
      );
    case '40001':
      return new DomainError(
        'CONFLICT',
        'Otro usuario modificó los mismos datos; intente de nuevo',
      );
    default:
      return error;
  }
}
