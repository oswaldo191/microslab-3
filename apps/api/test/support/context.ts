import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../src/kernel/index.js';

export const LAB_A = '00000000-0000-7000-8000-00000000000a';
export const LAB_B = '00000000-0000-7000-8000-00000000000b';
export const ADMIN_A = '00000000-0000-7000-8000-0000000000aa';
export const ADMIN_B = '00000000-0000-7000-8000-0000000000bb';

export function tenantContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    laboratoryId: LAB_A,
    branchIds: [],
    allBranches: true,
    actor: { type: 'user', id: ADMIN_A },
    permissions: new Set(['configuration.branches.create', 'configuration.branches.view']),
    enabledModules: new Set(),
    requestId: randomUUID(),
    ip: '127.0.0.1',
    userAgent: 'pruebas',
    ...overrides,
  };
}
