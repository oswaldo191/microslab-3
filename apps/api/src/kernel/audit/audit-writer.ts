import type { TenantContext } from '../context/request-context.js';
import type { SqlClient } from '../database/sql.js';

/** Lo que un comando declara para la auditoría. El resto (quién, dónde, cuándo) sale del contexto. */
export interface AuditDraft {
  readonly module: string;
  readonly action: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
  readonly reason?: string;
}

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|mfa|otp|signature_image/i;

/** Quita secretos antes de guardar el "antes" y el "después". Recursivo para objetos anidados. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? '[protegido]' : redact(v),
      ]),
    );
  }
  return value;
}

/**
 * Escribe un evento de auditoría en la MISMA transacción del cambio.
 * La base de datos encadena la huella y rechaza cualquier modificación posterior.
 */
export async function writeAudit(
  tx: SqlClient,
  ctx: TenantContext,
  draft: AuditDraft,
): Promise<void> {
  await tx.query(
    `INSERT INTO audit.audit_events
       (laboratory_id, branch_id, actor_type, actor_id, module, action, entity_type, entity_id,
        before_data, after_data, reason, request_id, ip, user_agent, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      ctx.laboratoryId,
      ctx.activeBranchId ?? null,
      ctx.actor.type,
      ctx.actor.id,
      draft.module,
      draft.action,
      draft.entityType ?? null,
      draft.entityId ?? null,
      draft.before ? JSON.stringify(redact(draft.before)) : null,
      draft.after ? JSON.stringify(redact(draft.after)) : null,
      draft.reason ?? null,
      ctx.requestId,
      ctx.ip ?? null,
      ctx.userAgent ?? null,
      ctx.deviceId ?? null,
    ],
  );
}
