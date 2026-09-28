# ADR 0018 — Conector de equipos aislado

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- `connector` es una aplicación separada, instalada en la sede y aislada del core.
  - Habla HL7 y ASTM con los analizadores.
  - Mantiene los mapeos de pruebas.
  - Recibe resultados y envía worklists.
- Se comunica con la API solo por contratos autenticados de `integrations`, con idempotencia. Registra errores y mensajes.
- Un resultado del equipo entra con origen `automático` y sigue la validación normal.
- El mismo binario puede alojar el nodo fiscal local de contingencia (ADR 0007 y 0009).
