# Work Center — arquitectura consolidada

**Estado:** propuesta, dentro del Architecture Freeze · 27 de septiembre de 2026 · ADR [0014](../adr/0014-work-center-sample-centric.md) (Propuesta)
**Módulos:** `workcenter` (dueño), con `samples`, `results`, `rules-engine`, `validation`, `delivery`, `integrations` y `analytics`
**Fases:** F4 (Foundation) · F5 (Operations) · F6 (resultados y validación) · F10 (productividad) · F17+ (equipos e IA)

## Trazabilidad

| Marca | Origen |
| --- | --- |
| **[W]** | Documento "WORK CENTER Y FLUJO OPERATIVO INTELIGENTE DEL BIOANALISTA", secciones 1–28, y el inicio de la 29 |
| **[M]** | Especificación maestra, secciones 29–34 (sample-centric, centros, prioridades, áreas, resultados, TAT) |
| **[L]** | Tu lista del 27/09/2026 ("Completar Work Center") |
| **[A]** | Arquitectura ya establecida: pipeline, auditoría, Configuration Engine, Design System, Delivery Calendar |
| **[P]** | Propuesta mía; necesita tu aprobación |

El documento original se corta en la sección 29, "Principio de menos clics", justo después de tres preguntas:

- ¿Cuántos clics necesita actualmente?
- ¿Cuántas pantallas?
- ¿Cuántos campos?

**No se infirió texto adicional.** La sección 29 se completa haciendo exactamente el análisis que esas preguntas piden, sobre las operaciones que ya define el documento (sección 12 de este archivo). No se agregan requisitos nuevos.

---

## 1. Principio

> "El bioanalista no debe hacer manualmente algo que MicroSlab pueda hacer automáticamente de forma segura." **[W]**

- **MicroSlab automatiza:** clasificación, área, worklist, priorización, cálculos, fórmulas, unidades, rangos, altos y bajos, críticos, delta check, TAT, alertas, seguimiento, auditoría y preparación para la validación **[W]**.
- **El bioanalista:** procesa, revisa, confirma, repite, resuelve inconsistencias y valida según sus permisos **[W]**.

## 2. Sample-centric y multi-centro

- La unidad de trabajo es la **muestra** y la tarea sobre ella. El paciente es contexto **[M]**.
- **Flujo [M]:** Sample Received → Identification → Area Classification → Priority → Worklist → Processing → Result → Rules / Formulas / Delta → Review → Technical Validation → Professional Validation → Delivery → Audit.
- **Centros iniciales [M]:** Reception, Phlebotomy, Laboratory, Validation, Imaging, Cash, Home Laboratory y Quality. Se pueden crear más.
- **Formas de trabajar [W]:** por área, sección, turno, bioanalista, equipo, tipo de muestra, prioridad, estado, fecha y TAT.

## 3. Mi Trabajo [W]

Es la pantalla de llegada del bioanalista. No empieza buscando pacientes. Muestra contadores de:

- pendientes;
- en proceso;
- requieren revisión;
- repeticiones;
- críticos;
- fuera de TAT;
- pendientes de validación;
- procesados hoy.

**Continuar trabajando** recuerda la última worklist, la vista, la muestra y el campo, mediante `workspace` **[A]**.

**Integración con el Delivery Calendar [L]:** Mi Trabajo muestra "Entregas en riesgo que dependen de mí", es decir, los compromisos WARNING, URGENT u OVERDUE cuyas muestras están en sus worklists. Cada uno tiene un enlace directo a la muestra **[A]**.

## 4. Worklists [W]

- Hay una worklist por área. Las áreas iniciales son las de la especificación maestra (Hematology … Blood Bank, Imaging) y cada laboratorio puede crear las suyas **[W] [M]**.
- **El motor es común; la experiencia se adapta por área [W]:**
  - Hematología: tabla de parámetros.
  - Química: unidades, referencias y delta.
  - Uroanálisis: resultados estructurados y microscopía.
  - Microbiología: cultivo → incubación → lectura → identificación → antibiograma → preliminar → definitivo.
  - Inmunología: cuantitativo y cualitativo.
  - Hormonas: referencias por edad, sexo, estado y otros.
  - Imágenes: realización → imágenes → informe → validación.
- **Worklist por equipo [W]:** preparada para Roche/Cobas, Sysmex, Mindray, Abbott y otros vía ASTM, HL7, API, archivos o middleware. El conector llega en F17+ (ADR 0018).

## 5. Prioridades [W] [M]

