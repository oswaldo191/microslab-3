# ADR 0020 — Result Delivery Calendar

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

Requisito obligatorio: controlar los compromisos de entrega de resultados hechos a pacientes y detectar cuando un resultado prometido no está listo. No es una agenda de pacientes.

## Decisión

- Se crea el módulo `delivery` (Clinical, F6), separado de `scheduling`, con el que solo comparte componentes visuales.
- **Compromiso de entrega** por orden o estudio. Registra:
  - fecha y hora prometidas;
  - fecha estimada;
  - fecha y hora de entrega;
  - tipo;
  - responsable;
  - sucursal;
  - prioridad;
  - canal;
  - estado.
- **Estados del compromiso:** PROMISED, IN_PROGRESS, READY, DELIVERED, OVERDUE, CANCELLED y RESCHEDULED.
  - Son independientes del estado del resultado.
  - Reprogramar crea una versión nueva y conserva la anterior.
- **Vistas:**
  - calendario (hoy, mañana, semana, mes, fecha específica), con conteos por día;
  - lista "Entregas de Hoy", agrupada en listos, pendientes, atrasados y entregados;
  - filtros por fecha, sucursal, área, laboratorio, médico, responsable, estado, prioridad, tipo de estudio, canal y paciente.
- **Alertas:**
  - El backend compara la hora actual, la hora prometida y el estado real del resultado.
  - Niveles: INFORMACIÓN, WARNING, URGENTE y OVERDUE.
  - Los umbrales son configuración (ADR 0013; valores iniciales en D-08), nunca código.
  - Aparecen en Work Center, Mi Trabajo, tablero, Operations Center, Calendario de Entregas y la pantalla de resultados.
- **Prioridad operacional:** se calcula en el backend con el tiempo restante, el estado, el TAT, el tipo de estudio, la prioridad clínica y el retraso. Se muestra con icono y texto, no solo con color.
- Los eventos `delivery.*` alimentan `automation` y `analytics`.

## Definición consolidada

La definición completa está en [RESULT_DELIVERY_CALENDAR.md](../architecture/RESULT_DELIVERY_CALENDAR.md). Cada punto lleva la marca de su origen. Incluye:

- Entregas en riesgo y atrasadas;
- reprogramación con versiones;
- confirmación de entrega;
- notificaciones;
- métricas de cumplimiento;
- integraciones.

Reglas que conviene tener a la vista:

- OVERDUE significa que pasó la hora prometida y el resultado **no está listo**. Un resultado READY no retirado no es OVERDUE.
- **No es la Agenda de Citas.**

D-12 queda cerrada. El texto original posterior al corte no se recuperó.

## Revisión CTO v2.1 (D-26)

- **Calendario Inteligente de Entrega:** se agrega la vista **agenda**, una lista cronológica continua, a las vistas de día, semana, mes y fecha.
- **Qué es "inteligente":**
  - fecha sugerida por TAT, jornada y feriados;
  - riesgo calculado con la hora estimada de listo;
  - prioridad calculada.
- **Propuesta:** considerar la carga pendiente del área al sugerir la fecha.
