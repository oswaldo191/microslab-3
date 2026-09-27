# Result Delivery Calendar — Calendario de Entrega de Resultados

**Estado:** propuesta, dentro del Architecture Freeze v2.1 · 27 de septiembre de 2026 · ADR [0020](../adr/0020-result-delivery-calendar.md) (Propuesta)
**Módulo:** `delivery` (dominio Clinical) · **Fase:** F6, con integraciones en F10, F14 y F16

> El calendario de entrega **no es la Agenda de Citas**. Es un sistema de compromisos operativos para la entrega de resultados.
> No comparte datos ni reglas con `scheduling`; solo comparte componentes visuales de calendario.

## Trazabilidad de este documento

El requisito original ("NUEVO REQUISITO — CALENDARIO DE ENTREGA DE RESULTADOS") llegó cortado en la sección 11, "Entregas en riesgo".
**El texto original desde ese punto no se recuperó** y no se reconstruye. Esta definición se completa solo con material ya existente.
Cada punto indica su origen:

| Marca | Origen |
| --- | --- |
| **[R]** | Requisito original, secciones 1–10 |
| **[L]** | Tu lista del 27/09/2026 ("Completar Calendario de Entregas"). Así queda escrita como requisito |
| **[A]** | Arquitectura ya establecida: Architecture Freeze, especificación maestra, Work Center, TAT Engine, pipeline de comandos, auditoría |
| **[P]** | Propuesta mía para cerrar un detalle técnico. No amplía el alcance, pero **necesita tu aprobación** |

No hay cambios de alcance respecto a [R] y [L]. Lo que es [P] está marcado como tal. Lo que es un cambio o una decisión nueva aparece en la sección 15.

---

## 1. Qué es y qué no es

| Es | No es |
| --- | --- |
| Un compromiso de entrega de resultados hecho a un paciente, con fecha y hora, responsable y canal **[R]** | Una cita del paciente ni un recurso agendado (eso es `scheduling`, F9) **[L]** |
| Un control que detecta cuándo un resultado prometido no está listo **[R]** | Un sustituto del estado del resultado **[R]** |
| Una lista operacional del día para recepción, entrega y supervisión **[R]** | Un registro fiscal ni de cobro (Caja y Facturación) **[A]** |

## 2. El compromiso de entrega

Al registrar una orden o estudio se crea un compromiso asociado a esa orden o estudio **[R]**. Contiene:

| Campo | Contenido | Origen |
| --- | --- | --- |
| Orden y estudios incluidos | Un compromiso cubre la orden completa o un subconjunto de sus estudios; un estudio pertenece a un solo compromiso vigente | [R] asociación · [P] subconjunto |
| Fecha prometida | Obligatoria | [R] |
| Hora prometida | Cuando aplique; si no hay hora, se usa la hora de cierre de la sucursal para calcular alertas | [R] · [P] regla de cálculo |
| Fecha estimada | Calculada por el backend con el TAT de cada estudio (catálogo) y la prioridad; se sugiere como fecha prometida | [R] campo · [A] TAT Engine · [P] sugerencia |
| Fecha y hora real de entrega | Se registra al confirmar la entrega | [R] [L] |
| Tipo de entrega | Completa o parcial (ver D-21) | [R] · [P] valores |
| Responsable | Usuario responsable del compromiso | [R] [L] |
| Sucursal | Sucursal que entrega | [R] [L] |
| Prioridad | Prioridad operacional calculada (sección 6) | [R] |
| Canal de entrega | Catálogo configurable por laboratorio, por ejemplo presencial, correo, WhatsApp o portal (portal desde F16) | [R] [L] · [P] catálogo |
| Estado | Estado del compromiso (sección 3) | [R] |

Ejemplos del requisito **[R]**: "Resultado prometido para hoy a las 3:00 PM", "para mañana", "para el viernes".

La fecha prometida por defecto sale de la fecha estimada, con la jornada y los feriados de la sucursal tomados de Configuración. Cuando exista la Agenda Enterprise (F9), el calendario de feriados será el mismo. Cambiar la fecha sugerida exige el permiso `delivery.commit` **[P]**.

## 3. Estado del resultado frente a estado del compromiso

Son dos estados separados que se muestran juntos **[R] [L]**:

| | Estado del resultado | Estado del compromiso |
| --- | --- | --- |
| Dueño | `results` / `validation` | `delivery` |
| Ejemplo | IN_VALIDATION | PROMISED FOR TODAY 4:00 PM |
| Qué responde | ¿En qué va el análisis? | ¿Cumpliremos lo prometido al paciente? |

**Estados del compromiso [R]:**

