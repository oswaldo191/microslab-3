import type { TenantContext } from '../context/request-context.js';
import type { SqlClient } from '../database/sql.js';

/**
 * Evento de dominio. Solo lleva identificadores y datos mínimos (nunca datos clínicos completos):
 * quien lo escucha consulta lo que necesita con sus propios permisos.
 */
export interface DomainEventDraft {
  /** `<módulo>.<NombreEnPasado>`, p. ej. `configuration.BranchCreated`. */
  readonly type: `${string}.${string}`;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload?: Readonly<Record<string, string | number | boolean | null>>;
}

const EVENT_TYPE = /^[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]+$/;
const MAX_PAYLOAD_BYTES = 2048;

export function assertValidEvent(event: DomainEventDraft): void {
  if (!EVENT_TYPE.test(event.type)) {
    throw new Error(`Evento inválido "${event.type}": use <módulo>.<NombreEnPasado>`);
  }
  const size = Buffer.byteLength(JSON.stringify(event.payload ?? {}));
  if (size > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Evento "${event.type}" demasiado grande (${size} bytes): envíe identificadores, no datos`,
    );
  }
}

/** Guarda los eventos en el outbox dentro de la transacción del comando. */
export async function enqueueEvents(
  tx: SqlClient,
  ctx: TenantContext,
  events: readonly DomainEventDraft[],
): Promise<void> {
  for (const event of events) {
    assertValidEvent(event);
    await tx.query(
      `INSERT INTO kernel.outbox_events (laboratory_id, event_type, aggregate_type, aggregate_id, payload, request_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ctx.laboratoryId,
        event.type,
        event.aggregateType,
        event.aggregateId,
        JSON.stringify(event.payload ?? {}),
        ctx.requestId,
      ],
    );
  }
}
