# ADR 0019 — Analytics separado de BI

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- `analytics` sirve a la operación diaria: TAT, productividad, pendientes y calidad.
  - Se alimenta casi en tiempo real con proyecciones por eventos.
  - Sostiene el Operations Center (F10).
- `bi` sirve a la dirección: ingresos, rentabilidad, sucursales, ARS, costos y tendencias.
  - Se alimenta por lotes diarios.
  - Llega en F17+.
- Ninguno consulta en caliente tablas de otros módulos. Ambos leen proyecciones o réplicas.