| Estado | Cuándo | Origen |
| --- | --- | --- |
| PROMISED | Compromiso creado, trabajo aún no iniciado | [R] |
| IN_PROGRESS | Evento de muestra recibida o procesamiento iniciado en el Work Center | [R] estado · [P] disparador |
| READY | Todos los estudios del compromiso están validados y el informe fue liberado | [R] estado · [P] definición |
| DELIVERED | Entrega confirmada (sección 9) | [R] |
| OVERDUE | Pasó la hora prometida y el resultado **sigue sin estar listo** | [R] (sección 6 del requisito) |
| CANCELLED | Orden anulada o compromiso cancelado con motivo | [R] |
| RESCHEDULED | La versión anterior de un compromiso que fue reprogramado | [R] estado · [P] modelo de versiones |

Reglas **[P]**:

- Un compromiso OVERDUE pasa a READY cuando el resultado queda listo. Conserva la marca "listo con atraso" para las métricas.
- Un compromiso READY cuya hora prometida pasó **no** es OVERDUE: el resultado está listo y solo falta que el paciente lo retire. Se muestra como "listo, no retirado". Así se respeta la definición del requisito.
- Los estados cambian por eventos (muestras, resultados, validación, documentos) o por comandos del usuario. Nunca los cambia el frontend.

## 4. Reprogramación con historial y motivo [L]

- Reprogramar es un comando (`delivery.reschedule`). Exige un motivo de un catálogo configurable más texto libre **[P]**.
- La versión vigente pasa a RESCHEDULED y se crea una versión nueva. La nueva vuelve a PROMISED o a IN_PROGRESS según el avance real **[P]**.
- Nada se sobrescribe. El historial muestra todas las versiones: fecha prometida anterior y nueva, quién, cuándo, motivo y si se notificó al paciente **[A]** (sin borrado físico).
- El número de reprogramaciones y sus motivos alimentan las métricas de cumplimiento (sección 12).

## 5. Detección de riesgo de incumplimiento [L]

El backend compara la **hora actual**, la **hora prometida** y el **estado real del resultado** **[R]**. Además usa el TAT **[L]**:

- **Hora estimada de listo:** el máximo, entre los estudios pendientes del compromiso, de su hito actual más el TAT restante esperado. Lo calcula el TAT Engine del Work Center **[A]** con la fórmula **[P]**.
- **En riesgo:** el compromiso no está READY y la hora estimada de listo supera la hora prometida, o el tiempo restante cae por debajo de un umbral de alerta **[P]**.
- La evaluación la hace un trabajo del backend. Corre de forma periódica (intervalo configurable) y también ante cada evento relevante de muestra, resultado o validación **[P]**.

## 6. Alertas automáticas y niveles

Niveles **[R] [L]**. El código interno está en inglés y la etiqueta visible es configurable por idioma (i18n) **[A]**.

| Código | Etiqueta es-DO | Cuándo | Origen |
| --- | --- | --- | --- |
| INFO | Información | Entrega próxima (p. ej., dentro de 24 h) | [R] |
| WARNING | Advertencia | Entrega próxima y resultado todavía no está listo | [R] |
| URGENT | Urgente | Falta poco para el compromiso y el resultado no está listo | [R] |
| OVERDUE | Vencido | Pasó la hora prometida y el resultado sigue sin estar listo | [R] |

- **Umbrales configurables, nunca fijos en código [R].** Se configuran por laboratorio, sucursal o tipo de estudio mediante la jerarquía de configuración **[A]** (ADR 0013).
- Valores iniciales propuestos, tomados del ejemplo del requisito (24 h, 12 h, 4 h, 2 h, 30 min): INFO a 24 h; WARNING a 12 h y 4 h; URGENT a 2 h y 30 min; OVERDUE al vencer **[P]** (D-08).
- Mensaje tipo **[R]**: "Resultado de Juan Pérez comprometido para hoy a las 3:00 PM y aún no está listo."
- Cada alerta se guarda con su nivel, su momento y su destinatario, y se reconoce o se escala con registro de auditoría **[A] [P]**.
- Las alertas no se duplican: un compromiso tiene una alerta activa por nivel, y cuando sube de nivel, la anterior se cierra **[P]**.

## 7. Prioridad operacional [R]

La calcula el backend a partir de:

- el tiempo restante;
- el estado del resultado;
- el TAT;
- el tipo de estudio;
- la prioridad clínica;
- el compromiso de entrega;
- el retraso.

Los pesos son configuración versionada **[A]**. Se presenta así:

| Nivel | Icono | Texto | Tono (Design System) |
| --- | --- | --- | --- |
| Entrega vencida | alerta | "Vencida" | critical |
| Entrega en riesgo | reloj | "En riesgo" | warning |
| Entrega próxima | calendario | "Próxima" | info |
| Lista para entregar | check | "Lista" | success (variante accesible) |

