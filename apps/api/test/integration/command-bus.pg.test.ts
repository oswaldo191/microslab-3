/**
 * Prueba de punta a punta contra PostgreSQL real (criterio de salida de la Fase 0):
 * comando → permiso → validación → transacción con RLS → auditoría encadenada → outbox.
 *
 * Requiere la base de pruebas preparada por infra/db/tests/run.sh y estas variables:
 *   TEST_DATABASE_URL_APP         rol microslab_app
 *   TEST_DATABASE_URL_DISPATCHER  rol microslab_dispatcher (para mirar el outbox)
 * Si no están definidas, la prueba se omite.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  CommandBus,
  defineCommand,
  PgTenantDatabase,
  toSessionSettings,
  type TenantContext,
} from '../../src/kernel/index.js';
import { createBranch } from '../../src/modules/configuration/index.js';
import { LAB_B, ADMIN_B, tenantContext } from '../support/context.js';
import { PsqlPool } from '../support/psql-pool.js';

const APP_URL = process.env.TEST_DATABASE_URL_APP;
const DISPATCHER_URL = process.env.TEST_DATABASE_URL_DISPATCHER;
const skip = !APP_URL || !DISPATCHER_URL ? 'faltan TEST_DATABASE_URL_APP / TEST_DATABASE_URL_DISPATCHER' : false;

describe('tubería de comandos contra PostgreSQL', { skip }, () => {
  let db: PgTenantDatabase;
  let bus: CommandBus;
  const suffix = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');

  const read = <R>(ctx: TenantContext, sql: string, params: unknown[] = []) =>
    db.transaction(toSessionSettings(ctx), async (tx) => (await tx.query<R>(sql, params)).rows);

  const outbox = async (aggregateId: string) => {
    const dispatcher = new PsqlPool(DISPATCHER_URL!);
    const client = await dispatcher.connect();
    try {
      const { rows } = await client.query<{ event_type: string; laboratory_id: string }>(
        'SELECT event_type, laboratory_id FROM kernel.outbox_events WHERE aggregate_id = $1',
        [aggregateId],
      );
      return rows;
    } finally {
      client.release();
    }
  };

  before(() => {
    db = new PgTenantDatabase(new PsqlPool(APP_URL!));
    bus = new CommandBus(db);
  });
  after(() => undefined);

  test('crea la sucursal, la audita con cadena válida y publica el evento', async () => {
    const ctx = tenantContext();
    const branch = await bus.execute(createBranch, { code: `t${suffix}`, name: '  Sucursal Prueba ' }, ctx);
    assert.equal(branch.code, `T${suffix}`); // normalizado a mayúsculas
    assert.equal(branch.name, 'Sucursal Prueba');

    const audit = await read<{ action: string; actor_id: string; request_id: string; chain_seq: number }>(
      ctx,
      `SELECT action, actor_id, request_id, chain_seq FROM audit.audit_events WHERE entity_id = $1`,
      [branch.id],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0]!.action, 'branches.create');
    assert.equal(audit[0]!.request_id, ctx.requestId);

    const broken = await read(ctx, 'SELECT * FROM audit.verify_chain()');
    assert.equal(broken.length, 0, 'la cadena de auditoría debe verificar');

    const events = await outbox(branch.id);
    assert.deepEqual(events.map((e) => e.event_type), ['configuration.BranchCreated']);
    assert.equal(events[0]!.laboratory_id, ctx.laboratoryId);
  });

  test('otro laboratorio no ve la sucursal creada', async () => {
    const ctx = tenantContext();
    const branch = await bus.execute(createBranch, { code: `V${suffix}`, name: 'Visible solo en A' }, ctx);
    const labB = tenantContext({ laboratoryId: LAB_B, actor: { type: 'user', id: ADMIN_B } });
    const seen = await read(labB, 'SELECT id FROM app.branches WHERE id = $1', [branch.id]);
    assert.equal(seen.length, 0);
    const seenAudit = await read(labB, 'SELECT id FROM audit.audit_events WHERE entity_id = $1', [branch.id]);
    assert.equal(seenAudit.length, 0);
  });

  test('datos inválidos: error de validación con el campo, sin escribir nada', async () => {
    await assert.rejects(bus.execute(createBranch, { code: 'x', name: '' }, tenantContext()), (e: any) => {
      assert.equal(e.code, 'VALIDATION_FAILED');
      assert.deepEqual(e.issues.map((i: any) => i.field).sort(), ['code', 'name']);
      return true;
    });
  });

  test('código duplicado en el mismo laboratorio: CONFLICT', async () => {
    const ctx = tenantContext();
    await bus.execute(createBranch, { code: `D${suffix}`, name: 'Primera' }, ctx);
    await assert.rejects(bus.execute(createBranch, { code: `D${suffix}`, name: 'Segunda' }, ctx), {
      code: 'CONFLICT',
    });
  });

  test('idempotencia: la misma petición repetida no crea dos sucursales', async () => {
    const ctx = tenantContext();
    const key = `idem-${randomUUID()}`;
    const first = await bus.execute(createBranch, { code: `I${suffix}`, name: 'Una vez' }, ctx, { idempotencyKey: key });
    const second = await bus.execute(createBranch, { code: `I${suffix}`, name: 'Una vez' }, ctx, { idempotencyKey: key });
    assert.equal(second.id, first.id);
    await assert.rejects(
      bus.execute(createBranch, { code: `J${suffix}`, name: 'Otra' }, ctx, { idempotencyKey: key }),
      { code: 'IDEMPOTENCY_MISMATCH' },
    );
  });

  test('si el comando falla a mitad, no queda ni el cambio ni la auditoría ni el evento', async () => {
    const code = `R${suffix}`;
    const failing = defineCommand<null, never>({
      ...createBranch,
      name: 'configuration.branches.failing',
      parse: () => null,
      async handle(tx) {
        await tx.query(`INSERT INTO app.branches (code, name) VALUES ($1, 'Temporal')`, [code]);
        throw new Error('fallo simulado después de escribir');
      },
    });
    const ctx = tenantContext();
    await assert.rejects(bus.execute(failing, {}, ctx), /fallo simulado/);
    const rows = await read(ctx, 'SELECT id FROM app.branches WHERE code = $1', [code]);
    assert.equal(rows.length, 0);
  });

  test('sin el permiso en el contexto, la base no recibe nada', async () => {
    const ctx = tenantContext({ permissions: new Set() });
    await assert.rejects(bus.execute(createBranch, { code: `P${suffix}`, name: 'No' }, ctx), {
      code: 'PERMISSION_DENIED',
    });
  });

  test('un usuario limitado a una sucursal no puede crear sucursales (RLS lo bloquea)', async () => {
    const ctx = tenantContext({ allBranches: false, branchIds: ['00000000-0000-7000-8000-0000000000a1'] });
    await assert.rejects(bus.execute(createBranch, { code: `L${suffix}`, name: 'Limitado' }, ctx), {
      code: 'PERMISSION_DENIED',
    });
  });
});
