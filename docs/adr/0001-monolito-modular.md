# ADR 0001 — Monolito modular

**Estado:** aprobado · 27 de septiembre de 2026

## Decisión

Un solo backend (NestJS) dividido en 38 módulos con fronteras estrictas, en lugar de microservicios.

## Por qué

- Un equipo pequeño mantiene y despliega una sola aplicación.
- Las fronteras se hacen cumplir con código: cada módulo expone solo su `index.ts`
  y `tools/check-modules.mjs` falla en CI si alguien importa el interior de otro módulo.
- Un módulo se puede separar más adelante si el volumen lo exige, porque ya se comunica por eventos.

## Consecuencias

- El registro oficial de módulos vive en `packages/contracts/src/modules.ts`.
- `tools/scaffold-modules.mjs` genera el esqueleto de cada módulo registrado.

## Adenda — Architecture Freeze (27 de septiembre de 2026, propuesta)

- El registro pasa de 38 a **55 módulos**.
  - Se suman los ya documentados `search`, `workspace`, `einvoicing`, `doccontrol`, `logbooks`, `quality`, `training`, `internal-audits`, `capa`, `compliance` y `equipment`/`reagents` según corresponda.
  - Son nuevos `delivery`, `logistics`, `bi`, `biosafety`, `hr` y `automation`.
  - `ai` se renombra `clinical-ai` mediante un rename controlado en F1 (F1-TD-05).
- Las fases del registro se alinean con el roadmap del [informe](../architecture/ARCHITECTURE_FREEZE.md), sección 33.
- `modules.ts` no se modifica antes de la aprobación. Se actualiza en el primer commit de F1 (contradicción C-24).