**Nunca solo color [R]:** la prioridad siempre lleva icono y texto. Se muestra con un componente `DeliveryRiskBadge` del Design System **[P]**.

La misma prioridad entra en la cola del Work Center como factor adicional de ordenamiento **[A]** (ADR 0014).

## 8. Vistas

| Vista | Contenido | Origen |
| --- | --- | --- |
| **Calendario de Entregas** | Hoy, mañana, semana, mes, fecha específica y **agenda** (lista cronológica continua; revisión CTO v2.1, D-26). Cada día muestra pacientes pendientes, resultados listos, por validar, atrasados y entregas realizadas | [R] [L] |
| **Entregas de Hoy** | Lista operacional: paciente, estudios, hora, estado y acción (Entregar, Ver estado, Priorizar, Escalar) | [R] [L] |
| **Pacientes para una fecha** | Al elegir una fecha: paciente, identificación, orden, estudios, sucursal, médico, fecha y hora prometidas, estado del resultado y de la entrega, canal, responsable y prioridad. Se agrupa en listos, pendientes, atrasados y ya entregados | [R] [L] |
| **Entregas en riesgo** | Compromisos WARNING y URGENT no listos, ordenados por prioridad operacional. Muestran el tiempo restante, la hora estimada de listo, el estudio que retrasa y la acción (Priorizar en Work Center, Escalar, Reprogramar, Avisar al paciente) | [L] · [P] columnas y acciones |
| **Entregas atrasadas** | Compromisos OVERDUE y los "listos con atraso" del período, con el atraso acumulado | [L] · [P] columnas |
| **Detalle del compromiso** | Estados, versiones, alertas, notificaciones, entrega confirmada y auditoría | [L] · [P] |

- **Filtros [R]:** fecha, sucursal, área, laboratorio, médico, responsable, estado, prioridad, tipo de estudio, canal de entrega y paciente. Se pueden guardar como vistas personales **[A]** (`workspace`).
- **Acciones del listado [R]:** Entregar, Ver estado, Priorizar y Escalar. Cada acción es un comando con permiso y auditoría **[A]**.
- **La información real proviene del backend [R].** El frontend no calcula estados, riesgos ni prioridades **[A]**.
- **Navegación [A]:** Operaciones → Calendario de Entregas, con la regla de 3 clics y `Ctrl + K`.

## 9. Confirmación de entrega [L]

Confirmar la entrega es un comando (`delivery.confirm`) que registra **[P]**:

- la fecha y hora real;
- el usuario que entrega;
- la sucursal;
- el canal;
- a quién se entrega (paciente, representante autorizado o médico);
- el método de verificación de identidad;
- la versión del documento entregada (enlace a `documents`);
- una constancia opcional (firma en pantalla o acuse del canal).

Reglas:

- Solo se entrega un informe liberado. Si hay resultados sin validar, el comando lo rechaza **[A]**.
- La entrega por un canal digital se confirma con el acuse técnico del canal: envío aceptado por el proveedor o descarga desde el portal. Si falla el envío, no hay DELIVERED **[P]**.
- Una entrega nunca se borra. Una entrega por error se revierte con un comando de corrección que exige motivo **[A]**.

## 10. Notificaciones [L]

| Destino | Qué | Cuándo | Origen |
| --- | --- | --- | --- |
| Personal (in-app) | Alertas INFO, WARNING, URGENT y OVERDUE al responsable, a la sucursal y al supervisor | Al cambiar de nivel | [R] [A] |
| Personal (escalamiento) | Aviso al supervisor cuando se escala o cuando pasa a OVERDUE | Configurable | [R] "Escalar" · [P] |
| Paciente | "Su resultado está listo" y "cambió la fecha de su resultado" | Al pasar a READY y al reprogramar | [P] (requiere consentimiento y canal autorizado) |

- Van por `notifications`: in-app desde F1; correo y WhatsApp desde F6 **[A]**.
- Los mensajes al paciente no incluyen valores clínicos. Solo informan que el resultado está disponible o que cambió la fecha. El envío de datos de salud a terceros sigue sujeto a R-11 **[A] [P]**.

## 11. Auditoría [L]

Todo cambio pasa por la tubería de comandos **[A]**, con actor, hora del servidor, sucursal, antes y después, motivo, IP, dispositivo y `request_id`. Esto incluye:

- crear un compromiso;
- cambiar fecha u hora;
- reprogramar;
- cancelar;
- asignar responsable;
- reconocer o escalar una alerta;
- confirmar o revertir una entrega;
- cambiar la configuración de umbrales y canales.