- Niveles: Critical, Urgent, TAT Soon, Delayed y Normal.
- Orden por defecto: Crítico → Urgente → TAT próximo → Retrasada → Normal.
- El algoritmo es configurable por laboratorio. **Nada queda fijo en código.**
- **Integración con el Delivery Calendar [A]:** el riesgo de entrega se suma como factor configurable. A igual prioridad clínica, se procesa primero la muestra cuyo compromiso vence antes.

## 6. Contexto de la muestra [W]

Al escanear o seleccionar una muestra se abre un solo contexto, sin navegar por módulos. Contiene:

- **Paciente:** edad y sexo.
- **Muestra:** código, tipo, toma, recepción, TAT, prioridad y médico.
- **Estudios.**
- **Resultados:** actual, anterior, referencia y estado.
- **Compromiso de entrega:** hora prometida y nivel de riesgo **[L] [A]**.

## 7. Resultados: captura manual y automática [W] [M]

- **Origen**, siempre guardado:
  - manual;
  - automático (equipo o integración);
  - calculado (fórmula);
  - derivado;
  - corregido.
- **Entrada masiva (prioritaria) [W]:** funciona como una hoja de cálculo con lógica clínica. Admite:
  - Tab, Enter y flechas;
  - copiar y pegar;
  - entrada numérica y cualitativa;
  - autosave;
  - guardado por lote;
  - deshacer controlado;
  - comentarios;
  - repetición;
  - "pendiente".

  Copiar, pegar o editar en masa **nunca** salta las reglas de seguridad ni de auditoría **[W]**.
- **Fórmulas [W]:** LDL, VLDL, índices hematológicos, BMI, relación albúmina/creatinina y fórmulas propias. Viven en el motor de fórmulas (`packages/expressions`, evaluador seguro), nunca en el frontend.
- **Delta check [W]:**
  - muestra el valor anterior y el cambio porcentual;
  - genera "Requiere revisión";
  - **nunca modifica el resultado**;
  - es configurable por parámetro.
- **Críticos [W]:**
  - se detectan de forma automática y se marcan con alerta visual;
  - la muestra entra en la lista de críticos;
  - se registran la revisión según reglas, el usuario, la hora, la notificación, el medio y la confirmación;
  - hay una vista "Resultados críticos".
- **Repeticiones [W]:**
  - registran el parámetro, el valor original, el usuario, la hora, el motivo, el nuevo valor, quién repitió y el valor definitivo;
  - **nunca sobrescriben el original**.
- **Correcciones [M]:** nunca destruyen el valor anterior. Queda el historial completo.

## 8. Validación [W] [M]

- **Técnica y profesional:** son pasos separados, con permisos distintos, individuales o por lote, y con reautenticación cuando el laboratorio la exige **[A]**.
- **Estados [W]:** borrador → guardado → final → validado. El autosave **nunca** es validación.
- **Quality V1 mínimo [A]:** el IQC básico puede bloquear la liberación de la corrida afectada, si el bloqueo está configurado.

## 9. TAT Engine [W] [M]

- Registra los hitos: toma, recepción, procesamiento, resultado, validación y entrega.
- Compara el TAT esperado con el real. El SLA se define por estudio y prioridad.
- Estados: Normal, Próximo a vencer y Vencido, con alertas.
- Alimenta la hora estimada de listo del Delivery Calendar **[A]**.

## 10. Código de barras [W]

Flujo al escanear el tubo:

1. Se identifica la muestra.
2. Se abre la worklist.
3. Se muestran el paciente, los estudios, el área, la prioridad y el estado.

Está preparado para lectores USB, cámara, QR y equipos automatizados.

## 11. Supervisor, filtros, atajos, vistas y auditoría

- **Supervisor [W]:**
  - ve el trabajo por bioanalista: pendientes, críticos, repeticiones, fuera de TAT, productividad, pendientes de validación e incidencias;
  - reasigna trabajo con permiso;
  - ve **entregas en riesgo por área** **[A]**.
- **Filtros [W]:**
  - área, sección, fecha, turno, bioanalista, estado, prioridad, tipo de muestra, estudio, perfil, médico, paciente, orden, código, equipo, crítico, repetición y fuera de TAT;
  - riesgo de entrega **[A]**.
