# ADR 0030 — Tubos y etiquetas

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión (D-33)

- **`catalog` define:**
  - el tipo de contenedor por estudio: aditivo, color, volumen y orden de extracción;
  - las reglas de consolidación de tubos, por laboratorio y aprobadas.
- **`samples`:**
  - calcula el mínimo de tubos por orden;
  - registra cada tubo como contenedor, con sus alícuotas.
- **`documents`:**
  - imprime una etiqueta por tubo, con código de barras, y etiquetas secundarias de alícuota;
  - la impresora se configura por puesto;
  - toda reimpresión se audita con motivo.
- **Fases:**
  - F3: cálculo de tubos, etiqueta por tubo y reimpresión;
  - F15: Label Builder.
