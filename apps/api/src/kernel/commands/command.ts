import type { ModuleKey } from '@microslab/contracts';
import type { AuditDraft } from '../audit/audit-writer.js';
import type { TenantContext } from '../context/request-context.js';
import type { SqlClient } from '../database/sql.js';
import type { DomainEventDraft } from '../events/outbox.js';

/** Contexto que recibe el manejador: el de la petición más el motivo, si se dio. */
export interface CommandContext extends TenantContext {
  readonly reason?: string;
}

export type CommandAudit = Omit<AuditDraft, 'module'> & { readonly module?: string };

export interface CommandOutcome<O> {
  readonly result: O;
  /** Todo comando que escribe declara al menos un evento de auditoría. */
  readonly audit: readonly [CommandAudit, ...CommandAudit[]];
  readonly events?: readonly DomainEventDraft[];
}

/**
 * Un comando es la ÚNICA forma de cambiar datos. La interfaz, la voz, la IA, los equipos
 * y la API pública ejecutan estas mismas definiciones, con los mismos permisos y auditoría.
 */
export interface CommandDefinition<I, O> {
  /** Nombre estable: `<módulo>.<recurso>.<acción>`. */
  readonly name: string;
  readonly module: ModuleKey;
  readonly permission: string;
  /** Si es true, el comando no se ejecuta sin un motivo escrito. */
  readonly requiresReason?: boolean;
  /** Valida y normaliza la entrada; lanza DomainError('VALIDATION_FAILED') si no sirve. */
  parse(input: unknown): I;
  handle(tx: SqlClient, input: I, ctx: CommandContext): Promise<CommandOutcome<O>>;
}

export function defineCommand<I, O>(definition: CommandDefinition<I, O>): CommandDefinition<I, O> {
  return definition;
}