- **Vistas guardadas [W]:** por ejemplo "Mis críticos", "Pendientes de hoy", "Química urgente" o "Fuera de TAT", guardadas en `workspace`.
- **Atajos configurables [W]:** Tab, Enter, ↑ ↓, Ctrl + S, R (repetición), C (comentario), V (marcar para validación) y Esc. Cada atajo ejecuta **el mismo comando, con los mismos permisos y la misma auditoría**, que el clic.
- **Auditoría [W]:** usuario, fecha y hora, IP, dispositivo, muestra, valor anterior y nuevo, acción y motivo. Se audita especialmente:
  - crear, modificar, cancelar;
  - repetir;
  - validar, rechazar;
  - marcar y notificar críticos;
  - reasignar;
  - cambiar de estado.
- **Productividad [W]:** muestras por hora, resultados por hora, tiempos, TAT, repeticiones, automáticos frente a manuales, intervenciones y fuera de TAT. Llega en F10 con `analytics`. **No se usa automáticamente como evaluación laboral negativa.**

## 12. Principio de "Menos clics" — sección 29 completada

El documento pide evaluar, para cada operación importante, cuántos clics, pantallas y campos necesita. Así se lee la tabla:

- La columna **Actual** es una estimación sobre el diseño del PDF/Figma (no hay sistema medido). Es la misma estimación que ya estaba en la arquitectura, sección 21, ampliada a todas las operaciones del documento.
- La columna **Objetivo** es **[P]**. Se valida con una prueba de uso en F5 y F6 contra la regla maestra de **3 clics como máximo** **[M]**.

| # | Operación (del documento) | Actual: clics / pantallas / campos | Objetivo: clics / pantallas / campos | Cómo se logra |
| --- | --- | --- | --- | --- |
| 1 | Empezar el turno y ver qué hacer | Buscar paciente: 3–4 / 2 / 1 | 0 / 1 / 0 | Mi Trabajo es la pantalla de llegada; "Continuar trabajando" |
| 2 | Recibir una muestra | Lista, modal, estado: ~4 / 2 / 1–2 | 0 / 1 / 0 | Escanear en modo recepción; hora y usuario automáticos |
| 3 | Abrir el contexto de una muestra | Buscar y abrir: ~3 / 2 / 1 | 0 / 1 / 0 | Escanear el tubo (sección 10) |
| 4 | Ingresar los resultados de una muestra | Abrir, escribir, guardar, cerrar: ~6 / 2 / n parámetros | 0 / 1 / n | Tab/Enter; fórmulas, unidades y rangos automáticos; Ctrl + S |
| 5 | Ingresar 20 muestras de hematología | Lo anterior × 20: ~120 / 40 / 20 × n | 1 / 1 / 20 × n | Entrada masiva por teclado; autosave; un guardado por lote |
| 6 | Revisar un delta check | Buscar histórico en otra pantalla: ~4 / 2 / 0 | 0 / 1 / 0 | Anterior y % de cambio en la misma fila |
| 7 | Solicitar repetición | No definido | 1 (tecla R) / 1 / 1 (motivo) | Diálogo en línea; valor original conservado |
| 8 | Notificar un crítico | No existe en el diseño | 2 / 1 / 3 (a quién, medio, confirmación) | Diálogo en la misma fila; médico precargado; hora automática |
| 9 | Validación técnica de un lote | Abrir y validar cada paciente: 2 × muestras | 2 / 1 / 0 (+ reautenticación si aplica) | Selección múltiple + Validar |
| 10 | Validación profesional de un lote | Igual que el anterior | 2 / 1 / 0 (+ reautenticación) | Selección múltiple; críticos y deltas pendientes bloquean la selección |
| 11 | Aplicar una vista de trabajo | Filtros cada vez: 4–6 / 1 / varios | 1 / 1 / 0 | Vistas guardadas |
| 12 | Reasignar trabajo (supervisor) | No definido | 2 / 1 / 1 (destino) | Selección + Reasignar; motivo si se configura |
| 13 | Ver y atender una entrega en riesgo | No existe | 1 / 1 / 0 | Aviso en Mi Trabajo → contexto de la muestra con prioridad ajustada |
| 14 | Pasar de una muestra a la siguiente | Cerrar y buscar: ~3 / 2 / 1 | 0 (Enter) / 1 / 0 | Enter → siguiente muestra de la worklist |

Reglas de diseño que salen de este análisis **[P]**, todas dentro de lo que ya pide el documento:

