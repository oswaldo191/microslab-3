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
- **Propuesta (D-01):** una fase F7B "V1 Readiness" reúne:
  - Quality V1 mínimo;
  - la consola Super Admin necesaria para operar;
  - la certificación e-CF;
  - el piloto.
- La Puerta V1 se cruza cuando un laboratorio piloto opera en producción con e-CF aceptados y Quality V1 mínimo.
- Quality I (F11) y Quality II (F13) quedan después de V1 (ADR 0015).

## Estado de las partes

El contenido de Quality V1 queda aceptado por la especificación maestra. La ubicación de la puerta sigue pendiente de D-01.
