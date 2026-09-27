#!/usr/bin/env node
// Verifica la arquitectura modular del backend:
//  1. Existe una carpeta por cada módulo del registro, y ninguna carpeta sobrante.
//  2. Ningún módulo importa el interior de otro módulo: solo su index.ts.
//  3. Los módulos solo importan el kernel por su API pública (kernel/index.ts).
// Sin dependencias; se ejecuta en CI.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'apps/api/src');
const modulesDir = join(src, 'modules');
const kernelIndex = join(src, 'kernel/index.ts');
const { MODULES } = await import(join(root, 'packages/contracts/dist/index.js'));

const problems = [];
const registry = new Set(MODULES.map((m) => m.key));
const folders = readdirSync(modulesDir).filter((f) => statSync(join(modulesDir, f)).isDirectory());

for (const key of registry)
  if (!folders.includes(key)) problems.push(`Falta la carpeta del módulo "${key}"`);
for (const f of folders)
  if (!registry.has(f)) problems.push(`Carpeta "${f}" no está en el registro de módulos`);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const file of walk(modulesDir)) {
  const owner = relative(modulesDir, file).split(sep)[0];
  if (!registry.has(owner)) continue; // index.ts del registro
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2];
    if (!spec?.startsWith('.')) continue;
    const target = resolve(dirname(file), spec).replace(/\.js$/, '.ts');
    const rel = relative(src, target).split(sep);
    const where = relative(root, file);
    if (rel[0] === 'modules' && rel[1] && rel[1] !== owner) {
      if (!(rel.length === 3 && rel[2] === 'index.ts')) {
        problems.push(
          `${where}: importa el interior del módulo "${rel[1]}" (${spec}); use su index.ts`,
        );
      }
    }
    if (rel[0] === 'kernel' && target !== kernelIndex) {
      problems.push(`${where}: importa el interior del kernel (${spec}); use kernel/index.js`);
    }
    if (rel[0] === 'http') {
      problems.push(`${where}: un módulo no puede depender de la capa HTTP (${spec})`);
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${registry.size} módulos registrados · fronteras entre módulos respetadas`);