- **Escaneo primero:** el código de barras reemplaza la búsqueda en recepción, en el contexto y en la entrada de resultados.
- **Teclado primero:** toda operación frecuente tiene un atajo, y el atajo es el mismo comando.
- **Una pantalla por tarea:** los diálogos se abren en la fila o en un drawer, nunca en cadenas de modales.
- **Campos derivados, no digitados:** hora, usuario, sucursal, unidades, rangos, fórmulas y médico se precargan desde el contexto.
- **Acciones por lote** donde el documento las pide: entrada masiva y validación.
- **Seguridad sin atajos:** menos clics nunca quita permisos, motivos, reautenticación ni auditoría **[W]**.

## 13. IA como asistente, nunca como validador [W] [A]

- **Clinical AI puede:** resumir el historial, detectar patrones, señalar inconsistencias, explicar alertas, priorizar revisiones, detectar posibles errores de digitación y comparar con el histórico.
- **Nunca valida un resultado por sí sola.** La decisión es del profesional autorizado.
- **Rule Engine y AI Engine están separados [W]:**
  - el Rule Engine es determinista (por ejemplo, "glucosa > X → alerta");
  - la IA es asistencial y probabilística.
- Sin envío de datos de pacientes a proveedores externos hasta D-15. La IA llega en F17+.

## 14. Arquitectura: subdominios del documento → módulos [W §25]

| Subdominio pedido | Módulo dueño | Fase |
| --- | --- | --- |
| /work-center, /worklists, /work-center-config | `workcenter` | F4 |
| /sample-workflow | `samples` (estados) + `workcenter` (colas) | F3 · F5 |
| /tat-monitor | `workcenter` (TAT Engine) | F5 |
| /result-entry, /repetitions | `results` | F6 |
| /result-review | `validation` | F6 |
| /critical-results, /delta-check | `rules-engine` (detección) + `results` (eventos y notificación) | F6 |
| /equipment-worklists | `integrations` + app `connector` | F17+ |
| /work-center-analytics | `analytics` | F10 |

No se duplica lógica. Rangos, críticos y delta son del Rule Engine; las fórmulas son del motor de expresiones; las colas son de `workcenter` **[W]**.

## 15. Modelo conceptual [W §26] (sin tablas todavía)

| Concepto del documento | Nombre en MicroSlab | Módulo |
| --- | --- | --- |
| WorkCenters | `work_centers` | `workcenter` |
| Worklists · WorklistItems · WorklistAssignments | `worklists` · `worklist_items` · `worklist_assignments` | `workcenter` |
| WorklistViews | `saved_views` | `workspace` |
| WorklistRules · WorklistPriorities | `worklist_rules` · `priority_policies` (configuración versionada) | `workcenter` |
| SampleWorkflowStates | `sample_status_history` | `samples` |
| TATEvents | `tat_events` | `workcenter` |
| ResultDrafts · ResultEntries · ResultSources | `result_drafts` · `result_values` (versionados, con `source`) | `results` |
| ResultRepetitions | `result_repetitions` | `results` |
| CriticalResultEvents · CriticalResultNotifications | `critical_result_events` · `critical_result_notifications` | `results` |
| DeltaChecks | `delta_check_evaluations` | `rules-engine` |
| EquipmentMappings | `equipment_test_mappings` | `integrations` |

**No se crean tablas, migraciones ni pantallas en el Freeze.**

## 16. Pantallas [W §28]

Pantallas del documento:

1. Mi Trabajo
2. Work Center
3. Worklist por área
4. Worklist por equipo
5. Entrada masiva
6. Vista de muestra
7. Críticos
8. Delta check
9. Repeticiones
10. Fuera de TAT
11. Validación técnica
12. Validación profesional
13. Supervisor
14. Configuración de worklists
15. Configuración de prioridades
16. Configuración de reglas
17. Vistas guardadas
18. Historial y auditoría de la muestra

Cada una incluye los estados normal, vacío, carga, error, éxito, alertas, permisos insuficientes y responsive **[W]**, con el Design System **[A]**.

## 17. Fases

| Fase | Contenido |
| --- | --- |
| F4 Work Center Foundation | Centros, worklists, ítems, asignaciones, políticas de prioridad, vistas guardadas, estructura de Mi Trabajo |
| F5 Work Center Operations | Recepción por escaneo, contexto de muestra, TAT Engine, supervisor, turnos, reasignación, centro de Calidad (registros V1) |
| F6 Resultados y validación | Entrada individual y masiva, autosave, fórmulas, delta, críticos, repeticiones, validación técnica y profesional, integración con el Delivery Calendar |
| F10 | Productividad y Operations Center |
| F17+ | Worklists por equipo (conector) y Clinical AI |
