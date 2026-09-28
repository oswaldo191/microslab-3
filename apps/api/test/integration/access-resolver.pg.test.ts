/**
 * F1.3 — Autorización desde la base contra PostgreSQL real.
 * Cada petición resuelve permisos, sucursales y `all_branches` en la base; el token solo identifica.
 *
 * Requiere la base de pruebas de infra/db/tests/run.sh (con los laboratorios C, D y E de
 * fixtures.sql) y TEST_DATABASE_URL_APP. Si no está definida, la prueba se omite.
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  AccessResolver,
  assertTokenLaboratory,
  buildTenantContext,
  CommandBus,
  DomainError,
  identityFromClaims,
  PgTenantDatabase,
  staticModuleEnablement,
  toSessionSettings,
  type ResolvedLaboratory,
  type SessionSettings,
  type TenantContext,
} from '../../src/kernel/index.js';
import { createBranch } from '../../src/modules/configuration/index.js';
import { ADMIN_A, ADMIN_B, LAB_A, LAB_B, tenantContext } from '../support/context.js';
import { PsqlPool } from '../support/psql-pool.js';

const APP_URL = process.env.TEST_DATABASE_URL_APP;
const skip = !APP_URL ? 'falta TEST_DATABASE_URL_APP' : false;

const BRANCH_A1 = '00000000-0000-7000-8000-0000000000a1';
const BRANCH_A2 = '00000000-0000-7000-8000-0000000000a2';
const BRANCH_B1 = '00000000-0000-7000-8000-0000000000b1';

const codeOf = (code: string) => (e: unknown) => {
  assert.ok(e instanceof DomainError, `se esperaba DomainError ${code}, llegó ${String(e)}`);
  assert.equal(e.code, code);
  return true;
};

describe('autorización desde la base (F1.3)', { skip }, () => {
  let db: PgTenantDatabase;
  let resolver: AccessResolver;
  let bus: CommandBus;
  const labs = new Map<string, ResolvedLaboratory>();
  const s = Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, '0');

  // Usuarios de prueba en el laboratorio A.
  const U = {
    multiRole: randomUUID(),
    allBranches: randomUUID(),
    oneBranch: randomUUID(),
    noRoles: randomUUID(),
    inactiveRole: randomUUID(),
    locked: randomUUID(),
    inactive: randomUUID(),
    invited: randomUUID(),
  };
  const R = {
    view: randomUUID(),
    create: randomUUID(),
    all: randomUUID(),
    inactive: randomUUID(),
  };

  /** Arma el contexto como lo hace el middleware: host → identidad → base → proveedor de módulos. */
  async function contextFor(
    claims: Record<string, unknown>,
    subdomain = 'lab-a',
  ): Promise<TenantContext> {
    const lab = labs.get(subdomain)!;
    const requestId = randomUUID();
    const identity = identityFromClaims(claims);
    assertTokenLaboratory(identity, lab.id);
    const access = await resolver.resolve({ laboratory: lab, identity, requestId });
    return buildTenantContext({
      laboratoryId: lab.id,
      identity,
      access,
      enabledModules: await staticModuleEnablement.enabledModules(lab.id),
      requestId,
    });
  }

  const read = <R>(ctx: TenantContext, sql: string, params: unknown[] = []) =>
    db.transaction(toSessionSettings(ctx), async (tx) => (await tx.query<R>(sql, params)).rows);

  before(async () => {
    db = new PgTenantDatabase(new PsqlPool(APP_URL!));
    resolver = new AccessResolver(db);
    bus = new CommandBus(db);

    // Directorio de laboratorios, igual que lo consulta el middleware (sin contexto).
    const client = await new PsqlPool(APP_URL!).connect();
    try {
      const { rows } = await client.query<{ id: string; subdomain: string; status: string }>(
        'SELECT id, subdomain, status FROM platform.laboratory_directory',
      );
      for (const r of rows) labs.set(r.subdomain, { id: r.id, status: r.status });
    } finally {
      client.release();
    }

    // Roles, permisos y asignaciones del laboratorio A, creados como la aplicación con RLS.
    const admin: SessionSettings = toSessionSettings(tenantContext());
    await db.transaction(admin, async (tx) => {
      const users: [string, string][] = [
        [U.multiRole, 'active'],
        [U.allBranches, 'active'],
        [U.oneBranch, 'active'],
        [U.noRoles, 'active'],
        [U.inactiveRole, 'active'],
        [U.locked, 'locked'],
        [U.inactive, 'inactive'],
        [U.invited, 'invited'],
      ];
      for (const [id, status] of users) {
        await tx.query(
          `INSERT INTO app.users (id, email, full_name, status) VALUES ($1, $2, 'Prueba F1.3', $3)`,
          [id, `f13-${id}@lab-a.test`, status],
        );
      }
      const roles: [string, string, boolean, string][] = [
        [R.view, `f13_view_${s}`, false, 'active'],
        [R.create, `f13_create_${s}`, false, 'active'],
        [R.all, `f13_all_${s}`, true, 'active'],
        [R.inactive, `f13_off_${s}`, true, 'inactive'],
      ];
      for (const [id, key, all, status] of roles) {
        await tx.query(
          `INSERT INTO app.roles (id, key, name, all_branches, status) VALUES ($1, $2, $2, $3, $4)`,
          [id, key, all, status],
        );
      }
      const grants: [string, string][] = [
        [R.view, 'configuration.branches.view'],
        [R.create, 'configuration.branches.create'],
        [R.create, 'audit.events.view'],
        [R.all, 'configuration.branches.create'],
        [R.inactive, 'security.users.view'],
      ];
      for (const [role, perm] of grants) {
        await tx.query(
          `INSERT INTO app.role_permissions (role_id, permission_key) VALUES ($1, $2)`,
          [role, perm],
        );
      }
      const assignments: [string, string][] = [
        [U.multiRole, R.view],
        [U.multiRole, R.create],
        [U.allBranches, R.all],
        [U.inactiveRole, R.view],
        [U.inactiveRole, R.inactive],
        [U.locked, R.all],
        [U.inactive, R.all],
        [U.invited, R.all],
      ];
      for (const [user, role] of assignments) {
        await tx.query(`INSERT INTO app.user_roles (user_id, role_id) VALUES ($1, $2)`, [
          user,
          role,
        ]);
      }
      const branches: [string, string][] = [
        [U.multiRole, BRANCH_A1],
        [U.multiRole, BRANCH_A2],
        [U.oneBranch, BRANCH_A1],
      ];
      for (const [user, branch] of branches) {
        await tx.query(`INSERT INTO app.user_branches (user_id, branch_id) VALUES ($1, $2)`, [
          user,
          branch,
        ]);
      }
    });
  });

  test('permisos desde la base: unión de todos los roles activos', async () => {
    const ctx = await contextFor({ sub: U.multiRole, lab: LAB_A });
    assert.deepEqual([...ctx.permissions].sort(), [
      'audit.events.view',
      'configuration.branches.create',
      'configuration.branches.view',
    ]);
    assert.equal(ctx.allBranches, false);
  });

  test('un rol inactivo no aporta permisos ni all_branches', async () => {
    const ctx = await contextFor({ sub: U.inactiveRole, lab: LAB_A });
    assert.deepEqual([...ctx.permissions], ['configuration.branches.view']);
    assert.equal(ctx.allBranches, false);
  });

  test('all_branches sale del rol activo en la base', async () => {
    const ctx = await contextFor({ sub: U.allBranches, lab: LAB_A });
    assert.equal(ctx.allBranches, true);
    assert.deepEqual([...ctx.permissions], ['configuration.branches.create']);
  });

  test('sucursales específicas: exactamente las de app.user_branches', async () => {
    const one = await contextFor({ sub: U.oneBranch, lab: LAB_A });
    assert.deepEqual(one.branchIds, [BRANCH_A1]);
    assert.equal(one.allBranches, false);
    const two = await contextFor({ sub: U.multiRole, lab: LAB_A });
    assert.deepEqual([...two.branchIds].sort(), [BRANCH_A1, BRANCH_A2]);
  });

  test('usuario sin roles: autenticado, sin permisos; un comando se rechaza con 403', async () => {
    const ctx = await contextFor({ sub: U.noRoles, lab: LAB_A });
    assert.equal(ctx.permissions.size, 0);
    await assert.rejects(
      bus.execute(createBranch, { code: `N${s}`, name: 'No' }, ctx),
      codeOf('PERMISSION_DENIED'),
    );
  });

  test('usuario locked, inactive, invited o inexistente: 401 SESSION_REVOKED', async () => {
    for (const sub of [U.locked, U.inactive, U.invited, randomUUID()]) {
      await assert.rejects(contextFor({ sub, lab: LAB_A }), codeOf('SESSION_REVOKED'));
    }
  });

  test('un usuario de otro laboratorio no existe para este laboratorio (RLS)', async () => {
    await assert.rejects(contextFor({ sub: ADMIN_B, lab: LAB_A }), codeOf('SESSION_REVOKED'));
  });

  test('token de un laboratorio presentado en otro subdominio: 401 TOKEN_INVALID', async () => {
    await assert.rejects(
      contextFor({ sub: ADMIN_B, lab: LAB_B }, 'lab-a'),
      codeOf('TOKEN_INVALID'),
    );
  });

  test('laboratorio suspendido o cerrado: 403 LABORATORY_UNAVAILABLE', async () => {
    assert.equal(labs.get('lab-c')!.status, 'suspended');
    assert.equal(labs.get('lab-d')!.status, 'closed');
    await assert.rejects(
      contextFor(
        { sub: '00000000-0000-7000-8000-0000000000cc', lab: labs.get('lab-c')!.id },
        'lab-c',
      ),
      codeOf('LABORATORY_UNAVAILABLE'),
    );
    await assert.rejects(
      contextFor(
        { sub: '00000000-0000-7000-8000-0000000000dd', lab: labs.get('lab-d')!.id },
        'lab-d',
      ),
      codeOf('LABORATORY_UNAVAILABLE'),
    );
  });

  test('laboratorio en onboarding: permitido', async () => {
    assert.equal(labs.get('lab-e')!.status, 'onboarding');
    const ctx = await contextFor(
      { sub: '00000000-0000-7000-8000-0000000000ee', lab: labs.get('lab-e')!.id },
      'lab-e',
    );
    assert.equal(ctx.laboratoryId, labs.get('lab-e')!.id);
  });

  test('token con permisos inflados: no concede nada que la base no conceda', async () => {
    const ctx = await contextFor({
      sub: U.noRoles,
      lab: LAB_A,
      perms: ['*', 'configuration.branches.create'],
      modules: ['inventory'],
      branches: [BRANCH_B1],
      allBranches: true,
    });
    assert.equal(ctx.permissions.size, 0);
    assert.equal(ctx.allBranches, false);
    assert.deepEqual(ctx.branchIds, []);
    assert.equal(ctx.enabledModules.size, 0);
    await assert.rejects(
      bus.execute(createBranch, { code: `F${s}`, name: 'Inflado' }, ctx),
      codeOf('PERMISSION_DENIED'),
    );
  });

  test('token sin permisos: funciona igual; el comando se ejecuta con la autorización de la base', async () => {
    const ctx = await contextFor({ sub: U.allBranches, lab: LAB_A });
    const branch = await bus.execute(createBranch, { code: `S${s}`, name: 'Desde la base' }, ctx);
    const audit = await read<{ actor_id: string }>(
      ctx,
      'SELECT actor_id FROM audit.audit_events WHERE entity_id = $1',
      [branch.id],
    );
    assert.deepEqual(
      audit.map((a) => a.actor_id),
      [U.allBranches],
    );
  });

  test('RLS con sucursales de la base: con permiso pero sin all_branches no se crean sucursales', async () => {
    const ctx = await contextFor({ sub: U.multiRole, lab: LAB_A });
    await assert.rejects(
      bus.execute(createBranch, { code: `M${s}`, name: 'Limitado' }, ctx),
      codeOf('PERMISSION_DENIED'),
    );
  });

  test('RLS sigue aislando: el contexto resuelto solo ve sus sucursales y nunca las de otro laboratorio', async () => {
    const one = await contextFor({ sub: U.oneBranch, lab: LAB_A });
    const seen = await read<{ id: string }>(one, 'SELECT id FROM app.branches ORDER BY id');
    assert.deepEqual(
      seen.map((r) => r.id),
      [BRANCH_A1],
    );
    const all = await contextFor({ sub: U.allBranches, lab: LAB_A });
    const cross = await read(all, 'SELECT id FROM app.branches WHERE id = $1', [BRANCH_B1]);
    assert.equal(cross.length, 0);
    const foreignUser = await read(all, 'SELECT id FROM app.users WHERE id = $1', [ADMIN_B]);
    assert.equal(foreignUser.length, 0);
  });

  test('el administrador de F0 sin roles asignados queda sin permisos (ya no los toma del token)', async () => {
    const ctx = await contextFor({
      sub: ADMIN_A,
      lab: LAB_A,
      perms: ['configuration.branches.create'],
    });
    assert.equal(ctx.permissions.has('configuration.branches.create'), false);
  });
});
