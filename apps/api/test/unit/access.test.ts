/**
 * F1.3 — Autorización desde la base (pruebas unitarias, sin PostgreSQL).
 * Diseño: docs/f1/F1_2_AUTHZ.md y ADR 0031.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '@microslab/contracts';
import {
  AccessResolver,
  assertLaboratoryAvailable,
  assertTokenLaboratory,
  buildTenantContext,
  CommandBus,
  defineCommand,
  DomainError,
  FOUNDATIONAL_MODULES,
  identityFromClaims,
  isModuleEnabled,
  staticModuleEnablement,
  type SessionSettings,
  type SqlClient,
  type TenantDatabase,
} from '../../src/kernel/index.js';
import { ALL_MODULES } from '../../src/modules/index.js';
import { ADMIN_A, LAB_A, LAB_B } from '../support/context.js';

const SID = '00000000-0000-7000-8000-00000000005d';

/** Base falsa: registra lo que se ejecuta y devuelve una fila fija. */
function fakeDb(row: Record<string, unknown> | undefined) {
  const calls: { settings: SessionSettings; statements: string[] }[] = [];
  const db: TenantDatabase = {
    async transaction(settings, work) {
      const statements: string[] = [];
      calls.push({ settings, statements });
      const tx: SqlClient = {
        async query<R>(text: string) {
          statements.push(text.trim());
          const rows = (/^SET\b/.test(text.trim()) || !row ? [] : [row]) as R[];
          return { rows, rowCount: rows.length };
        },
      };
      return work(tx);
    },
  };
  return { db, calls };
}

const activeRow = {
  user_status: 'active',
  permissions: ['configuration.branches.create', 'configuration.branches.view'],
  all_branches: false,
  branch_ids: ['00000000-0000-7000-8000-0000000000a1'],
};
const labActive = { id: LAB_A, status: 'active' };
const identityA = { userId: ADMIN_A, tokenLaboratoryId: LAB_A };

const codeOf = (code: string) => (e: unknown) => {
  assert.ok(e instanceof DomainError);
  assert.equal(e.code, code);
  return true;
};

// --- Identidad: el token solo identifica -------------------------------------------------

test('un token con permisos inflados solo aporta identidad (sub, lab, sid)', () => {
  const identity = identityFromClaims({
    sub: ADMIN_A,
    lab: LAB_A,
    sid: SID,
    perms: ['*', 'security.admin.bootstrap'],
    modules: ['inventory', 'ai'],
    branches: ['00000000-0000-7000-8000-0000000000b1'],
    allBranches: true,
    roles: ['lab_admin'],
  });
  assert.deepEqual(identity, { userId: ADMIN_A, tokenLaboratoryId: LAB_A, sessionId: SID });
});

test('un token sin permisos ni módulos es válido: la autorización no depende de él', () => {
  assert.deepEqual(identityFromClaims({ sub: ADMIN_A, lab: LAB_A }), identityA);
});

test('sin sub o lab válidos, o con sid mal formado: 401 TOKEN_INVALID', () => {
  for (const claims of [
    { lab: LAB_A },
    { sub: ADMIN_A },
    { sub: 'no-uuid', lab: LAB_A },
    { sub: ADMIN_A, lab: 42 },
    { sub: ADMIN_A, lab: LAB_A, sid: 'x' },
  ]) {
    assert.throws(() => identityFromClaims(claims), codeOf('TOKEN_INVALID'));
  }
});

test('lab del token distinto al laboratorio del host: 401 TOKEN_INVALID', () => {
  assert.doesNotThrow(() => assertTokenLaboratory(identityA, LAB_A));
  assert.throws(() => assertTokenLaboratory(identityA, LAB_B), codeOf('TOKEN_INVALID'));
});

test('semántica HTTP de los códigos nuevos: 401 sin autenticación, 403 laboratorio no disponible', () => {
  const status = (code: ConstructorParameters<typeof DomainError>[0]) =>
    new DomainError(code, '').httpStatus;
  assert.equal(status('UNAUTHENTICATED'), 401);
  assert.equal(status('TOKEN_INVALID'), 401);
  assert.equal(status('TOKEN_EXPIRED'), 401);
  assert.equal(status('SESSION_REVOKED'), 401);
  assert.equal(status('LABORATORY_UNAVAILABLE'), 403);
  assert.equal(status('PERMISSION_DENIED'), 403);
});

// --- Estado del laboratorio (decisión M) --------------------------------------------------

test('laboratorio onboarding o active: permitido; suspended, closed o desconocido: 403', () => {
  for (const status of ['onboarding', 'active'])
    assert.doesNotThrow(() => assertLaboratoryAvailable({ id: LAB_A, status }));
  for (const status of ['suspended', 'closed', 'otro', ''])
    assert.throws(
      () => assertLaboratoryAvailable({ id: LAB_A, status }),
      codeOf('LABORATORY_UNAVAILABLE'),
    );
});

// --- Resolución desde la base ------------------------------------------------------------

