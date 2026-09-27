import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from './modules.js';
import { PERMISSIONS } from './permissions.js';

test('hay exactamente 38 módulos con claves únicas', () => {
  assert.equal(MODULES.length, 38);
  assert.equal(new Set(MODULES.map((m) => m.key)).size, 38);
});

test('los módulos clínicos fundamentales no dependen del plan', () => {
  const fundamentals = ['patients', 'orders', 'samples', 'results', 'validation', 'documents', 'workcenter'];
  for (const key of fundamentals) {
    const mod = MODULES.find((m) => m.key === key);
    assert.ok(mod, `falta el módulo ${key}`);
    assert.equal(mod.planGated, false, `${key} no puede depender del plan`);
  }
});

test('cada permiso pertenece a un módulo registrado y empieza con su clave', () => {
  const keys = new Set<string>(MODULES.map((m) => m.key));
  for (const p of PERMISSIONS) {
    assert.ok(keys.has(p.module), `permiso ${p.key}: módulo desconocido ${p.module}`);
    assert.ok(p.key.startsWith(`${p.module}.`), `permiso ${p.key} no empieza con ${p.module}.`);
  }
});
