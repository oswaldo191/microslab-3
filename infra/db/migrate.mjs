#!/usr/bin/env node
// Ejecuta las migraciones SQL pendientes con psql, como microslab_owner.
// Sin dependencias: requiere solo el cliente psql. Cada migración corre en una transacción.
// Luego sincroniza el catálogo global de permisos desde packages/contracts.
//
// Uso: DATABASE_URL_OWNER=postgres://... node infra/db/migrate.mjs

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL_OWNER;
if (!url) {
  console.error('Falta DATABASE_URL_OWNER');
  process.exit(1);
}

const psql = (sql, extra = []) =>
  execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-At', ...extra, '-c', sql], {
    encoding: 'utf8',
  }).trim();

const psqlFile = (file) =>
  execFileSync(
    'psql',
    [url, '-v', 'ON_ERROR_STOP=1', '-q', '-X', '--single-transaction', '-f', file],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );

psql(`CREATE SCHEMA IF NOT EXISTS kernel;
      CREATE TABLE IF NOT EXISTS kernel.schema_migrations (
        name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

const applied = new Set(
  psql('SELECT name FROM kernel.schema_migrations').split('\n').filter(Boolean),
);
const files = readdirSync(join(here, 'migrations'))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;
  process.stdout.write(`→ ${file} ... `);
  const body = readFileSync(join(here, 'migrations', file), 'utf8');
  const wrapped = `${body}\nINSERT INTO kernel.schema_migrations (name) VALUES ('${file}');\n`;
  const tmp = join(here, '.migration.tmp.sql');
  writeFileSync(tmp, wrapped);
  try {
    psqlFile(tmp);
  } finally {
    rmSync(tmp, { force: true });
  }
  console.log('ok');
}

// Catálogo global de permisos: la fuente de verdad es packages/contracts/src/permissions.json.
const catalog = JSON.parse(
  readFileSync(join(here, '../../packages/contracts/src/permissions.json'), 'utf8'),
);
const esc = (s) => String(s).replaceAll("'", "''");
const values = catalog
  .map(
    (p) =>
      `('${esc(p.key)}','${esc(p.module)}','${esc(p.description)}',${p.requiresReason ? 'true' : 'false'})`,
  )
  .join(',\n');
psql(`INSERT INTO platform.permissions (key, module_key, description, requires_reason) VALUES
${values}
ON CONFLICT (key) DO UPDATE SET module_key = EXCLUDED.module_key,
  description = EXCLUDED.description, requires_reason = EXCLUDED.requires_reason`);
console.log(`✓ migraciones al día · ${catalog.length} permisos en el catálogo`);
