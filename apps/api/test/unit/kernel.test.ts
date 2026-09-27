import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '@microslab/contracts';
import {
  assertValidEvent,
  contextStatement,
  defineCommand,
  defineModule,
  DomainError,
  redact,
  stableStringify,
  toSessionSettings,
  translateDatabaseError,
  CommandBus,
  type SqlClient,
  type TenantDatabase,
} from '../../src/kernel/index.js';
import { ALL_MODULES } from '../../src/modules/index.js';
import { tenantContext } from '../support/context.js';

test('el contexto rechaza identificadores que no son UUID (evita inyección en SET LOCAL)', () => {
  assert.throws(() => toSessionSettings(tenantContext({ laboratoryId: "x'; DROP TABLE--" })));
  assert.throws(() => toSessionSettings(tenantContext({ branchIds: ['no-uuid'] })));
});

test('el contexto se fija con parámetros, nunca con texto interpolado', () => {
  const settings = toSessionSettings(tenantContext({ allBranches: false, branchIds: [] }));
  const stmt = contextStatement(settings);
  assert.match(stmt.text, /^SELECT set_config\(\$1, \$2, true\)/);
  assert.equal(stmt.params.length, 12);
  assert.ok(!stmt.text.includes(settings['app.laboratory_id']));
});

test('la auditoría oculta secretos en cualquier nivel', () => {
  const out = redact({ name: 'A', password: 'x', nested: { apiToken: 't', ok: 1 } }) as Record<
    string,
    any
  >;
  assert.equal(out.password, '[protegido]');
  assert.equal(out.nested.apiToken, '[protegido]');
  assert.equal(out.nested.ok, 1);
});

test('los eventos deben llamarse <módulo>.<NombreEnPasado> y ser pequeños', () => {
  assert.doesNotThrow(() =>
    assertValidEvent({ type: 'orders.OrderRegistered', aggregateType: 'o', aggregateId: '1' }),
  );
  assert.throws(() =>
    assertValidEvent({ type: 'orders.registered', aggregateType: 'o', aggregateId: '1' }),
  );
  assert.throws(() =>
    assertValidEvent({
      type: 'orders.OrderRegistered',
      aggregateType: 'o',
      aggregateId: '1',
      payload: { blob: 'x'.repeat(5000) },
    }),
  );
});

test('stableStringify ordena claves (misma entrada, misma huella)', () => {
  assert.equal(
    stableStringify({ b: 1, a: { d: 2, c: 3 } }),
    stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
  );
});

test('los errores de PostgreSQL se traducen a errores de dominio', () => {
  assert.equal((translateDatabaseError({ code: '23505' }) as DomainError).code, 'CONFLICT');
  assert.equal(
    (translateDatabaseError({ code: '42501' }) as DomainError).code,
    'PERMISSION_DENIED',
  );
});

test('el registro del backend contiene exactamente los 38 módulos oficiales, en orden', () => {
  assert.deepEqual(
    ALL_MODULES.map((m) => m.key),
    MODULES.map((m) => m.key),
  );
});

test('un módulo no puede declarar comandos o eventos de otro', () => {
  const foreign = defineCommand({
    name: 'orders.x.create',
    module: 'orders',
    permission: 'orders.x.create',
    parse: (i) => i,
    handle: async () => ({ result: null, audit: [{ action: 'x' }] }),
  });
  assert.throws(() => defineModule({ key: 'configuration', commands: [foreign], events: [] }));
  assert.throws(() =>
    defineModule({ key: 'configuration', commands: [], events: ['orders.Created'] }),
  );
});

// --- Tubería de comandos con una base falsa: verifica el orden y los cortes tempranos ---

class RecordingDb implements TenantDatabase {
  readonly statements: string[] = [];
  transactions = 0;
  async transaction<T>(_s: unknown, work: (tx: SqlClient) => Promise<T>): Promise<T> {
    this.transactions++;
    const tx: SqlClient = {
      query: async (text) => {
        this.statements.push(text.trim().split(/\s+/).slice(0, 3).join(' '));
        return { rows: [], rowCount: 0 };
      },
    };
    return work(tx);
  }
}

const sample = defineCommand<{ v: number }, number>({
  name: 'configuration.sample.run',
  module: 'configuration',
  permission: 'configuration.sample.run',
  requiresReason: true,
  parse: (i) => {
    const v = (i as { v?: unknown })?.v;
    if (typeof v !== 'number') throw new DomainError('VALIDATION_FAILED', 'v');
    return { v };
  },
  handle: async (tx, input) => {
    await tx.query('UPDATE app.something SET x = 1');
    return {
      result: input.v * 2,
      audit: [{ action: 'sample.run' }],
      events: [{ type: 'configuration.SampleRan', aggregateType: 's', aggregateId: '1' }],
    };
  },
});

test('sin permiso no se abre ninguna transacción', async () => {
  const db = new RecordingDb();
  const bus = new CommandBus(db);
  await assert.rejects(
    bus.execute(sample, { v: 1 }, tenantContext(), { reason: 'motivo válido' }),
    {
      code: 'PERMISSION_DENIED',
    },
  );
  assert.equal(db.transactions, 0);
});

test('sin motivo, una acción sensible no se ejecuta', async () => {
  const db = new RecordingDb();
  const bus = new CommandBus(db);
  const ctx = tenantContext({ permissions: new Set(['configuration.sample.run']) });
  await assert.rejects(bus.execute(sample, { v: 1 }, ctx), { code: 'REASON_REQUIRED' });
  await assert.rejects(bus.execute(sample, { v: 1 }, ctx, { reason: 'no' }), {
    code: 'REASON_REQUIRED',
  });
  assert.equal(db.transactions, 0);
});

test('un módulo fuera del plan responde MODULE_DISABLED antes de todo', async () => {
  const db = new RecordingDb();
  const bus = new CommandBus(db);
  const gated = { ...sample, module: 'inventory' as const, name: 'inventory.x.run' };
  const ctx = tenantContext({ permissions: new Set(['configuration.sample.run']) });
  await assert.rejects(bus.execute(gated, { v: 1 }, ctx, { reason: 'motivo válido' }), {
    code: 'MODULE_DISABLED',
  });
  const enabled = tenantContext({ ...ctx, enabledModules: new Set(['inventory']) });
  assert.equal(await bus.execute(gated, { v: 2 }, enabled, { reason: 'motivo válido' }), 4);
});

test('orden dentro de la transacción: cambio → auditoría → outbox', async () => {
  const db = new RecordingDb();
  const bus = new CommandBus(db);
  const ctx = tenantContext({ permissions: new Set(['configuration.sample.run']) });
  const out = await bus.execute(sample, { v: 21 }, ctx, { reason: 'motivo válido' });
  assert.equal(out, 42);
  assert.deepEqual(db.statements, [
    'UPDATE app.something SET',
    'INSERT INTO audit.audit_events',
    'INSERT INTO kernel.outbox_events',
  ]);
});
