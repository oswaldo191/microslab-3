# ADR 0010 — Puerta V1 y Quality V1 mínimo

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

El paquete pre-F1 dejó pendiente qué parte de Calidad es imprescindible para V1. La especificación maestra lo fija.

## Decisión

- **Quality V1 mínimo** (obligatorio antes de la Puerta V1):
  - IQC básico diario, con reglas básicas y bloqueo de liberación configurable;
  - registros de temperatura;
  - incidentes de bioseguridad;
  - SOP críticos con versión, aprobación, firma electrónica y lectura obligatoria;
  - tablero básico de calidad.
- **Dónde se construye Quality V1 mínimo (revisión 2, C-25):**
  - en F5: temperaturas, incidentes de bioseguridad y SOP críticos;
  - en F6: IQC básico y tablero básico.
- **Consola Super Admin de V1 (C-26):** se construye en F2 y F7.
- **Propuesta (D-01):** F7B "V1 Readiness" es una fase de **preparación, sin módulos ni pantallas nuevas**. Incluye integración de extremo a extremo, QA, seguridad, migración y operación, certificación e-CF en producción, capacitación y piloto.
- La Puerta V1 se cruza al cumplir los criterios de salida de F7B ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.1).
- Quality I (F11) y Quality II (F13) quedan después de V1 (ADR 0015).

## Estado de las partes

El contenido de Quality V1 lo define la especificación maestra. Esta ADR sigue en **Propuesta** hasta la aprobación del Freeze, igual que la ubicación de la puerta (D-01).
