# ADR 0014 — Work Center sample-centric

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- La unidad de trabajo es la **muestra** y la tarea sobre ella, no el paciente. El paciente aparece como contexto.
- El Work Center es el motor de colas de todos los centros.
  - Iniciales: Reception, Phlebotomy, Laboratory, Validation, Imaging, Cash, Home Laboratory y Quality.
  - Se pueden crear centros propios.
- **Flujo:** recepción → identificación → área → prioridad → worklist → procesamiento → resultado → reglas, fórmulas y delta → revisión → validación técnica → validación profesional → entrega → auditoría.
- **Prioridades** configurables y versionadas: Critical, Urgent, TAT Soon, Delayed y Normal. Se combinan con el riesgo de entrega del Result Delivery Calendar (ADR 0020).
- **TAT Engine:** marca cada hito y compara contra el SLA por estudio y prioridad.
- Una corrección de resultado nunca destruye el valor anterior.

## Definición consolidada

La definición completa está en [WORK_CENTER.md](../architecture/WORK_CENTER.md). Incluye la sección 29 "Menos clics", completada con el análisis de clics, pantallas y campos que esa sección pedía, sin requisitos nuevos. D-13 queda cerrada.

## Revisión CTO v2.1

- **Mi Trabajo (D-24):** se confirma como pantalla de llegada por rol. Muestra:
  - los contadores del documento;
  - "Continuar trabajando";
  - las entregas en riesgo que dependen del usuario;
  - los críticos por notificar;
  - los SOP pendientes de lectura.
- **Proyecciones:** Mi Trabajo se alimenta de proyecciones.
- **Turnos:** en F5 el turno es operativo y provisional; en F12 se lee de `hr` (D-28).
- **Cadena de custodia (ADR 0026):** se muestra en el historial de la muestra.
