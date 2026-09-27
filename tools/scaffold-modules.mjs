#!/usr/bin/env node
// Crea el esqueleto de cada módulo registrado en packages/contracts que aún no exista,
// y regenera apps/api/src/modules/index.ts con el registro completo.
// Requiere haber compilado packages/contracts (pnpm --filter @microslab/contracts build).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MODULES } = await import(join(root, 'packages/contracts/dist/index.js'));
const modulesDir = join(root, 'apps/api/src/modules');

export const camel = (key) => key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

let created = 0;
for (const m of MODULES) {
  const dir = join(modulesDir, m.key);
  const index = join(dir, 'index.ts');
  if (existsSync(index)) continue;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    index,
    `import { defineModule } from '../../kernel/index.js';

/** ${m.name}. Estructura registrada desde F0; su funcionalidad se construye en F${m.activatesInPhase}. */
export const ${camel(m.key)}Module = defineModule({
  key: '${m.key}',
  commands: [],
  events: [],
});
`,
  );
  created++;
}

const imports = MODULES.map((m) => `import { ${camel(m.key)}Module } from './${m.key}/index.js';`).join('\n');
writeFileSync(
  join(modulesDir, 'index.ts'),
  `// Archivo generado por tools/scaffold-modules.mjs — no editar a mano.
import type { ModuleManifest } from '../kernel/index.js';
${imports}

/** Los ${MODULES.length} módulos de MICROSLAB, en el orden del registro oficial. */
export const ALL_MODULES: readonly ModuleManifest[] = [
${MODULES.map((m) => `  ${camel(m.key)}Module,`).join('\n')}
];
`,
);
console.log(`✓ ${created} módulos creados · registro con ${MODULES.length} módulos`);
