import { MODULES, type ModuleKey } from '@microslab/contracts';
import type { TenantContext } from '../context/request-context.js';
import { DomainError } from '../errors/domain-error.js';

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function isModuleKey(key: string): key is ModuleKey {
  return BY_KEY.has(key as ModuleKey);
}

/**
 * Un módulo está disponible si es fundamental (no depende del plan) o si el plan del
 * laboratorio lo incluye. Los módulos clínicos fundamentales nunca se apagan por un plan.
 */
export function isModuleEnabled(ctx: TenantContext, key: ModuleKey): boolean {
  const mod = BY_KEY.get(key);
  if (!mod) return false;
  return !mod.planGated || ctx.enabledModules.has(key);
}

export function assertModuleEnabled(ctx: TenantContext, key: ModuleKey): void {
  if (!isModuleEnabled(ctx, key)) {
    throw new DomainError('MODULE_DISABLED', `El módulo "${key}" no está habilitado en el plan de este laboratorio`);
  }
}
