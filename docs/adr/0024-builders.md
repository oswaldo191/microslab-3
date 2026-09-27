# ADR 0024 — Builders versionados

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- Report Builder (`reports`), Form Builder (`forms`), PDF y Label Builder (`documents`) y Study/Profile Builder (`catalog`) comparten estas reglas:
  - definiciones versionadas y auditadas;
  - una versión aprobada es inmutable;
  - lo emitido queda ligado a la versión con que se produjo: un PDF emitido nunca se regenera con otra plantilla, y un formulario lleno conserva su versión.
- Todas las fórmulas usan el evaluador seguro de `packages/expressions`, sin `eval`.
- Los reportes consultan proyecciones con los permisos del usuario.
- F6 y F7 usan plantillas fijas. Los builders llegan en F15.
