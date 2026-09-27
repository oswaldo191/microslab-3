# MICROSLAB 3.0

Plataforma SaaS multi-laboratorio para laboratorios clínicos: pacientes, órdenes, muestras, resultados,
validación, PDF, caja y facturación, con aislamiento estricto entre laboratorios.

La arquitectura completa está en el documento **MICROSLAB 3.0 — Arquitectura definitiva** y las decisiones
técnicas en [`docs/adr`](docs/adr).

## Estado: Fase 0 (fundaciones)

- Monorepo `apps/` + `packages/`, CI en GitHub Actions.
- Base de datos con RLS forzado, auditoría inmutable encadenada, outbox, secuencias e idempotencia.
- Kernel con la tubería única de comandos.
- Registro de los 38 módulos con su esqueleto y verificador de fronteras.
- Comando de ejemplo `configuration.branches.create` probado de punta a punta contra PostgreSQL.

## Estructura

```
apps/api            Backend (kernel sin framework + adaptador NestJS + worker del outbox)
apps/web            App del personal (React + Vite)
apps/console        Consola del Super Admin (F10)
apps/verify         Verificación pública por QR (F7)
apps/*-portal       Portales de paciente y médico (preparados)
apps/connector      Agente local de equipos (preparado)
packages/contracts  Registro de módulos, catálogo de permisos y tipos compartidos
infra/db            Bootstrap, migraciones SQL, pruebas de base de datos
tools/              Generador y verificador de módulos
docs/adr            Decisiones de arquitectura
```

## Desarrollo local

Requisitos: Node 22, pnpm 10, Docker y el cliente `psql`.

```bash
pnpm install
pnpm db:up                                   # PostgreSQL 16 + Redis 7
cp .env.example .env
DATABASE_URL_OWNER=postgres://microslab_owner:owner_dev_password@localhost:5432/microslab pnpm db:migrate
pnpm --filter @microslab/contracts build
pnpm db:test                                 # pruebas de RLS, auditoría y outbox
pnpm --filter @microslab/api test            # kernel + integración (con TEST_DATABASE_URL_*)
node tools/check-modules.mjs                 # fronteras entre módulos
```

## Reglas del proyecto

- Toda escritura pasa por un comando: permiso, validación, auditoría y outbox en la misma transacción.
- Ningún módulo importa el interior de otro: solo su `index.ts`.
- Nada clínico ni financiero se borra físicamente.
- El backend es la fuente de verdad de reglas, permisos, planes y comisiones.
