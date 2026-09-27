# ADR 0008 — Reglas fiscales y regulatorias versionadas

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

La norma fiscal y la sanitaria cambian: plazos de contingencia, tipos de e-CF, requisitos de calidad. MicroSlab no inventa reglas ni asume textos legales.

## Decisión

- Toda regla externa es un dato: `Fiscal Policy` + `Fiscal Policy Version`, con fuente o referencia (`regulatory_references`), fecha efectiva, usuario que la cargó y auditoría. Ejemplos: `FiscalContingencyPolicy`, tipos aplicables, reglas por tipo de e-CF, mapeos de estado externo, requisitos de `compliance`.
- Un documento o evento guarda la versión de la política con la que se evaluó.
- Las políticas globales las mantiene la plataforma (consola). Un laboratorio no las edita; solo elige entre las opciones que la política permite.
- Si falta una fuente oficial, el valor queda pendiente y no se usa.

## Consecuencias

Un cambio normativo es una versión nueva, sin despliegue de código. El historial muestra qué regla aplicaba en cada fecha.