Las lecturas de datos sensibles (listas con pacientes) quedan en la auditoría de consulta **[A]**.

## 12. Métricas de cumplimiento [L]

Las calcula `analytics` a partir de eventos `delivery.*` **[A]**. Indicadores iniciales **[P]**:

- % de compromisos listos a tiempo (READY antes de la hora prometida);
- % entregados a tiempo;
- atraso promedio y máximo;
- número de OVERDUE;
- reprogramaciones y sus motivos;
- "listos no retirados";
- tiempo de listo a entregado.

Se desglosan por sucursal, área, tipo de estudio, responsable, canal y período. Igual que la productividad del Work Center, no se usan de forma automática como evaluación laboral **[A]**.

## 13. Integraciones

| Módulo | Qué aporta o recibe | Fase |
| --- | --- | --- |
| Orders | Crea el compromiso al registrar la orden (`orders.OrderRegistered`). Una orden anulada cancela sus compromisos | F6 (el compromiso nace con `delivery`; las órdenes de F3 lo reciben al activarse) |
| Patients | Identidad, contacto y consentimiento de canal; no se copian datos del paciente | F6 |
| Samples / Work Center | IN_PROGRESS por eventos de muestra. El riesgo de entrega entra en la prioridad de las worklists y en Mi Trabajo. "Priorizar" lleva al contexto de la muestra | F6 |
| Results / Validation | READY cuando todo el compromiso está validado. El estado del resultado se muestra junto al del compromiso | F6 |
| Documents | Versión del informe entregada | F6 |
| TAT Engine | Hitos y TAT esperado para la hora estimada de listo y el riesgo | F6 |
| Notifications | Alertas internas y avisos al paciente | F6 |
| Operations Center / Analytics | Panel de entregas del día, en riesgo y atrasadas; métricas de cumplimiento | F10 (antes de F10 se ven en el tablero de inicio y en Mi Trabajo) |
| Automation | Reglas sobre eventos `delivery.*`, por ejemplo "entrega en riesgo → WhatsApp al supervisor". El cálculo de riesgo y alertas sigue en `delivery` | F14 |
| Portals | Canal "portal" y confirmación por descarga | F16 |
| Audit | Todo lo anterior | F6 |

**Eventos [P]:**

- `delivery.CommitmentCreated`
- `delivery.CommitmentStarted`
- `delivery.CommitmentAtRisk`
- `delivery.CommitmentOverdue`
- `delivery.CommitmentReady`
- `delivery.CommitmentRescheduled`
- `delivery.CommitmentCancelled`
- `delivery.ResultDelivered`
- `delivery.DeliveryReverted`

**Permisos [P]:**

- `delivery.view`
- `delivery.commit`
- `delivery.reschedule`
- `delivery.cancel`
- `delivery.confirm`
- `delivery.escalate`
- `delivery.configure`

Todos llevan alcance por sucursal.

## 14. Modelo conceptual (sin tablas todavía)

Son nombres conceptuales para F6. **No se crean tablas, migraciones ni pantallas en el Freeze.**

| Concepto | Contenido |
| --- | --- |
| `delivery_commitments` | Compromiso vigente: orden, sucursal, responsable, canal, tipo, estado y prioridad calculada |
| `delivery_commitment_items` | Estudios cubiertos por el compromiso |
| `delivery_commitment_versions` | Historial de fechas prometidas y estimadas con motivo (reprogramaciones) |
| `delivery_alerts` | Alertas por nivel: apertura, reconocimiento, escalamiento, cierre |
| `delivery_confirmations` | Entregas confirmadas y reversiones |
| Configuración | Umbrales por nivel, pesos de prioridad, catálogo de canales y motivos de reprogramación (Configuration Engine) |

Todo lleva `laboratory_id`, RLS forzado y claves compuestas **[A]**.

## 15. Lo que queda abierto

| ID | Tema | Propuesta |
| --- | --- | --- |
| D-08 | Umbrales iniciales | INFO 24 h; WARNING 12 h y 4 h; URGENT 2 h y 30 min; OVERDUE al vencer (del ejemplo del requisito) |
| D-26 | Calendario Inteligente (revisión CTO) | Vista agenda y fecha sugerida por TAT, jornada, feriados y, como propuesta, carga del área |
| D-27 | Avisos al paciente | Por el Centro de Comunicación: plantillas sin valores clínicos y consentimiento por canal |
| D-21 | Entregas parciales (entregar unos estudios antes que otros) | Permitidas si el laboratorio lo habilita: el compromiso se divide en dos, cada uno con su historial |
| — | Texto original desde "Entregas en riesgo" | Si existe, compararlo con este documento y ajustar |