test('la resolución usa una transacción de solo lectura con el laboratorio del host y sin sucursales', async () => {
  const { db, calls } = fakeDb(activeRow);
  await new AccessResolver(db).resolve({
    laboratory: labActive,
    identity: identityA,
    requestId: 'req-1',
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.settings, {
    'app.laboratory_id': LAB_A,
    'app.branch_ids': '',
    'app.all_branches': 'false',
    'app.actor_type': 'user',
    'app.actor_id': ADMIN_A,
    'app.request_id': 'req-1',
  });
  assert.equal(calls[0]!.statements[0], 'SET TRANSACTION READ ONLY');
  assert.equal(calls[0]!.statements.length, 2);
});

test('permisos, sucursales y all_branches salen de la fila de la base', async () => {
  const { db } = fakeDb({ ...activeRow, all_branches: true });
  const access = await new AccessResolver(db).resolve({
    laboratory: labActive,
    identity: identityA,
    requestId: 'r',
  });
  assert.deepEqual([...access.permissions], activeRow.permissions);
  assert.deepEqual(access.branchIds, activeRow.branch_ids);
  assert.equal(access.allBranches, true);
});

test('usuario sin roles ni sucursales: autenticado, sin permisos', async () => {
  const { db } = fakeDb({
    user_status: 'active',
    permissions: null,
    all_branches: null,
    branch_ids: null,
  });
  const access = await new AccessResolver(db).resolve({
    laboratory: labActive,
    identity: identityA,
    requestId: 'r',
  });
  assert.equal(access.permissions.size, 0);
  assert.deepEqual(access.branchIds, []);
  assert.equal(access.allBranches, false);
});

test('usuario inexistente, invited, locked o inactive: 401 SESSION_REVOKED', async () => {
  const rows = [
    undefined,
    ...['invited', 'locked', 'inactive'].map((s) => ({ ...activeRow, user_status: s })),
  ];
  for (const row of rows) {
    const { db } = fakeDb(row);
    await assert.rejects(
      new AccessResolver(db).resolve({
        laboratory: labActive,
        identity: identityA,
        requestId: 'r',
      }),
      codeOf('SESSION_REVOKED'),
    );
  }
});

test('laboratorio suspendido o cerrado: 403 LABORATORY_UNAVAILABLE aunque el usuario esté activo', async () => {
  for (const status of ['suspended', 'closed']) {
    const { db } = fakeDb(activeRow);
    await assert.rejects(
      new AccessResolver(db).resolve({
        laboratory: { id: LAB_A, status },
        identity: identityA,
        requestId: 'r',
      }),
      codeOf('LABORATORY_UNAVAILABLE'),
    );
  }
});

// --- Contexto final ----------------------------------------------------------------------

test('el TenantContext toma laboratorio del host, actor del sub y autorización de la base', () => {
  const inflated = identityFromClaims({
    sub: ADMIN_A,
    lab: LAB_A,
    perms: ['*'],
    allBranches: true,
    branches: ['00000000-0000-7000-8000-0000000000b1'],
  });
  const ctx = buildTenantContext({
    laboratoryId: LAB_A,
    identity: inflated,
    access: {
      permissions: new Set(['configuration.branches.view']),
      branchIds: [],
      allBranches: false,
    },
    enabledModules: new Set(),
    requestId: 'r',
  });
  assert.equal(ctx.laboratoryId, LAB_A);
  assert.deepEqual(ctx.actor, { type: 'user', id: ADMIN_A });
  assert.deepEqual([...ctx.permissions], ['configuration.branches.view']);
  assert.deepEqual(ctx.branchIds, []);
  assert.equal(ctx.allBranches, false);
  assert.equal(ctx.enabledModules.size, 0);
});

// --- Habilitación de módulos en F1 (decisión L) -------------------------------------------

test('proveedor estático de F1: ningún módulo de plan habilitado', async () => {
  const enabled = await staticModuleEnablement.enabledModules(LAB_A);
  assert.equal(enabled.size, 0);
});

test('security, configuration y audit siempre están habilitados; un módulo de plan no, aunque haya permiso', async () => {
  const ctx = buildTenantContext({
    laboratoryId: LAB_A,
    identity: identityA,
    access: { permissions: new Set(['inventory.items.create']), branchIds: [], allBranches: true },
    enabledModules: await staticModuleEnablement.enabledModules(LAB_A),
    requestId: 'r',
  });
  for (const key of ['security', 'configuration', 'audit'] as const)
    assert.ok(isModuleEnabled(ctx, key), `${key} debe estar habilitado`);
  assert.equal(isModuleEnabled(ctx, 'inventory'), false);

  let opened = false;
  const bus = new CommandBus({
    transaction: async () => {
      opened = true;
      throw new Error('no debe abrirse');
    },
  });
  const planCommand = defineCommand({
    name: 'inventory.items.create',
    module: 'inventory',
    permission: 'inventory.items.create',
    parse: () => null,
    handle: async () => ({ result: null, audit: [{ action: 'items.create' }] }),
  });
  await assert.rejects(bus.execute(planCommand, {}, ctx), codeOf('MODULE_DISABLED'));
  assert.equal(opened, false);
});

test('decisión L: todo comando registrado pertenece a un módulo con planGated: false', () => {
  const planGated = new Set<string>(MODULES.filter((m) => m.planGated).map((m) => m.key));
  for (const mod of ALL_MODULES) {
    for (const command of mod.commands) {
      assert.ok(
        FOUNDATIONAL_MODULES.has(command.module) && !planGated.has(command.module),
        `El comando ${command.name} pertenece al módulo de plan "${command.module}"`,
      );
    }
  }
});
