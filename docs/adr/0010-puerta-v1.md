# ADR 0010 — F7B V1 Readiness, F7C Controlled Pilot, Puerta V1 y Quality V1 mínimo

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

- El paquete pre-F1 dejó pendiente qué parte de Calidad es imprescindible para V1; la especificación maestra lo fija.
- La revisión CTO v2.1 aprobó D-01 y agregó un piloto controlado antes de producción.

## Decisión

**Secuencia de V1 (definición única):** F7 → **F7B V1 Readiness** → **F7C Controlled Pilot (2 semanas)** → **Puerta V1 (V1 Gate)**.

### F7B — V1 Readiness

**F7B no es el piloto.** No introduce módulos, pantallas ni funcionalidades nuevas. Cubre exclusivamente:

- integración;
- QA y pruebas end-to-end;
- seguridad;
- migraciones;
- infraestructura;
- observabilidad;
- backups y restauración;
- capacitación;
- preparación operacional;
- preparación fiscal/e-CF;
- certificación y pruebas del conector fiscal correspondiente (D-20);
- preparación de soporte;
- preparación de datos iniciales;
- preparación del entorno piloto.

### F7C — Controlled Pilot

Dura 2 semanas:

- piloto real, con laboratorio real, usuarios reales y operaciones reales controladas;
- monitoreo;
- gestión de incidentes;
- métricas;
- correcciones necesarias;
- evaluación de estabilidad;
- evaluación operacional.

Además:

- **Controles:** plan de retorno, revisión diaria y congelamiento de cambios (solo correcciones).
- **e-CF:** son reales solo si la preparación fiscal de F7B quedó validada oficialmente.

### Puerta V1

- Ocurre **después de completar F7C**, no al terminar F7B.
- Exige los criterios de salida de F7B y los go/no-go de F7C ([informe](../architecture/ARCHITECTURE_FREEZE.md), secciones 35.1 y 35.3).
- Si el piloto no pasa, se corrige en la fase de origen y F7C se repite.

### Quality V1 mínimo

Es obligatorio antes de la Puerta V1:

- IQC básico diario, con reglas básicas y bloqueo de liberación configurable;
- registros de temperatura;
- incidentes de bioseguridad;
- SOP críticos con versión, aprobación, firma electrónica y lectura obligatoria;
- tablero básico de calidad.

Se construye en F5 (temperaturas, incidentes, SOP críticos) y en F6 (IQC y tablero) (C-25). F7B lo verifica en preproducción y F7C lo usa en operación real.

### Otras decisiones

- **Consola Super Admin de V1:** se construye en F2 y F7 (C-26).
- **Quality I (F11) y Quality II (F13):** quedan después de V1 (ADR 0015).

## Estado

- **D-01 aprobada** (revisión CTO v2.1, 27/09/2026).
- Esta ADR sigue en **Propuesta** hasta la aprobación definitiva del Freeze.
