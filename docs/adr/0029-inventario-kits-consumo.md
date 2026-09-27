# ADR 0029 — Inventario por kits y consumo por perfil

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión (D-32)

- **Kits de reactivos:** determinaciones por kit, lote, vencimiento y estabilidad tras apertura.
- **Lista de materiales por estudio y por perfil:** vive en `catalog` e incluye controles, calibradores, consumibles y un factor de repetición.
- **Descuento automático:** `inventory` descuenta el consumo teórico consumiendo eventos de resultado. Nunca escribe en tablas de `results`.
- **Conteos:** reportan la diferencia entre consumo teórico y real. Las correcciones se hacen con movimientos de ajuste; el kardex es inmutable.
- **Fases:** F8. El costeo por prueba (`costing`) llega en F17+.
