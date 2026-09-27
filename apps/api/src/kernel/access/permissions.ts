import type { TenantContext } from '../context/request-context.js';
import { DomainError } from '../errors/domain-error.js';

export function hasPermission(ctx: TenantContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}

/** Se verifica en el backend en cada comando; ocultar botones en la interfaz es solo comodidad. */
export function assertPermission(ctx: TenantContext, permission: string): void {
  if (!hasPermission(ctx, permission)) {
    throw new DomainError('PERMISSION_DENIED', `No tiene el permiso "${permission}"`);
  }
}
