# MICROSLAB 3.0 Enterprise — Architecture Freeze Report v2.1 (pre-F1)

**Estado:** v2.1 — APROBADO CON OBSERVACIONES por revisión CTO; observaciones integradas; **pendiente de aprobación final** · 27 de septiembre de 2026

Historial:

- **v1:** informe inicial.
- **v2:** Calendario de Entregas y Work Center completos, D-01 a D-04 analizadas, roadmap F0–F7B.
- **v2.1:** D-01 a D-04 aprobadas, fase F7C Piloto Controlado, decisiones D-23 a D-34 y Operations Center ampliado.
**Frase de aprobación requerida:** `ARCHITECTURE FREEZE APPROVED — START F1`

Este informe consolida la especificación maestra *MICROSLAB 3.0 ENTERPRISE — Master Architecture Freeze* con la arquitectura ya
documentada (documento *MICROSLAB 3.0 — Arquitectura definitiva*, paquete de diseño pre-F1, Design System 1.0) y con el código de
F0 de este repositorio. Donde la especificación maestra y lo existente difieren, gana la especificación maestra salvo que una
dependencia técnica lo impida; esos casos se señalan como contradicción con una propuesta y quedan para tu aprobación.

Nada de este informe es código funcional, migración, tabla ni pantalla. El código de F0 no se modificó.

## Resumen para decidir

| Tema | Resultado |
| --- | --- |
| Principios innegociables | Se conservan todos los de F0 y se agregan multi-moneda, multi-idioma y observabilidad como preparación obligatoria |
| Contradicciones encontradas | 26 (sección 0): 19 resueltas aplicando la especificación maestra, 7 con propuesta que necesita tu decisión (C-13, C-15, C-17, C-25, C-26 y las decisiones D-01 a D-04) |
| Módulos | 55 propuestos (38 registrados en F0 + 11 ya documentados + 6 nuevos), `einvoicing` interno y no visible |
| Roadmap | Orden de la especificación maestra con ajustes por dependencia (catálogo y ARS en F3; PDF y entregas en F6; F7B V1 Readiness; **F7C Piloto Controlado de 2 semanas**; Puerta V1 al cerrar F7C) |
| Decisiones | D-01 a D-04 **aprobadas** (sección 35.4). D-23 a D-34 nuevas, de la revisión CTO, con propuesta (sección 35.3). D-05 en adelante en la sección 35.2. D-12 y D-13 cerradas |
| Operations Center | Responde automáticamente indicadores operativos, clínicos, financieros, de calidad, inventario, RR. HH. y entrega de resultados (sección 23.1) |
| ADR | 0001–0004 aprobadas (adendas de 0001 y 0003 propuestas). 0005–0030 en estado **Propuesta**; 0025–0030 son nuevas en v2.1 |
| Documentos de detalle | [Calendario de Entregas](RESULT_DELIVERY_CALENDAR.md) · [Work Center](WORK_CENTER.md) |

---

## 0. Contradicciones entre la arquitectura existente y la especificación maestra

| ID | Tema | Arquitectura existente | Especificación maestra | Resolución |
| --- | --- | --- | --- | --- |
| C-01 | Nombre del plan gratuito | "Start" (RD$0 + 2 %) | "FREE" (RD$0 + 2 %) | Se adopta FREE; el nombre es configurable (D-02 confirma) |
| C-02 | Período de gracia | Pendiente de decisión | 5 días calendario, luego SUSPENDED | Adoptado |
| C-03 | Estados de suscripción | Estados de cuenta sin enumerar | ACTIVE, GRACE_PERIOD, SUSPENDED, CANCELLED | Adoptado |
| C-04 | Suspensión | Sin reglas sobre acceso clínico | No bloquea resultados, historial ni continuidad clínica | Adoptado; nueva etapa en la tubería de comandos (sección 7) |
| C-05 | e-CF visible como módulo | "Facturación electrónica" en el sidebar de Finanzas y monitor propio | `einvoicing` interno; el usuario ve **Caja y Facturación** con pestañas; Mantenimiento Fiscal solo para roles autorizados | Adoptado; se corrige la navegación |
| C-06 | Estados fiscales | Un solo estado por documento | Separar estado fiscal interno y estado externo (DGII/proveedor) | Adoptado: dos campos y un mapeo versionado |
| C-07 | Contingencias fiscales | A (conectividad) y B (imposibilidad técnica con comprobante no electrónico) | Connectivity Contingency y Technical Contingency, más Reconciliation Center y Emergency Mode | Adoptado; B se renombra Technical y el comprobante no electrónico queda solo si la norma y una declaración lo permiten |
| C-08 | Permisos fiscales | `einvoicing.issue`, `.void_unused`, `.declare_contingency_b`… | Lista de 10 permisos de la especificación | Se adopta la lista maestra y se conservan los adicionales necesarios (sección 30) |
| C-09 | Mantenimiento Fiscal | Configuración, rangos y monitor dispersos | Módulo interno con configuración, certificados, monitor, cola, rechazados, reconciliación, secuencias, diagnóstico, emergencia | Adoptado (sección 15) |
| C-10 | Proveedores fiscales | Adaptador "DGII directo o proveedor, a decidir" | Abstracción para DGII Direct, Sandbox, Provider A, Provider B y futuros | Adoptado; el primero en implementarse es D-03 |
| C-11 | Roadmap: F0 | F0 = fundaciones (ya construidas y probadas) | F0 = Architecture Freeze | F0 queda como "Fundaciones + Architecture Freeze"; lo construido no se rehace |
| C-12 | Roadmap: seguridad y core | Usuarios, roles, MFA y configuración en F1 | F1 seguridad y fundaciones; F2 tenants, sucursales, usuarios, roles, permisos | Adoptado: F1 = seguridad técnica (autenticación, MFA, sesiones, AppShell); F2 = administración del core |
| C-13 | Roadmap: catálogo clínico y ARS | F2 catálogo, F3 pacientes y ARS | No aparecen antes de F3 | **Propuesta:** F3 incluye catálogo y ARS porque una orden no existe sin estudios ni coberturas |
| C-14 | Roadmap: Caja | F4, antes de muestras y resultados | F7, después de resultados | Adoptado; mientras tanto las órdenes existen sin cobro en ambientes de prueba |
| C-15 | Roadmap: PDF, entrega, QR | F7 | QR/portales en F16; PDF y entrega sin fase explícita | **Propuesta:** PDF clínico, verificación QR mínima, registro de entregas y Result Delivery Calendar en F6, porque el flujo clínico no cierra sin ellos |
| C-16 | Calidad para V1 | Decisión pendiente (sección 13 del paquete pre-F1) | V1 exige IQC básico, temperaturas, incidentes de bioseguridad, SOP críticos y tablero básico | Contenido adoptado de la especificación; ADR 0010 sigue en **Propuesta** hasta tu aprobación |
| C-17 | Ubicación de la Puerta V1 | Tras F10 (consola SaaS) | No se indica | **Propuesta:** fase F7B "V1 Readiness" y Puerta V1 al cerrarla (D-01) |
| C-18 | HR | Puestos dentro de `training` (calidad) | Dominio HR propio | Adoptado: `hr` es dueño de empleados, puestos, departamentos y contratos; `training` usa sus datos (D-04 confirma el reparto) |
| C-19 | Analytics y BI | Un solo módulo `analytics` | Separados | Adoptado: `analytics` (operación) y `bi` (dirección) |
| C-20 | IA | Módulo `ai` | Dominio `clinical-ai`, nunca "Copilot" | Adoptado: se renombra en el registro |
| C-21 | Work Center | Centrado en el bioanalista | Sample-centric y multi-centro (8 centros) | Adoptado: el Work Center pasa a ser el motor de colas de todos los centros |
| C-22 | Offline | Operacional frente a fiscal | Operational Offline, Fiscal Contingency, Network Failure, Technical Failure | Adoptado (sección 26) |
| C-23 | Design System | Valores de Figma con contraste señalado | Figma es la fuente visual; si choca con accesibilidad, gana accesibilidad | Adoptado: variante accesible del botón de confirmación (sección 31) |
| C-25 | Dónde se construye Quality V1 mínimo | Revisión 1 de este informe: dentro de F7B | F7B debe ser preparación, no una fase funcional grande (tu revisión del 27/09) | **Propuesta (cambio de fase señalado):** registros de temperatura, incidentes de bioseguridad y SOP críticos en F5 (centro Quality del Work Center); IQC básico con bloqueo de liberación y tablero básico en F6 |
| C-26 | Dónde se construye la consola Super Admin de V1 | Revisión 1: dentro de F7B | Mismo motivo | **Propuesta (cambio de fase señalado):** provisión, suscripción y acceso de soporte en F2; billing, comisiones y Mantenimiento Fiscal de plataforma en F7 |
| C-24 | Registro de módulos en código | `packages/contracts/src/modules.ts` registra 38 módulos con fases antiguas | 55 módulos y roadmap nuevo | Se actualiza en el primer commit de F1, después de la aprobación; no se toca ahora |

---

## 1. Architecture overview

MicroSlab 3.0 es un **monolito modular multi-tenant**: un backend NestJS sobre un kernel sin framework, PostgreSQL 16 con
Row-Level Security forzado, una tubería única de comandos con auditoría encadenada y outbox transaccional, colas BullMQ para el
trabajo asíncrono, y aplicaciones React + Vite separadas por audiencia.

```
apps/
  api/             Backend: kernel + módulos + adaptador NestJS (HTTP) + worker
  web/             App del personal del laboratorio
  console/         Super Admin (plataforma)
  verify/          Verificación pública de QR
  patient-portal/  Portal del paciente (autenticación propia)
  doctor-portal/   Portal del médico (autenticación propia)
  connector/       Conector local de equipos y nodo fiscal de contingencia
packages/
  contracts/       Registro de módulos, permisos, errores, esquemas y contratos de API
  ui/ expressions/ domain-types/ testing/   (preparados)
infra/db/          Migraciones SQL, bootstrap de roles, pruebas de base de datos
tools/             Generador y verificador de fronteras de módulos
docs/adr/          Decisiones de arquitectura
docs/architecture/ Este informe
```

Se conservan sin cambios las decisiones de F0 que la especificación pide mantener: PostgreSQL, RLS forzado, auditoría inmutable
encadenada por laboratorio, outbox, idempotencia, secuencias, tubería de comandos, registro de módulos, verificador de fronteras,
adaptador NestJS y kernel independiente de la infraestructura (ADR 0001–0004).

Preparación obligatoria que se agrega al marco (sin implementarla ahora):

- **Multi-moneda:** todo monto se modela como `amount` + `currency` (ISO 4217); moneda por defecto por laboratorio; tasas de cambio como datos versionados con fuente.
- **Multi-idioma:** textos de interfaz por clave (`es-DO` por defecto); formatos de fecha, número y moneda por `locale` del laboratorio y del usuario.
- **Observabilidad:** logs estructurados con `request_id` (ya en F0), métricas, trazas y salud de colas (sección 36 de riesgos y ADR 0003).

## 2. Domain map

| Dominio | Qué resuelve | Módulos |
| --- | --- | --- |
| Core | Identidad, organización, configuración y trazabilidad | `platform`, `security`, `configuration`, `audit`, `notifications`, `search`, `workspace`, `approvals` |
| Clinical | Del paciente al resultado entregado | `catalog`, `rules-engine`, `patients`, `orders`, `samples`, `results`, `validation`, `documents`, `workcenter`, `delivery` |
| Commercial | Cobro, crédito, compras y costos | `cashier` (Caja y Facturación), `receivables`, `insurance`, `expenses`, `budgets`, `purchasing`, `suppliers`, `payables`, `inventory`, `costing` |
| Fiscal (interno) | Documentos fiscales electrónicos | `einvoicing` (no visible como módulo principal) |
| Operations | Agenda y servicios fuera del flujo central | `scheduling` (Agenda Enterprise), `imaging`, `home-collection`, `logistics` |
| Quality | Calidad, cumplimiento y documentación controlada | `doccontrol`, `quality` (IQC/EQC), `logbooks`, `biosafety`, `equipment`, `reagents`, `training`, `internal-audits`, `capa`, `compliance` |
| HR | Personal y estructura | `hr` |
| Builders | Construcción configurable sin programar | `reports` (Report Builder), `forms` (Form Builder), `documents` (PDF y Label Builder), `catalog` (Study y Profile Builder) |
| Intelligence | Medición, dirección, asistencia y automatización | `analytics`, `bi`, `clinical-ai`, `automation`, `voice` |
| Communication | Canales | `notifications` (WhatsApp, email, SMS), `integrations` (webhooks) |
| External | Terceros y público | `portals`, `integrations` (API pública, conector de equipos); apps `verify`, `patient-portal`, `doctor-portal`, `connector` |
| SaaS | Negocio de MicroSlab | `platform` (Super Admin), `billing` (Subscription + Billing Engine), `commissions` |

## 3. Module map

55 módulos en el registro. **Nuevo** = no existe en el registro de F0; se registra como esqueleto en el primer commit de F1.

| Módulo | Dominio | Estado en el registro | Fase propuesta |
| --- | --- | --- | --- |
| `platform` | Core / SaaS | F0 | F2 (provisión, suscripción, acceso de soporte) · F7 (billing y comisiones en consola) |
| `security` | Core | F0 | F1 |
| `configuration` | Core | F0 | F1 (Configuration Engine) · F2 (sucursales) |
| `audit` | Core | F0 (motor listo) | F1 (visor) |
| `notifications` | Core / Communication | F0 | F1 (in-app) · F6 (email, WhatsApp) |
| `search` | Core | Nuevo (documentado) | F1 |
| `workspace` | Core | Nuevo (documentado) | F1 |
| `approvals` | Core | F0 | F8 |
| `catalog` | Clinical / Builders | F0 | F3 |
| `rules-engine` | Clinical | F0 | F3 (definición) · F6 (evaluación, críticos, delta) |
| `patients` | Clinical | F0 | F3 |
| `orders` | Clinical | F0 | F3 |
| `samples` | Clinical | F0 | F3 (toma e identificación) · F5 (recepción, custodia) |
| `results` | Clinical | F0 | F6 |
| `validation` | Clinical | F0 | F6 |
| `documents` | Clinical / Builders | F0 | F6 (PDF clínico, QR) · F15 (PDF y Label Builder) |
| `workcenter` | Clinical / Operations | F0 | F4 · F5 |
| `delivery` | Clinical | **Nuevo** | F6 (registro de entregas y Result Delivery Calendar) |
| `cashier` | Commercial (Caja y Facturación) | F0 | F7 |
| `einvoicing` | Fiscal interno | Nuevo (documentado) | F7 |
| `receivables` | Commercial | F0 | F7 |
| `insurance` | Commercial | F0 | F3 (coberturas) · F7 (reclamaciones y glosas) |
| `commissions` | SaaS | F0 | F7 |
| `billing` | SaaS | F0 | F2 (estado de suscripción) · F7 (Billing Engine) |
| `inventory` · `suppliers` · `purchasing` · `payables` | Commercial | F0 | F8 |
| `expenses` · `budgets` | Commercial | F0 | F8 (gastos, centros de costo) · F17+ (presupuestos) |
| `costing` | Commercial | F0 | F17+ |
| `scheduling` | Operations | F0 | F9 (Agenda Enterprise) |
| `imaging` | Operations | F0 | F9 (agenda de imágenes) · F17+ (informes) |
| `home-collection` | Operations | F0 | F17+ |
| `logistics` | Operations | **Nuevo** | F17+ (transporte de muestras entre sucursales) |
| `analytics` | Intelligence | F0 | F10 (Operations Center y analítica operativa) |
| `bi` | Intelligence | **Nuevo** | F17+ |
| `doccontrol` · `logbooks` · `quality` · `biosafety` | Quality | Documentados; `biosafety` **nuevo** | F5–F6 (mínimo V1) · F11 · F13 |
| `training` · `internal-audits` · `capa` · `compliance` · `equipment` · `reagents` | Quality | Documentados | F11 · F13 |
| `hr` | HR | **Nuevo** | F12 |
| `automation` | Intelligence | **Nuevo** | F14 |
| `reports` · `forms` | Builders | F0 | F7 (reportes base) · F15 (builders) |
| `clinical-ai` | Intelligence | F0 como `ai` (se renombra) | F17+ |
| `voice` | Intelligence | F0 | F17+ |
| `integrations` | External | F0 | F16 (API y webhooks) · F17+ (equipos) |
| `portals` | External | F0 | F16 |

El **Operations Center** es una superficie de la app web sobre `analytics`. Responde indicadores operativos, clínicos, financieros, de calidad, inventario, RR. HH. y entrega de resultados (sección 23.1). No tiene tablas propias salvo sus diseños guardados en `workspace`.

Las capacidades D-23 a D-34 no agregan módulos: cada una tiene un dueño ya registrado (sección 35.3). El total sigue en **55**.

## 4. Dependency graph

Una flecha significa "depende de". Los módulos se comunican por comandos públicos y eventos del outbox; nunca por tablas ajenas.

```mermaid
flowchart TB
  subgraph Kernel
    K[kernel: tenancy, comandos, auditoría, outbox, secuencias, esign]
  end
  subgraph Core
    SEC[security] --> K
    CFG[configuration] --> K
    PLT[platform] --> K
    BIL[billing: suscripción] --> PLT
    SEA[search] --> K
    WSP[workspace] --> SEC
    NOT[notifications: Centro de Comunicación] --> CFG
  end
  subgraph Clinical
    CAT[catalog: estudios, tubos, lista de materiales] --> CFG
    INS[insurance] --> CAT
    PAT[patients] --> CFG
    ORD[orders] --> PAT & CAT & INS
    SMP[samples: tubos y cadena de custodia] --> ORD
    WC[workcenter: Mi Trabajo, worklists, TAT] --> SMP
    RUL[rules-engine: críticos, delta, reglas deterministas] --> CAT
    RES[results] --> WC & RUL
    VAL[validation] --> RES
    DOC[documents: PDF, etiquetas] --> VAL
    DEL[delivery: Calendario de Entregas] --> DOC & ORD & WC
    DEL --> NOT
    RES --> NOT
  end
  subgraph Commercial
    CSH[cashier: Caja y Facturación] --> ORD & INS
    EINV[einvoicing interno + FiscalGateway] --> CFG
    CSH --> EINV
    AR[receivables] --> CSH
    COM[commissions] --> CSH & BIL
    INV[inventory: kits, consumo por perfil] --> CAT
    INV -. consume eventos de resultado .-> RES
  end
  subgraph Quality
    QC[quality IQC] --> CAT
    VAL -. consulta política de liberación .-> QC
    DC[doccontrol] --> K
    LOG[logbooks] --> CFG
    BIO[biosafety] --> LOG
    EQ[equipment: mantenimiento preventivo] --> LOG
    WC -. consulta bloqueo de equipo .-> EQ
    CMP[compliance: Dashboard Regulatorio] --> DC
  end
  HR[hr: personal, turnos y guardias] --> SEC
  WC -. lee turnos desde F12 .-> HR
  TRN[training] --> HR & DC
  AI[clinical-ai: solo sugiere] -. lee proyecciones .-> K
  AUT[automation] -. escucha eventos de todos .-> K
  AN[analytics + Operations Center] -. lee proyecciones .-> K
```

Reglas del grafo:

- **Sin ciclos.** Las dependencias punteadas son consultas por interfaz pública, o consumo de eventos, en una sola dirección:
  - `validation` consulta la política de liberación de `quality`;
  - `workcenter` consulta el bloqueo de equipos a `equipment` y lee turnos de `hr`;
  - `inventory` consume eventos de `results`.
  
  Ninguno de los consultados conoce a quien consulta.
- `clinical-ai` nunca escribe estados clínicos. `rules-engine` es la única autoridad determinista (ADR 0025).
- `einvoicing` no depende de ningún módulo comercial: recibe una solicitud de documento fiscal y devuelve su estado.
- `automation`, `analytics`, `bi` y `search` consumen eventos; nunca escriben en tablas de otros módulos.
- El verificador de fronteras (`tools/check-modules.mjs`) sigue siendo la barrera en CI.

## 5. Tenant isolation model

Defensa en profundidad, como exige la especificación:

| Capa | Mecanismo | Estado |
| --- | --- | --- |
| Aplicación | Contexto de tenant resuelto por subdominio + token; debe coincidir o la petición se rechaza | F0 (middleware) |
| Base de datos | `laboratory_id` en toda tabla de tenant, RLS **forzado**, claves foráneas compuestas, rol `microslab_app` sin `BYPASSRLS` | F0, probado |
| Permisos | Permiso por comando con alcance de sucursal | F0 (pipeline) · F1 (desde roles) |
| Auditoría | Cadena SHA-256 por laboratorio, verificable | F0 |
| Plataforma | Super Admin nunca cruza tenants sin una acción explícita, con motivo, tiempo limitado y auditada ("acceso de soporte") | F2 |

Las tablas de plataforma (planes, catálogos normativos, definiciones de configuración, referencias regulatorias) son globales y de solo lectura para la app.

## 6. Security model

- **Autenticación:** usuario + contraseña con política configurable, MFA (obligatorio para Super Admin, administradores y roles fiscales), sesiones revocables, dispositivos registrados, bloqueo por intentos.
- **Autorización:** RBAC con permisos granulares `módulo.acción` y alcance por sucursal; resueltos en el backend desde roles (F1); nunca en el frontend.
- **Acciones sensibles:** reautenticación, motivo obligatorio y, donde se configure, **doble autorización** (segundo usuario con permiso aprueba el mismo comando antes de ejecutarlo; modelado en `approvals`).
- **Eventos de seguridad:** inicios de sesión, fallos, cambios de rol, accesos de soporte, actividad sospechosa (horario, volumen, ubicación) → auditoría y alerta.
- **Secretos y llaves:** en el gestor de llaves del proveedor de nube; nunca en frontend, `localStorage`, logs, respuestas de API ni archivos públicos (ADR 0009).
- **Datos clínicos y financieros:** sin borrado físico; corrección, anulación, reverso o versión nueva (sección 0 regla 64 de la especificación).

## 7. Command architecture

La tubería de F0 se mantiene y se amplía con una etapa de política de suscripción:

```
Command
→ módulo habilitado por plan
→ política de suscripción (ACTIVE, GRACE_PERIOD, SUSPENDED; lista de operaciones esenciales)   ← nueva
→ permiso (rol, sucursal)
→ motivo / reautenticación / doble autorización si el comando lo exige
→ validación de entrada (Zod)
→ transacción con contexto RLS
    → idempotencia
    → reglas de negocio + cambios de dominio (manejador)
    → auditoría
    → outbox
→ commit
```

- Si algo falla, la transacción revierte: no queda escritura parcial, auditoría falsa ni evento huérfano (probado en F0).
- **Operaciones esenciales** que ninguna suspensión bloquea: consultar y entregar resultados históricos, validar resultados ya procesados, notificar críticos, consultar historia clínica, exportar datos por obligación de conservación. La lista es configuración de plataforma versionada.
- Las escrituras fiscales pasan por la misma tubería; sus efectos externos (firma, transmisión) ocurren después del commit, desde el outbox.

## 8. Event/outbox architecture

- Eventos `modulo.NombreEnPasado` escritos en `kernel.outbox_events` dentro de la transacción (F0).
- `OutboxDispatcher` con `SKIP LOCKED` publica en BullMQ con `jobId` = id del evento: entrega al menos una vez; consumidores idempotentes.
- Colas por módulo; la **cola fiscal** es una cola propia con prioridad, reintentos con espera exponencial, límite de intentos, clasificación de error temporal/permanente y *circuit breaker* por proveedor.
- Monitoreo: profundidad y edad de cada cola, tasa de error y reintentos, con alertas (sección 36, riesgo R-07).

## 9. Audit architecture

`audit.audit_events` ya guarda actor, hora del servidor, tenant, sucursal, acción, entidad, antes, después, motivo, IP, agente,
dispositivo y `request_id` (correlation ID), con cadena SHA-256 por laboratorio y protección contra `UPDATE`/`DELETE`/`TRUNCATE`.

Se agregan (F1): `client_time` y marca `offline` para operaciones sincronizadas, y el tipo de actor `provider` para respuestas de
DGII o proveedores fiscales. La auditoría crítica es inmutable; la auditoría de consulta (lecturas de datos sensibles, descargas,
impresiones) se registra en la misma tabla con acción de lectura.

## 10. Billing architecture

- **Billing Engine** (`billing`): factura a cada laboratorio su suscripción mensual **por adelantado** y, en el mismo estado de cuenta, la comisión del ciclo anterior.
- La factura de MicroSlab es un e-CF emitido por `einvoicing` con MicroSlab como emisor (otra configuración fiscal, mismo motor).
- Estado de cuenta: borrador → emitido → pagado / vencido; pago por pasarela (F17+) o registro manual en consola.
- Precios, tasas, límites y beneficios son datos de plan versionados, nunca código (sección 11 de la especificación, ADR 0012).

## 11. Subscription architecture

| Elemento | Regla |
| --- | --- |
| Planes iniciales | FREE (RD$0 + 2 %), PRO (RD$1,500 + 1 %), ENTERPRISE (RD$3,500 + 0 %); todo configurable: precio, comisión, límites, beneficios, features, usuarios, sucursales, almacenamiento, IA, WhatsApp, API, integraciones, reportes |
| Versionado | Cada plan tiene versiones; una suscripción apunta a la versión vigente en su ciclo |
| Ciclo | Mensual; la mensualidad se cobra al inicio |
| Cambio de plan | Efectivo el primer día del siguiente ciclo; sin prorrateo; historial completo |
| Estados | ACTIVE → GRACE_PERIOD (impago al vencer) → SUSPENDED (tras 5 días calendario, configurable) → ACTIVE al pagar; CANCELLED por decisión explícita |
| Suspensión | Restringe administración, operaciones comerciales nuevas, funciones avanzadas y configuración; nunca lo clínico esencial (sección 7) |
| Trazabilidad | Cada cambio de estado emite evento y auditoría con motivo, fecha, actor (usuario o sistema), estado anterior y nuevo |

## 12. Commission architecture

- Un asiento por **cobro efectivo** (no por factura emitida): tenant, laboratorio, transacción de cobro origen, fecha, monto cobrado, tasa aplicada, comisión, plan y versión vigentes en ese momento, ciclo.
- Sin comisión sobre facturas pendientes, canceladas, anuladas, glosadas ni cuentas no cobradas. Un cobro revertido crea un asiento negativo en el ciclo del reverso; nunca se edita el original.
- Cobros de ARS: la comisión nace cuando entra el dinero, en el ciclo en que entra; el monto glosado nunca genera comisión.
- Las comisiones históricas no se recalculan al cambiar de plan.

## 13. Caja y Facturación architecture

**Caja y Facturación** es el único módulo visible de facturación para el personal operativo. Pestañas:

Facturar · Facturas · e-CF · Notas de Crédito · Notas de Débito · Estado Fiscal · Arqueo de Caja · Estado de Cuenta · Historial de Cobros · Pagos Pendientes · Reimpresión · Contingencia

- `cashier` es dueño de sesiones de caja, facturas comerciales, cobros, anticipos, reembolsos, salidas de efectivo y arqueo.
- Para cada factura, `cashier` solicita un documento fiscal a `einvoicing` (`fiscal_requests`) y guarda solo el enlace (`invoice_fiscal_links`); el número fiscal, el XML y el estado viven en `einvoicing`.
- La pestaña **Estado Fiscal** muestra el estado interno y el externo de cada documento; **Contingencia** muestra si la sucursal o el punto está en contingencia y qué quedó pendiente.
- El cajero nunca ve configuración fiscal, certificados ni secuencias.

## 14. Internal e-invoicing architecture

`einvoicing` es un motor interno. Diseño detallado en la sección 22 del documento de arquitectura; lo que fija este informe:

- **Documentos fiscales:** e-CF, XML, PDF (representación impresa), QR fiscal, hash, firma digital, transmisión, respuesta, rechazo, contingencia, reintentos, reconciliación y auditoría.
- **Estados internos** (provisionales, a validar contra el modelo oficial vigente antes de implementar): DRAFT, READY, SIGNED, PENDING_TRANSMISSION, TRANSMITTED, ACCEPTED, REJECTED, VOIDED, CONTINGENCY, PENDING_RETRY, FAILED.
- **Estado externo separado:** cada documento guarda además `external_status` (el literal que devuelve DGII o el proveedor) y el motor lo traduce al estado interno con un mapeo versionado por proveedor. Nunca se asume que los nombres coinciden.
- **Políticas fiscales:** `Fiscal Policy` + `Fiscal Policy Version` + fuente/referencia + fecha efectiva + auditoría. Incluye plazos de contingencia (`FiscalContingencyPolicy`), tipos aplicables y reglas de uso por tipo de e-CF.
- **Adaptadores de transmisión** (interfaz `FiscalGateway`): `DGII_DIRECT`, `SANDBOX`, `PROVIDER_A`, `PROVIDER_B`, futuros. Solo se diseña la interfaz; ningún conector se implementa hasta D-03.
- **Secuencias:** la autorización fiscal (rango aprobado por la DGII) y la secuencia interna (asignación a un punto de emisión) son entidades distintas (ADR 0006).

## 15. Mantenimiento Fiscal architecture

Módulo interno de `einvoicing` para Super Admin, administrador autorizado, supervisor fiscal y roles con permiso explícito. Vive en
Configuración de la app web (para el laboratorio) y en la consola (para MicroSlab). Resuelve eventualidades fiscales **sin acceso
directo a la base de datos**.

| Área | Contenido |
| --- | --- |
| Configuración | RNC, razón social, nombre comercial, dirección, sucursales, configuración fiscal, tipos de e-CF, series, secuencias, ambientes (sandbox, producción), proveedor fiscal, parámetros; cada cambio versionado con usuario, fecha, IP, dispositivo, motivo, valor anterior y nuevo |
| Certificados / firma digital | Activo, estado, emisión, expiración, días restantes, ambiente, proveedor, última prueba, última rotación; renovar, reemplazar, probar, activar, desactivar; nunca muestra la llave; MFA, reautenticación y doble autorización configurables |
| Monitor fiscal | Aceptados, pendientes, rechazados, contingencia, reintentos, errores, última comunicación, estado de certificado, secuencias, proveedor, DGII y salud del servicio |
| Cola de transmisión | Por documento: e-CF, tipo, fecha, tenant, laboratorio, sucursal, caja, dispositivo, usuario, estado, intentos, último intento, próximo reintento, error, respuesta, marca de tiempo. Acciones: ver, inspeccionar, reintentar, pausar, reanudar, ver XML, PDF, respuesta y auditoría |
| Reintentos | Backoff exponencial, límite de intentos, errores temporales frente a permanentes, reintento automático y manual, circuit breaker por proveedor; toda intervención manual auditada |
| Rejected Documents Center | Documento, motivo, código, respuesta, fecha, usuario, XML, historial y acción recomendada; la corrección usa el mecanismo fiscal (nota de crédito o nuevo documento), nunca editar el emitido |
| Reconciliation Center | Detecta documentos sin respuesta, transmitidos sin confirmación, posibles duplicados, diferencias de secuencia, respuestas sin documento local, pendientes y errores de sincronización; resuelve agregando registros, nunca borrando |
| Monitor de secuencias | Rango autorizado, actual, siguiente, utilizados, pendientes, huecos, conflictos, utilización; nunca inventa secuencias |
| Fiscal Diagnostics | Conectividad, autenticación, certificado, firma, XML, comunicación, proveedor, DGII, cola, almacenamiento, permisos, configuración → PASS / WARNING / ERROR, con auditoría |
| Fiscal Emergency Mode | Requiere permiso especial, motivo, confirmación, auditoría y alerta. Solo permite acciones de contención ya existentes (pausar la cola, declarar contingencia, forzar diagnóstico, escalar alertas); no desbloquea nada que los controles impidan |

**Acciones prohibidas siempre** (no existen como comandos): editar un e-NCF emitido, cambiar manualmente a ACCEPTED, borrar facturas fiscales, XML, respuestas o auditoría, inventar secuencias, eliminar errores sin trazabilidad, modificar documentos históricos fuera del mecanismo fiscal.

## 16. Fiscal contingency architecture

| Tipo | Causa | Qué hace el motor |
| --- | --- | --- |
| Connectivity Contingency | Internet, DGII, proveedor o comunicación | Sigue firmando en el servidor; los documentos quedan en CONTINGENCY o PENDING_TRANSMISSION y se transmiten al volver, dentro del plazo de la política vigente |
| Technical Contingency | Problema interno: firma, XML, certificado, servicio, cola o infraestructura | Detiene la emisión afectada, alerta y registra; usa el mecanismo de contingencia que la norma y la política vigente permitan (incluido el comprobante no electrónico solo si está permitido y declarado) |

Cada contingencia registra inicio, causa, sucursal, dispositivos, documentos afectados, acciones, fin y retransmisión
(`fiscal_contingency_periods`). La sucursal sin internet es un caso de **Operational Offline** (sección 26): allí la emisión fiscal
solo ocurre si existe un nodo fiscal local con llave protegida; si no, la venta queda "pendiente de comprobante".

## 17. Work Center architecture

- **Sample-centric**, no patient-centric: la unidad de trabajo es la muestra (y la tarea sobre ella), aunque la pantalla muestre al paciente como contexto.
- Flujo: Sample Received → Identification → Area Classification → Priority → Worklist → Processing → Result → Rules/Formulas/Delta → Review → Technical Validation → Professional Validation → Delivery → Audit.
- **Centros iniciales:** Reception, Phlebotomy, Laboratory, Validation, Imaging, Cash, Home Laboratory, Quality; se pueden crear más (`work_centers`).
- **Prioridades** (configurables, versionadas): Critical, Urgent, TAT Soon, Delayed, Normal; a la prioridad operacional se suma el riesgo de entrega del Result Delivery Calendar.
- **Áreas preparadas:** Hematology, Chemistry, Immunology, Hormones, Microbiology, Uroanalysis, Coprology, Coagulation, Serology, Toxicology, Molecular, Blood Bank, Imaging y áreas propias.
- **Resultados:** manual, automático, calculado, derivado, corregido; formula engine, delta check, valores críticos, repetición, retención del original, historial, validación técnica y profesional; una corrección nunca destruye el valor anterior.
- **TAT Engine:** marca toma, recepción, procesamiento, resultado, validación y entrega; SLA por estudio y prioridad, alertas, retrasos, tableros y analítica.
- Definición consolidada, incluida la sección 29 "Menos clics" completada con el análisis de clics, pantallas y campos por operación: [WORK_CENTER.md](WORK_CENTER.md). Cierra D-13.

### Result Delivery Calendar (requisito obligatorio)

Módulo `delivery` (F6). **No es la Agenda de Citas:** es un sistema de compromisos operativos para la entrega de resultados.
Definición completa, con la marca de origen de cada punto: [RESULT_DELIVERY_CALENDAR.md](RESULT_DELIVERY_CALENDAR.md). Cierra D-12.

- **Compromiso** por orden o estudio: fecha y hora prometidas, fecha estimada (TAT), fecha y hora real de entrega, tipo, responsable, sucursal, prioridad, canal y estado.
- **Estados:** PROMISED, IN_PROGRESS, READY, DELIVERED, OVERDUE, CANCELLED y RESCHEDULED.
  - Son independientes del estado del resultado.
  - OVERDUE significa que pasó la hora y el resultado **no está listo**.
  - Un resultado READY no retirado no es OVERDUE.
- **Reprogramación:** crea una versión nueva, con motivo e historial. Nada se sobrescribe.
- **Riesgo de incumplimiento:** el backend compara la hora actual, la hora prometida, el estado real y la hora estimada de listo (TAT Engine).
- **Alertas:** INFO, WARNING, URGENT y OVERDUE, con umbrales configurables (D-08).
  - Aparecen en Work Center, Mi Trabajo, el tablero, Operations Center (F10), el Calendario y la pantalla de resultados.
  - Se muestran con icono y texto, no solo con color.
- **Vistas:**
  - Calendario (día, semana, mes, fecha);
  - Entregas de Hoy;
  - Pacientes para una fecha;
  - Entregas en riesgo;
  - Entregas atrasadas;
  - detalle con historial.
- **Confirmación de entrega:** es un comando auditado. Solo se entrega un informe liberado.
- **Notificaciones:** al personal y al paciente, sin valores clínicos.
- **Métricas de cumplimiento:** en `analytics`.
- **Integraciones:** Orders, Patients, Work Center, Results, Documents, Notifications, Automation (F14) y Portals (F16).

## 18. Quality architecture

- Preparada para Ministerio de Salud Pública y acreditación estilo ISO 15189; sin requisitos legales inventados; reglas regulatorias configurables y versionadas (`compliance`, `regulatory_references`).
- **V1 mínimo obligatorio**, construido antes de la Puerta V1 y dentro de las fases funcionales (C-25):
  - en F5 (centro Quality del Work Center): registros de temperatura, incidentes de bioseguridad, y SOP críticos con versión, aprobación, firma electrónica y lectura obligatoria;
  - en F6: IQC básico diario (corrida, reglas básicas, bloqueo de liberación configurable) y tablero básico de calidad.
  - F7B solo lo verifica en el piloto.
- **Quality I (F11):** control documental completo (código, nombre, categoría, versión, creador, aprobador, fechas, estados Draft / In Review / Approved / Obsolete, PDF, Word, firma, auditoría; nunca se sobrescribe un aprobado), manuales, bitácoras restantes, capacitación ligada a HR, checklist de cumplimiento, calendario.
- **Quality II (F13):** EQC, CAPA completo, auditorías internas completas, gestión de riesgos, competencias, acreditación, equipos y reactivos completos, tablero avanzado.
- `biosafety` (nuevo): incidentes, exposiciones, cortopunzantes y gestión de desechos (manifiestos y retiros), con acceso restringido por tratarse de datos de salud del personal.

## 19. Inventory architecture

Costo **promedio ponderado** por laboratorio, historial completo por movimiento; las transferencias entre sucursales conservan el
costo de origen; nunca se pierde lote, costo, cantidad, origen, destino, usuario, fecha ni movimiento. Kardex inmutable (correcciones
por movimiento de ajuste). Detalle en la sección 19 de la arquitectura.

## 20. HR architecture

`hr` (nuevo, F12) es dueño de empleados, puestos, departamentos, contratos, documentos del empleado, permisos y ausencias, vencimientos
(licencias profesionales, exequátur, certificados) e historial. Relación con otros dominios:

- `security.users` enlaza opcionalmente a un empleado (no todo usuario es empleado, p. ej., soporte).
- `training` (calidad) usa puestos y empleados de `hr` para exigir lecturas, cursos y competencias; el expediente de calidad del empleado es una vista sobre `hr` + `training` (D-04).
- Hasta F12, `training` y los SOP críticos de V1 usan el rol del usuario como puesto provisional. En F12, un comando auditado crea los empleados a partir de los usuarios y mapea roles a puestos (sección 35.1, D-04).

## 21. Agenda architecture

**Agenda Enterprise** (`scheduling`, F9): pacientes, médicos, recursos, equipos, salas, sucursales, horarios, disponibilidad, bloqueos,
feriados, recurrencias, recordatorios, no-show, lista de espera, sobrecupo configurable; agendas médica, de imágenes, de laboratorio y
domiciliaria. El **Result Delivery Calendar** no es parte de la agenda: vive en `delivery` y comparte solo componentes visuales.

## 22. Automation architecture

`automation` (F14): reglas **Trigger → Conditions → Actions**, versionadas y auditadas. Triggers son eventos del outbox o tiempos
(resultado crítico, paciente listo, factura vencida, certificado por vencer, temperatura fuera de rango, documento pendiente, entrega en
riesgo). Acciones permitidas: notificación (WhatsApp, email, SMS), webhook, tarea interna. Toda acción que escribe datos lo hace
emitiendo un comando por la tubería, con el actor `system` y la regla como motivo; nunca escribe directo.

## 23. Analytics vs BI

| | Analytics (`analytics`) | BI (`bi`) |
| --- | --- | --- |
| Para | Operación diaria | Dirección |
| Mide | TAT, productividad, pendientes, tiempos, calidad, rendimiento | Ingresos, rentabilidad, sucursales, crecimiento, ARS, costos, inventario, tendencias, indicadores ejecutivos |
| Frescura | Casi en tiempo real (proyecciones por eventos) | Diaria o por lote |
| Fase | F10 (con Operations Center) | F17+ |

Ambos leen proyecciones o réplicas de lectura; ninguno consulta tablas de otros módulos en caliente.

### 23.1 Operations Center (revisión CTO v2.1)

El Operations Center es la superficie que **responde automáticamente** los indicadores de todos los dominios. No hay que armar reportes. Es una superficie de la app web sobre `analytics`, no un módulo con tablas propias. Sus diseños guardados viven en `workspace`.

| Dominio | Indicadores que responde | Fuente (eventos) | Disponible desde |
| --- | --- | --- | --- |
| Operativos | Órdenes y muestras por estado, pendientes por centro y área, TAT real frente a objetivo, fuera de TAT, cuellos de botella, productividad | `orders`, `samples`, `workcenter` | F10 |
| Clínicos | Críticos (detectados, notificados, tiempo hasta notificación), delta checks pendientes, repeticiones, rechazos de muestra, cadena de custodia incompleta | `rules-engine`, `results`, `validation`, `samples` | F10 |
| Entrega de resultados | Entregas de hoy, en riesgo y atrasadas; % a tiempo; reprogramaciones; listos no retirados | `delivery` | F10 |
| Financieros | Cobrado hoy, por método y sucursal; cuentas por cobrar y ARS; e-CF por estado (aceptados, pendientes, rechazados, contingencia) | `cashier`, `receivables`, `insurance`, `einvoicing` | F10 (con permisos financieros) |
| Inventario | Existencias bajo mínimo, vencimientos, consumo teórico frente a real, kits abiertos por vencer | `inventory` | F10 (F8 ya existe) |
| Calidad | IQC fuera de control, temperaturas fuera de rango, incidentes, SOP pendientes de lectura; más adelante CAPA y auditorías | `quality`, `logbooks`, `biosafety`, `doccontrol` | F10 (V1 mínimo) · F11 y F13 (ampliación) |
| RR. HH. | Personal por turno y guardia, ausencias, credenciales por vencer, capacitación pendiente | `hr`, `training` | F12 |
| Regulatorio | Resumen del Dashboard Regulatorio (D-34) | `compliance` | F11 |

**Cómo responde:**

- **Cálculo continuo.** Los indicadores se calculan con proyecciones alimentadas por eventos del outbox, casi en tiempo real. Nunca se consultan en caliente las tablas de otros módulos.
- **Umbrales y alertas configurables.** Por ejemplo, "fuera de TAT > 5", "e-CF rechazados > 0" o "temperatura fuera de rango". Los umbrales viven en la jerarquía de configuración. Cuando existe `automation` (F14), las alertas también pueden disparar acciones.
- **Del indicador a la acción.** Cada indicador permite bajar al detalle y a la acción. Por ejemplo, "3 entregas en riesgo" abre la lista, y la lista abre la muestra en el Work Center.
- **Permisos por panel.** Cada panel exige su permiso (`analytics.view.<dominio>`). Los financieros y los de RR. HH. están restringidos. Siempre se aplica el alcance por sucursal.
- **Preguntas en lenguaje natural [P].** Por ejemplo, "¿cuántos resultados están en riesgo hoy en Las Américas?". Llega en F17+ con `clinical-ai`, sujeto a D-15. Responde solo con indicadores ya calculados y con los permisos del usuario, y nunca inventa cifras.
- **Antes de F10**, cada módulo muestra su propio tablero: inicio, Mi Trabajo, Caja, Calidad V1 y Calendario de Entregas.
- **BI (F17+)** sigue separado: el Operations Center es para la operación del día; BI es para la dirección.

## 24. Clinical AI architecture

`clinical-ai` (antes `ai`): asistente que sugiere, resume, detecta anomalías, explica, prioriza, genera borradores y ayuda al
profesional. **Nunca es la autoridad clínica final** ni valida un resultado sin la autorización humana requerida. Sin envío de datos de
pacientes a proveedores externos hasta tu decisión de privacidad (D-15). Sin dominio "Copilot".

## 25. Portals architecture

`patient-portal` y `doctor-portal` son aplicaciones independientes, no vistas de la app interna: autenticación, sesiones, permisos,
seguridad, auditoría y contratos de API propios (`/portal/patient/v1`, `/portal/doctor/v1`), con identidades separadas de los usuarios
del laboratorio. **QR Verification** (`verify`) es pública: confirma autenticidad e integridad del documento sin exponer datos clínicos
innecesarios (código, fecha, laboratorio, hash, estado de vigencia).

## 26. Offline architecture

Cuatro situaciones distintas, nunca tratadas como una:

| Situación | Qué es | Respuesta |
| --- | --- | --- |
| Operational Offline | La sucursal pierde internet | Caja, Recepción y Órdenes siguen: cola local cifrada, ids generados en el equipo, idempotencia, sincronización ordenada, resolución de conflictos, auditoría con hora del equipo |
| Fiscal Contingency | El motor fiscal no puede transmitir o emitir | Sección 16 |
| Network Failure | Falla de red dentro de la infraestructura o hacia proveedores | Reintentos, circuit breaker y colas; sin impacto en datos |
| Technical Failure | Falla de un servicio propio | Degradación controlada por módulo, alertas, recuperación desde outbox |

La implementación del modo sin conexión es una fase propia (D-05); desde F1 todo comando acepta un id generado por el cliente y es
idempotente, y los códigos internos admiten reserva por bloques. Los códigos internos nunca son números fiscales (ADR 0006).

## 27. Equipment integration architecture

`connector` es una aplicación separada, instalada en la sede, aislada del core: habla HL7/ASTM con analizadores, mantiene mapeos de
pruebas, recibe resultados y envía worklists, y se comunica con la API solo por contratos autenticados de `integrations` con idempotencia.
Errores y mensajes quedan registrados; un resultado del equipo entra como origen `automático` y sigue la validación normal. El mismo
binario puede alojar el nodo fiscal local de contingencia, con su llave en el almacén seguro del sistema operativo.

## 28. Builder architecture

| Builder | Módulo | Qué produce | Reglas comunes |
| --- | --- | --- | --- |
| Report Builder | `reports` | Filtros, columnas, agrupaciones, fórmulas, gráficos, exportación PDF/Excel/CSV, programación, permisos | Definiciones versionadas; ejecutan consultas sobre proyecciones con los permisos del usuario |
| Form Builder | `forms` | Campos, tipos, validaciones, reglas, dependencias, firmas, versiones | El formulario lleno es un documento inmutable ligado a la versión |
| PDF Builder | `documents` | Plantillas de resultados, facturas, reportes, documentos, certificados, administrativos | Plantillas versionadas; un PDF emitido nunca se regenera con otra versión |
| Label Builder | `documents` | Etiquetas de muestras, tubos y equipos, códigos de barras y QR | Formatos por impresora; vista previa |
| Study / Profile Builder | `catalog` | Estudios, parámetros, perfiles, fórmulas, rangos | Versiones aprobadas antes de usarse en órdenes |

Las fórmulas de todos los builders usan el mismo evaluador seguro (`packages/expressions`), sin `eval`.

## 29. Configuration hierarchy

Cinco niveles: **Platform → Plan → Laboratory → Branch → User**. Los superiores ponen defaults (y el plan, además, techos); los inferiores
sobrescriben solo donde la definición lo permite. Existen precedencia, valor efectivo, versionado, auditoría, historial y **rollback**
(volver a una versión anterior es un comando nuevo que copia el valor, nunca un borrado). Detalle en el paquete pre-F1, sección 9, y ADR 0013.

## 30. Permission model

`módulo.acción` con alcance por sucursal; roles plantilla por laboratorio editables; permisos que exigen motivo, reautenticación o doble
autorización se declaran en el comando. Permisos fiscales (lista de la especificación, más los necesarios):

`einvoicing.view` · `einvoicing.configure` · `einvoicing.retry` · `einvoicing.contingency.manage` · `einvoicing.reconciliation` ·
`einvoicing.certificate.manage` · `einvoicing.sequence.view` · `einvoicing.sequence.manage` · `einvoicing.diagnostics` ·
`einvoicing.audit.view` · adicionales: `einvoicing.queue.pause` · `einvoicing.emergency` · `einvoicing.export`.

Emitir, anular antes de firmar y crear notas de crédito o débito son permisos de `cashier` (el cajero nunca recibe permisos `einvoicing.*`).

## 31. Design System integration

- **Figma es la fuente visual principal** (estructura, componentes, espaciado, tipografía, iconografía, layout, navegación, estados).
- **Si Figma choca con accesibilidad, gana accesibilidad**: se crean variantes accesibles en lugar de copiar valores que incumplen. Aplicado: el botón de confirmación usa relleno `success-action` #118431 (4.8:1 con texto blanco) en lugar de #31BF48 (2.4:1); #31BF48 queda para usos no textuales. El texto de ejemplo de los campos se mantiene más oscuro que en Figma.
- Tema claro y oscuro, responsive, teclado, foco visible, contraste, estados de error, carga y vacío en todos los componentes.
- Iconografía oficial: Remix Icon (línea); sustitución temporal hasta F1.
- Pendiente: contrastar las pantallas de Figma (límite de consultas del plan Starter de Figma, D-17).

## 32. Navigation model

- Regla: toda función importante a **máximo 3 clics**, usando navegación global (sidebar de 2 niveles), contextual (pestañas, filas, drawers), `Ctrl + K`, búsqueda global y atajos.
- Corrección aplicada: el sidebar de Finanzas muestra **Caja y Facturación** (con sus pestañas) y no un módulo de facturación electrónica; **Mantenimiento Fiscal** aparece en Configuración solo para roles con permisos `einvoicing.*`.
- Nuevas entradas: Operaciones → **Calendario de Entregas**; Inicio → **Operations Center** según rol; Personal → **RR. HH.** (F12).
- `Ctrl + K`: navegar, buscar paciente o muestra, abrir factura u orden, ejecutar acciones autorizadas y consultar comandos; siempre con permisos del backend.

## 33. Roadmap

Se adopta el orden de la especificación maestra. Los ajustes por dependencia están marcados **(ajuste)** y requieren tu aprobación junto con este informe.

| Fase | Contenido | Dependencia que justifica el orden |
| --- | --- | --- |
| F0 | Fundaciones (hecho) + Architecture Freeze (este informe) | — |
| F1 | Security + Design System + Application Foundations: autenticación, MFA, sesiones, dispositivos, AppShell, Configuration Engine, búsqueda y `Ctrl + K`, espacio de trabajo, `esign`, i18n y moneda, observabilidad base; registro de los 55 módulos | Todo lo demás corre dentro de este marco |
| F2 | Core: tenants (provisión desde consola), sucursales, usuarios, roles, matriz de permisos, estado de suscripción y su etapa en la tubería | La suspensión debe existir antes que cualquier operación comercial |
| F3 | Pacientes, órdenes, muestras (toma e identificación) **+ catálogo clínico y ARS (ajuste)** + cálculo de tubos, etiqueta por tubo y primeros eslabones de custodia (D-23, D-33) | Una orden requiere estudios, precios y coberturas |
| F4 | Work Center Foundation (centros, colas, prioridades, vistas, asignaciones) | Requiere muestras |
| F5 | Work Center Operations (recepción, TAT Engine, escaneo, supervisor, turno operativo provisional, cadena de custodia completa en sede, D-23 y D-28) **+ Quality V1: temperaturas, incidentes de bioseguridad, SOP críticos (ajuste C-25)** | Requiere F4; el centro Quality es uno de los 8 centros |
| F6 | Resultados, captura, validación **+ PDF clínico, QR de verificación mínimo, registro de entregas y Result Delivery Calendar (ajuste) + Quality V1: IQC básico y tablero básico (ajuste C-25)** | El flujo clínico no cierra sin documento y entrega; el IQC bloquea liberación |
| F7 | Caja y Facturación + `einvoicing` + Mantenimiento Fiscal + Billing, Subscription y Commission Engines; CxC y reclamaciones ARS | Requiere órdenes, ARS y suscripción |
| F7B | **V1 Readiness (ajuste):** preparación, integración, QA, seguridad, migración/operación, certificación e-CF en producción y capacitación. **Sin módulos nuevos** (C-25, C-26) | F7C |
| F7C | **Piloto Controlado, 2 semanas (revisión CTO, D-31):** un laboratorio en operación real con plan de retorno, revisión diaria y criterios go/no-go | Puerta V1 |
| **Puerta V1** | Criterios de salida de F7B y de F7C (secciones 35.1 y 35.3) | |
| F8 | Inventory, Purchasing, Suppliers (+ CxP, aprobaciones, gastos y centros de costo) + kits y consumo por perfil (D-32) | Consumo por prueba requiere catálogo |
| F9 | Agenda Enterprise (+ agenda de imágenes) | Requiere pacientes, recursos y sucursales |
| F10 | Operations Center / Analytics: indicadores de todos los dominios disponibles (sección 23.1) | Requiere eventos de los módulos operativos |
| F11 | Quality I + Dashboard Regulatorio de Salud Pública RD (D-34) | Requiere control documental y firma |
| F12 | HR + turnos y guardias (D-28) | Integra con Quality I |
| F13 | Quality II + mantenimiento preventivo de equipos (D-29) | Requiere HR y equipos |
| F14 | Automation Engine | Requiere eventos estables de todos los dominios |
| F15 | Report / Form / PDF / Label Builders | Reemplazan plantillas fijas de F6–F7 |
| F16 | Portals / QR completo / External APIs y webhooks + conversaciones de ida y vuelta con pacientes (D-27) | Requiere contratos estables |
| F17+ | Integraciones de equipos, integraciones avanzadas, IA clínica, voz, BI, presupuestos y costos, domicilio, logística, modo sin conexión (si no se adelanta), expansión regional | Cada una con su piloto |

### 33.1 Roadmap verificado F0 → F7C (camino a V1)

**Cambios de fase respecto a la revisión 1 de este informe** (los únicos que se hicieron):

- **C-25:** Quality V1 mínimo pasa de F7B a F5 y F6.
- **C-26:** la consola Super Admin de V1 pasa de F7B a F2 y F7.
- **F7B redefinida** como fase de preparación.
- **v2.1 (revisión CTO):**
  - nueva **F7C Piloto Controlado**;
  - contenido agregado a F3 (tubos, etiquetas, custodia), F5 (custodia, turno provisional), F6 (Centro de Comunicación, vista agenda) y a las fases posteriores a V1 (F8, F10, F11, F12, F13, F16).
  
  Ninguna fase cambió de orden.

Además se mantienen, respecto a la especificación maestra, los ajustes ya señalados en la revisión 1:

- **C-13:** catálogo clínico y ARS en F3.
- **C-15:** PDF, QR mínimo, entregas y Calendario en F6.
- **C-17:** existencia de F7B.

Ninguna otra fase cambió.

| Fase | Objetivo | Depende de | Módulos que entran | Entregables obligatorios | ¿Bloquea V1? |
| --- | --- | --- | --- | --- | --- |
| **F0** | Fundaciones técnicas + Architecture Freeze | — | kernel, `audit` (motor), registro de módulos | Hecho: RLS forzado, auditoría encadenada, outbox, idempotencia, secuencias, tubería, verificador de fronteras. Este informe aprobado | Sí (hecho; falta la aprobación) |
| **F1** | Security + Design System + Application Foundations | F0 | `security`, `configuration` (Configuration Engine), `audit` (visor), `notifications` (in-app), `search`, `workspace`; kernel `esign` | Autenticación, MFA, sesiones, dispositivos, AppShell, Design System en código, Configuration Engine con jerarquía y rollback, `Ctrl + K`, i18n y moneda preparados, observabilidad base, **registro de los 55 módulos** (C-24), adenda de auditoría (`client_time`, `offline`, `provider`) | Sí |
| **F2** | Core: tenants, sucursales, usuarios, roles, permisos, suscripción | F1 | `platform`, `configuration` (sucursales), `security` (roles y matriz), `billing` (estado de suscripción) | Provisión de laboratorios desde la consola, sucursales, usuarios, roles plantilla, matriz de permisos, estados ACTIVE, GRACE_PERIOD, SUSPENDED y CANCELLED, etapa de suscripción en la tubería con operaciones esenciales (D-06), acceso de soporte auditado, planes FREE, PRO y ENTERPRISE como datos (D-02) | Sí |
| **F3** | Pacientes, órdenes, muestras (toma e identificación) + catálogo clínico y ARS | F2 | `catalog`, `rules-engine` (definición), `insurance` (coberturas), `patients`, `orders`, `samples` | Catálogo con versiones, precios, tipos de contenedor y lista de materiales; coberturas ARS; pacientes; órdenes; toma e identificación; **cálculo de tubos y etiqueta por tubo** con reimpresión auditada; eventos de custodia de toma y etiquetado; motor de valores críticos (definición, D-25) | Sí |
| **F4** | Work Center Foundation | F3 | `workcenter` | Centros, worklists, ítems, asignaciones, políticas de prioridad configurables, vistas guardadas, estructura de Mi Trabajo | Sí |
| **F5** | Work Center Operations + Quality V1 (parte operativa) | F4 | `workcenter`, `samples` (recepción, custodia), `logbooks`, `biosafety`, `doccontrol` (mínimo) | Recepción por escaneo, contexto de muestra, TAT Engine, supervisor, turno operativo provisional (D-28), reasignación, **cadena de custodia completa en sede y entre sucursales** (D-23), Mi Trabajo operativo (D-24). **Quality V1:** temperaturas, incidentes de bioseguridad, SOP críticos con firma y lectura obligatoria | Sí |
| **F6** | Resultados, validación, documento y entrega + Quality V1 (IQC) | F5 | `results`, `validation`, `rules-engine` (evaluación, críticos, delta), `documents` (PDF clínico, QR mínimo), `delivery`, `quality` (IQC básico) | Entrada individual y masiva, fórmulas, delta, críticos, repeticiones, validación técnica y profesional, PDF, QR, **Result Delivery Calendar con vista agenda** (D-26), **Centro de Comunicación: salida, consentimiento, plantillas y registro** (D-27), protocolo de notificación de críticos (D-25), **IQC básico con bloqueo** y tablero básico de calidad | Sí |
| **F7** | Caja y Facturación + e-CF + Billing | F6 (orden y resultado), F3 (ARS), F2 (suscripción) | `cashier`, `einvoicing`, `receivables`, `insurance` (reclamaciones y glosas), `billing`, `commissions`, `reports` (base) | Caja y Facturación con sus pestañas, solicitud fiscal a `einvoicing`, primer conector fiscal (D-03) en sandbox y certificación, Mantenimiento Fiscal, contingencias, Billing Engine, Subscription Engine, Commission Engine, CxC, reclamaciones ARS, reportes base | Sí |
| **F7B** | **V1 Readiness** (sin módulos nuevos) | F1–F7 | — | Integración de extremo a extremo, QA de regresión, pruebas de carga, seguridad (pruebas de aislamiento por módulo, revisión externa), migración de datos del piloto si aplica, operación (monitoreo, alertas, respaldos y restauración probados, RPO/RTO de D-09, runbooks, simulacro de contingencia fiscal), certificación e-CF en producción, capacitación | Sí |
| **F7C** | **Piloto Controlado (2 semanas)** | F7B | — | Operación real de un laboratorio con e-CF reales, plan de retorno, revisión diaria, congelamiento de cambios y criterios go/no-go (D-31) | Sí: su cierre **es** la Puerta V1 |

### 33.2 Dónde queda cada dominio pedido

| Dominio | Fase | ¿Antes de V1? |
| --- | --- | --- |
| Work Center | F4 (foundation) · F5 (operations) · F6 (resultados y validación) | Sí |
| Calendario de Entregas (`delivery`) | F6. Panel en Operations Center en F10, reglas en Automation en F14 y canal portal en F16 | Sí (F6) |
| Caja y Facturación / e-CF (`cashier`, `einvoicing`) | F7; certificación en producción en F7B; e-CF reales en el piloto F7C | Sí |
| Quality V1 mínimo | F5 y F6 (C-25) | Sí |
| Quality I | F11 | No (después de V1) |
| Quality II | F13 | No |
| HR | F12 | No. Hasta entonces, rol como puesto provisional |
| Automation Engine | F14 | No |
| Clinical AI | F17+ | No. Sujeto a D-15 |
| BI | F17+ | No |
| Operations Center / Analytics | F10 (RR. HH. desde F12; regulatorio desde F11) | No |
| Chain of Custody | F3 · F5 (transporte con rutas: `logistics`, F17+) | Sí |
| Centro de Comunicación con Pacientes | F6 (salida) · F16 (ida y vuelta) | Sí (F6) |
| Tubos y etiquetas avanzados | F3 · F15 (Label Builder) | Sí (F3) |
| Inventario por kits y consumo por perfil | F8 | No |
| Mantenimiento preventivo de equipos | F13 | No |
| Turnos y guardias (HR) | F12 (provisional en F5) | No |
| Dashboard Regulatorio | F11 | No |

### 33.3 Qué bloquea V1

- Todas las fases F0 a F7C terminadas con sus entregables obligatorios.
- La aprobación de este Freeze.
- D-01 a D-04 (aprobadas), más las que bloquean fases previas a V1: D-06, D-07, D-08, D-09, D-10, D-11, D-19, D-20, D-22, D-23, D-24, D-25, D-26, D-27, D-31, D-33 y D-35.
- Los criterios de salida de F7B (sección 35.1) y los criterios go/no-go de F7C (sección 35.3, D-31).

## 34. Risks

| ID | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R-01 | Norma fiscal cambia o se interpreta mal | Documentos rechazados, sanciones | Políticas y referencias versionadas con fuente; validar contra documentación oficial antes de F7; revisión con contador |
| R-02 | Certificación e-CF tarda más de lo previsto | Retrasa la Puerta V1 | Empezar la certificación del emisor durante F6; sandbox desde F7 |
| R-03 | Llave de firma comprometida | Emisión fraudulenta | Gestor de llaves, acceso por identidad de servicio, rotación, revocación y alertas |
| R-04 | Duplicado o hueco de e-NCF por concurrencia o caída | Inconsistencia fiscal | Asignación atómica, restricción única, estados persistidos antes de cada efecto externo, Reconciliation Center |
| R-05 | Fuga entre tenants | Crítico | RLS forzado, claves compuestas, pruebas de aislamiento en CI (ya en F0) y pruebas por módulo nuevo |
| R-06 | Suspensión bloquea continuidad clínica | Riesgo para pacientes | Lista de operaciones esenciales en la tubería, probada |
| R-07 | Colas atascadas (fiscal, notificaciones, outbox) | Entregas o e-CF tardíos | Monitoreo de profundidad y edad, alertas, circuit breaker |
| R-08 | Alcance de V1 demasiado grande (55 módulos preparados) | Retraso | Esqueletos sin funcionalidad; solo F1–F7B construyen |
| R-09 | Figma incompleto o inaccesible | Pantallas sin referencia | Design System como contrato; contraste pendiente en D-17 |
| R-10 | Requisitos que llegan cortados (Work Center §29, Delivery Calendar §11) | Diseño incompleto | Completados solo con material existente y con marca de origen; lo propio va marcado [P]; si aparece el texto original, se compara |
| R-15 | F7B crece con trabajo funcional pendiente | Puerta V1 tardía y sin control | F7B sin módulos ni pantallas nuevas; lo pendiente vuelve a su fase (D-01) |
| R-16 | El proveedor fiscal exige custodiar el certificado | Llave fuera del control de MicroSlab | Decisión explícita D-22, contrato, auditoría de uso y rotación |
| R-17 | F3, F5 y F6 crecen con las capacidades de v2.1 (tubos, custodia, comunicación) | Retraso de V1 | Alcance mínimo por fase definido en la sección 35.3; lo avanzado va después de V1 (Label Builder F15, conversaciones F16, `logistics` F17+) |
| R-18 | Comunicación con pacientes expone datos clínicos | Legal y reputacional | Plantillas sin valores clínicos por defecto, consentimiento por canal, registro de cada mensaje (D-27, D-35) |
| R-19 | El piloto F7C falla | Puerta V1 tardía | Criterios go/no-go explícitos; se corrige en la fase de origen y F7C se repite |
| R-11 | Datos de salud a terceros (IA, WhatsApp, proveedor fiscal) | Legal y reputacional | Sin envío hasta decisión explícita; minimización de datos; acuerdos con proveedores |
| R-12 | Modo sin conexión con conflictos no resueltos | Datos duplicados | Idempotencia, bandeja de conflictos, alcance limitado a Caja, Recepción y Órdenes |
| R-13 | HR y Calidad duplican datos de personal | Inconsistencia | `hr` como dueño único (D-04) |
| R-14 | Numeración de fases cambia de nuevo | Confusión en documentos | Este informe es la referencia; documentos anteriores quedan marcados como superados en roadmap |

## 35. Open decisions

### 35.1 D-01 a D-04 — análisis y recomendación

#### D-01 — Puerta V1

| ID | Decisión | Propuesta | Impacto | Dependencias | Riesgo | Recomendación arquitectónica |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | Dónde se cruza la Puerta V1 | Al cerrar F7B "V1 Readiness" → **aprobada en v2.1 con F7C: la puerta se cruza al cerrar F7C** | Define qué es V1 y cuándo un laboratorio opera en producción. Obliga a sacar de F7B toda construcción funcional (C-25, C-26) | F1–F7 completos; D-03 (conector certificado); D-09 (RPO/RTO); D-10 (nube); laboratorio piloto disponible | Que F7B crezca con "lo que faltó" y se vuelva una fase funcional; certificación e-CF lenta (R-02) | **Aprobar.** F7B no admite módulos ni pantallas nuevas: lo que falte se devuelve a su fase y la puerta espera |

**Qué debe estar terminado antes de cruzarla (criterios de salida de F7B):**

1. F1 a F7 cerrados con sus entregables obligatorios (sección 33.1) y cero defectos críticos o altos abiertos.
2. Flujo clínico completo, ensayado en un ambiente de preproducción con datos del piloto: orden → muestra → Work Center → resultado → validación → PDF/QR → entrega registrada en el Calendario.
3. **e-CF listo para producción:** emisor certificado, contingencia de conectividad ensayada y Reconciliation Center probado. Los primeros e-CF reales se emiten en F7C.
4. **Quality V1 mínimo en uso:** IQC diario con bloqueo configurado, registros de temperatura, incidentes de bioseguridad, SOP críticos leídos por el personal y tablero básico.
5. **Seguridad:**
   - pruebas de aislamiento de tenant en todos los módulos de V1;
   - revisión de seguridad externa;
   - MFA activo en los roles obligatorios;
   - llaves de firma en el gestor de llaves (ADR 0009).
6. **Operación:**
   - monitoreo y alertas de colas (fiscal, notificaciones, outbox);
   - respaldo y restauración probados contra RPO/RTO (D-09);
   - runbooks de incidentes y de contingencia fiscal;
   - soporte y acceso de soporte auditado.
7. **Migración:** si el piloto trae datos de otro sistema, migración ensayada y conciliada. Si no, se declara "sin migración".
8. **Suscripción:** el piloto opera con su plan, estado de cuenta y comisión calculada sobre cobros reales. La suspensión fue probada sin afectar lo clínico.
9. **Personas:** capacitación del personal del piloto. La operación real de 2 semanas y la aceptación firmada pasan a **F7C** (D-31).

**Confirmación:** F7B **no es una fase funcional grande**. Es una fase de preparación, integración, QA, seguridad, migración y operación, y de *readiness*. No registra módulos nuevos ni crea pantallas nuevas.

#### D-02 — Plan gratuito

| ID | Decisión | Propuesta | Impacto | Dependencias | Riesgo | Recomendación arquitectónica |
| --- | --- | --- | --- | --- | --- | --- |
| D-02 | Nombre del plan gratuito | `FREE` | Nombre visible en la consola, el estado de cuenta, los correos y el portal | Configuration Engine (F1), `billing` y `platform` (F2), i18n (F1) | Bajo. Solo sería un problema si el código o las comisiones dependieran del nombre | **Aprobar `FREE` como nombre inicial**, con estas reglas |

- El plan tiene un **identificador interno inmutable** (UUID) y un **código técnico estable** (`free`, `pro`, `enterprise`).
- El **nombre visible** es un dato de presentación, traducible por idioma y editable desde la consola.
- Las suscripciones, comisiones, estados de cuenta y la auditoría referencian **plan + versión**, nunca el nombre.
- Renombrar no crea una versión de precio ni altera el historial. Cambiar precio, comisión o límites sí crea una versión nueva (ADR 0012).
- Ninguna regla de negocio compara nombres de plan. Las capacidades se leen de los *features* y límites del plan.

#### D-03 — Primer conector fiscal

| ID | Decisión | Propuesta | Impacto | Dependencias | Riesgo | Recomendación arquitectónica |
| --- | --- | --- | --- | --- | --- | --- |
| D-03 | Primer conector fiscal | Proveedor autorizado para V1; DGII directo después | Define el primer adaptador que se construye en F7, el proceso de certificación y el costo por documento | Interfaz `FiscalGateway` (F7); selección del proveedor concreto (D-20); custodia del certificado (D-22); ADR 0009 | Dependencia comercial del proveedor; que el proveedor exija custodiar el certificado del laboratorio; estados externos distintos a los internos | **Aprobar**, sin implementar ningún conector ahora |

Arquitectura de adaptadores preparada (solo diseño):

| Adaptador | Uso | Fase |
| --- | --- | --- |
| `AUTHORIZED_PROVIDER` (instancias `PROVIDER_A`, `PROVIDER_B`, …) | Emisión por proveedor autorizado por la DGII | F7 (el primero) |
| `DGII_DIRECT` | Emisión directa con certificación propia del emisor | Posterior a V1 |
| `SANDBOX` | Simulador determinista para pruebas, CI y capacitación; nunca en producción | F7 |
| Futuros | Nuevos proveedores o cambios normativos | Cuando se decidan |

- **Puerto único:** `FiscalGateway`, con las operaciones `submit`, `status`, `void`, `healthcheck` y `capabilities`.
- **Capacidades por adaptador:** quién firma, formatos, límites y modalidad de contingencia. Se consultan en tiempo de ejecución; no se asumen.
- **Mapeo versionado** del estado externo al interno, uno por adaptador (ADR 0008). Se guardan siempre `external_status` y la respuesta cruda.
- El adaptador se elige por **configuración fiscal del emisor y ambiente**, desde Mantenimiento Fiscal. Cambiar de adaptador es un comando con motivo, auditoría y doble autorización (D-07).
- **Afinidad:** un documento termina su ciclo en el adaptador que lo transmitió. Solo los documentos nuevos usan el adaptador nuevo.
- **Cambiar de proveedor no altera el dominio fiscal ni Caja y Facturación.** `cashier` solo conoce `fiscal_requests` e `invoice_fiscal_links`. Los estados internos, secuencias, contingencias, reconciliación y permisos de `einvoicing` son los mismos con cualquier adaptador.
- **Custodia del certificado:** si el proveedor elegido firma con el certificado del laboratorio, la llave queda bajo custodia contractual del proveedor. Esa es una excepción a ADR 0009 que decides en D-22. MicroSlab nunca la expone en frontend, logs ni API.

#### D-04 — RR. HH. frente a Calidad

| ID | Decisión | Propuesta | Impacto | Dependencias | Riesgo | Recomendación arquitectónica |
| --- | --- | --- | --- | --- | --- | --- |
| D-04 | Quién es dueño de los datos del personal | `hr` dueño de empleados, puestos, estructura laboral y datos maestros; Calidad los consume | Evita duplicar personas entre `hr`, `training`, `biosafety` y `logbooks`. Define el expediente del empleado | `security` (usuario ↔ empleado), `doccontrol`, `training`, `biosafety`, `esign` | Antes de F12 no existe `hr`: riesgo de que Calidad cree su propio registro de personas | **Aprobar**, con el reparto y la regla de transición siguientes |

| Dato | Dueño | Quién lo consume |
| --- | --- | --- |
| Empleado, cédula, contacto laboral, estado (activo o baja), historial | `hr` | Todos, por `employee_id` |
| Puestos, departamentos, estructura, contratos, ausencias y permisos laborales | `hr` | `training`, `workcenter` (turnos), `analytics` |
| Formación académica, licencias, exequátur, certificados y sus vencimientos | `hr` (credenciales del expediente) | `training`, `compliance` (alertas de vencimiento) |
| Requisitos de capacitación por puesto, cursos, lecturas de SOP, evaluaciones de competencia y evidencias | `training` (Calidad) | `hr` (vista de solo lectura en el expediente), auditorías internas |
| Firma electrónica | Kernel `esign`, ligada al **usuario** (`security`) | Todos los módulos |
| Exposiciones e incidentes que afectan a una persona | `biosafety` (acceso restringido; datos de salud) | `hr` solo ve que existe el registro, no su contenido |

- **Nadie duplica personas.** Los demás módulos guardan `employee_id` o `user_id`, nunca nombre, cédula ni puesto copiados.
- `security.users` enlaza a un empleado de forma opcional. No todo usuario es empleado (por ejemplo, soporte o auditores externos), y no todo empleado es usuario.
- **Hasta F12:** Quality V1 (F5–F6) usa `user_id` y el **rol como puesto provisional**. Una persona afectada que no es usuario se registra como texto en `biosafety`.
- **En F12:** un comando auditado crea empleados desde los usuarios, mapea roles a puestos y enlaza los registros existentes. No se borra nada.
- **La especificación maestra lista "formación" y "competencias" en HR** (sección 40). La propuesta las reparte así: `hr` guarda las credenciales formales del expediente y `training` guarda las evaluaciones y evidencias de competencia, porque son registros de calidad. Se señala como interpretación para tu aprobación.
- **Dependencias:**
  - `hr` → `security`, `configuration`;
  - `training` → `hr`, `doccontrol`;
  - `biosafety` → `hr` (desde F12), `logbooks`;
  - `compliance` → `hr` (vencimientos).

### 35.2 Lista final de decisiones pendientes D-05 en adelante

| ID | Decisión | Propuesta | Bloquea |
| --- | --- | --- | --- |
| D-05 | Fase del modo sin conexión | F17+, adelantable si el piloto lo exige | — |
| D-06 | Lista exacta de operaciones esenciales durante la suspensión | La de la sección 7 | F2 |
| D-07 | Qué acciones fiscales exigen doble autorización | Cambio de certificado, paso a producción, cambio de proveedor o adaptador, Emergency Mode | F7 |
| D-08 | Umbrales iniciales de alertas de entrega | INFO 24 h; WARNING 12 h y 4 h; URGENT 2 h y 30 min; OVERDUE al vencer (ejemplo del requisito) | F6 |
| D-09 | Retención de datos, RPO y RTO | Pendiente desde la arquitectura | F2 (retención) · F7B (prueba) |
| D-10 | Nube y región | Pendiente desde la arquitectura | F1 (infraestructura) |
| D-11 | Contenido del QR clínico y del QR fiscal | QR clínico: código + hash; QR fiscal: el que exija la norma | F6, F7 |
| D-12 | ~~Resto del requisito Result Delivery Calendar~~ | **Cerrada:** definición completada con material existente ([RESULT_DELIVERY_CALENDAR.md](RESULT_DELIVERY_CALENDAR.md)); el texto original posterior al corte no se recuperó | — |
| D-13 | ~~Resto del documento del Work Center~~ | **Cerrada:** sección 29 completada con el análisis que pedía ([WORK_CENTER.md](WORK_CENTER.md)) | — |
| D-14 | Monedas y fuente de tasas de cambio | Solo preparación; RD$ en V1 | — |
| D-15 | Proveedor de IA y condiciones de privacidad | Pendiente | F17+ |
| D-16 | Proveedor de voz | Pendiente | F17+ |
| D-17 | Contraste de pantallas de Figma | Completar con más cuota de Figma | Diseño de pantallas |
| D-18 | Alcance de `logistics` | Transporte de muestras entre sucursales y a laboratorios de referencia | F17+ |
| D-19 | Acciones permitidas en Fiscal Emergency Mode | Solo contención (sección 15) | F7 |
| D-20 | **Nueva:** proveedor autorizado concreto | Evaluar autorización DGII, API, sandbox, SLA, contingencia, custodia del certificado, residencia de datos y costo | F7 |
| D-21 | **Nueva:** entregas parciales de resultados | Permitidas si el laboratorio lo habilita (el compromiso se divide) | F6 |
| D-22 | **Nueva:** custodia del certificado si el proveedor firma | Excepción contractual a ADR 0009 o proveedor que permita firmar en MicroSlab | F7 |
| D-23 a D-34 | Revisión CTO v2.1 | Sección 35.3 | Ver cada una |
| D-35 | **Nueva (v2.1):** proveedores de WhatsApp, SMS y correo | Adaptadores por canal. Evaluar API oficial de WhatsApp Business, costo, entregabilidad y tratamiento de datos | F6 |

### 35.3 Decisiones nuevas D-23 a D-34 (revisión CTO v2.1)

Estas son las observaciones obligatorias de la revisión CTO del 27/09/2026. Cada una queda como decisión con propuesta **para tu aprobación final**.

Reglas comunes a todas:

- No se crean módulos nuevos. Cada capacidad tiene un módulo dueño ya registrado, así que el total sigue en 55.
- No se agregan fases, salvo F7C.
- Cuando una capacidad **agrega contenido a una fase**, se señala en la columna *Fase*.

| ID | Decisión | Qué ya existía | Propuesta | Módulo dueño | Fase | Riesgo principal |
| --- | --- | --- | --- | --- | --- | --- |
| D-23 | Chain of Custody | Custodia mencionada en `samples` (F5) | Trazabilidad completa de cada muestra y alícuota, con eventos inmutables (ver detalle) | `samples` (+ `logistics` para el transporte, F17+) | F3 (toma, etiquetado) · F5 (recepción, alícuotas, almacenamiento, descarte, rechazo, envío y recepción entre sucursales) · **contenido agregado a F3 y F5** | Un eslabón sin escaneo rompe la cadena |
| D-24 | Dashboard "Mi Trabajo" para bioanalistas | Definido en Work Center (F4–F6) | Se confirma como pantalla de llegada por rol, con los contadores del documento, "Continuar trabajando", entregas en riesgo que dependen del usuario, críticos por notificar y SOP pendientes de lectura | `workcenter` (+ `workspace`) | F4 (estructura) · F5 · F6 (contadores de resultados y entregas) | Contadores costosos: se leen de proyecciones, no de consultas en caliente |
| D-25 | Motor configurable de Valores Críticos | Críticos en `rules-engine` (F3 definición, F6 evaluación) | Valores críticos y de pánico por parámetro, con rangos por edad, sexo y condición. Protocolo de notificación configurable (a quién, plazo máximo, lectura de vuelta, escalamiento). Versionado y aprobación antes de usarse. Se registra cada evento y notificación | `rules-engine` (definición y evaluación) + `results` (eventos y notificación) | F3 · F6 (sin cambio de fase) | Un umbral mal configurado: exige aprobación y versión |
| D-26 | Calendario Inteligente de Entrega de Resultados | `delivery` (F6) con vistas de día, semana, mes y fecha | Se agrega la vista **agenda** (lista cronológica continua). "Inteligente" significa, dentro del alcance ya definido: fecha sugerida por TAT, jornada y feriados; riesgo por hora estimada de listo; prioridad calculada. **[P]** considerar la carga pendiente del área al sugerir la fecha | `delivery` | F6 (sin cambio de fase) | Sugerencias poco confiables si el TAT del catálogo no está calibrado |
| D-27 | Centro de Comunicación con Pacientes | `notifications` (in-app F1, correo y WhatsApp F6) | Superficie **Centro de Comunicación** dentro de `notifications`, no un módulo nuevo (ver detalle) | `notifications` | F6 (salida, consentimiento, plantillas, registro) · F16 (conversaciones de ida y vuelta) · **contenido agregado a F6 y F16** | Datos de salud a terceros (R-11); costo por mensaje; proveedores por decidir |
| D-28 | Turnos y guardias en HR | "Turnos" en Work Center Operations (F5) | `hr` es dueño de turnos, guardias, rotaciones, cambios de turno y disponibilidad. Hasta F12, el Work Center usa una definición operativa de turnos (horarios de worklist en Configuración). En F12 esa definición pasa a leerse de `hr` con un comando de enlace auditado | `hr` (dueño) · `workcenter` (consume) | F5 (turno operativo provisional) · F12 (turnos y guardias completos) · **contenido agregado a F12** | Doble fuente de turnos entre F5 y F12: se resuelve con la regla de transición, igual que en D-04 |
| D-29 | Mantenimiento Preventivo Inteligente de Equipos | `equipment` en Quality II (F13) | Planes preventivos por tiempo y por uso; calibraciones; bitácora de fallas; bloqueo configurable de un equipo vencido en las worklists; alertas. "Inteligente" (ver detalle): uso real desde el conector y tendencias de control de calidad; la predicción queda para `clinical-ai` | `equipment` (+ `integrations`, `analytics`) | F13 (preventivo y bloqueo) · F17+ (uso por conector, predicción) | Contadores de uso poco fiables sin conector |
| D-30 | Motor de Reglas Clínicas separado de IA | Documento del Work Center, sección 23; ADR 0016 | Se formaliza en **ADR 0025**: `rules-engine` determinista, versionado y auditable, con autoridad sobre alertas, críticos, delta y bloqueos. `clinical-ai` solo sugiere y nunca escribe estados clínicos | `rules-engine` · `clinical-ai` | F3 · F6 · F17+ (IA) | Que una sugerencia de IA se confunda con una regla: se muestran distinto y quedan auditadas aparte |
| D-31 | Fase F7C — Piloto Controlado | Piloto dentro de F7B (revisión 2) | Fase propia de **2 semanas** después de F7B y antes de la Puerta V1 (ver detalle) | — (fase) | **F7C nueva** | Hallazgos que obliguen a repetir el piloto |
| D-32 | Inventario por kits y consumo por perfil | Inventario F8 (costo promedio, kardex) | Kits de reactivos con determinaciones y estabilidad tras apertura. Consumo teórico por estudio y por perfil (lista de materiales), incluidos controles, calibradores y repeticiones. Descuento automático por eventos de resultado. Diferencia entre consumo teórico y real | `inventory` (+ `catalog` para la lista de materiales) | F8 (sin cambio de fase) | Listas de materiales incompletas distorsionan el costo |
| D-33 | Gestión avanzada de tubos y etiquetas | Etiquetas fijas en F3; Label Builder en F15 | Tipos de contenedor por estudio (aditivo, color, volumen, orden de extracción). Cálculo del mínimo de tubos por orden. Etiqueta por tubo con código de barras. Alícuotas y etiquetas secundarias. Reimpresión auditada con motivo. Impresoras por puesto | `catalog` (reglas) · `samples` (tubos) · `documents` (etiquetas) | F3 (cálculo de tubos, etiquetas por tubo, reimpresión) · F15 (Label Builder) · **contenido agregado a F3** | Reglas de consolidación de tubos incorrectas: se definen por laboratorio y se aprueban |
| D-34 | Dashboard Regulatorio de Salud Pública RD | `compliance` y `regulatory_references` (F11) | Tablero de cumplimiento construido **solo sobre requisitos cargados como referencias regulatorias versionadas** (ADR 0008). Ejemplos: habilitación y licencias con vencimientos, estado de los manuales y SOP, indicadores de calidad, reportes obligatorios. **No se asume ningún requisito legal**: cada indicador cita su norma | `compliance` (+ `quality`, `hr`, `doccontrol`) | F11 (sin cambio de fase) | Requisitos del Ministerio sin fuente oficial cargada: el indicador queda "sin fuente" y no se muestra como cumplido |

#### Detalle de D-23 — Chain of Custody

- **Qué es cada eslabón:** un evento inmutable en `samples`, llamado `sample_custody_events`. Registra:
  - la acción;
  - quién la hizo y quién recibe;
  - dónde;
  - cuándo (hora del servidor y del dispositivo);
  - la condición de la muestra (temperatura cuando aplica, integridad);
  - el contenedor o la caja;
  - el motivo, cuando la acción lo exige.
- **Eslabones mínimos:**
  - toma;
  - etiquetado;
  - empaque;
  - salida;
  - transporte;
  - llegada;
  - recepción;
  - aceptación o rechazo (con motivo);
  - alícuota;
  - procesamiento;
  - almacenamiento (ubicación);
  - recuperación;
  - envío a laboratorio de referencia;
  - descarte.
- Cada entrega de manos se confirma por escaneo. La cadena no se edita: una corrección es un evento nuevo.
- La vista "Historial de la muestra" del Work Center la muestra completa.
- El transporte con rutas, choferes y cajas refrigeradas es `logistics` (D-18, F17+). Hasta entonces, el envío y la recepción entre sucursales son eventos de custodia sin rutas.

#### Detalle de D-27 — Centro de Comunicación con Pacientes

- **Canales:** WhatsApp, correo y SMS mediante adaptadores. El proveedor de cada canal es una decisión aparte, **D-35**.
- **Consentimiento y preferencia de canal** por paciente. Se registran quién, cuándo y cómo se obtuvieron, y se pueden revocar.
- **Plantillas versionadas** por tipo de mensaje: resultado listo, cambio de fecha de entrega, recordatorio, comprobante. Por defecto **no incluyen valores clínicos**. Enviar el informe por un canal exige configuración explícita y consentimiento.
- **Registro de cada mensaje:** estado del proveedor (enviado, entregado, leído, fallido), reintentos y costo. Los límites de mensajes vienen del plan de suscripción.
- **Conversaciones de ida y vuelta** (respuestas del paciente por WhatsApp): F16, junto con los portales.
- Todo envío sale del outbox con idempotencia. Automation (F14) puede disparar mensajes, siempre con las mismas plantillas y el mismo consentimiento.

#### Detalle de D-29 — Qué significa "inteligente"

Las reglas deterministas usan:

- tiempo;
- número de pruebas procesadas;
- fallas repetidas;
- tendencia del control de calidad (por ejemplo, desvíos sucesivos en Levey-Jennings).

Estas reglas generan alertas y órdenes de mantenimiento. Las sugerencias predictivas son de `clinical-ai` (F17+) y nunca bloquean ni liberan un equipo por sí solas.

#### Detalle de D-31 — F7C Piloto Controlado (2 semanas)

**Qué es:**

- un solo laboratorio y sus sucursales;
- operación real con pacientes reales;
- e-CF reales, porque la certificación en producción se completa en F7B;
- sin abrir el producto a otros laboratorios.

**Controles:**

- el proceso anterior del laboratorio queda disponible como plan de retorno;
- revisión diaria de incidentes, datos clínicos, e-CF y reconciliación;
- soporte dedicado;
- monitoreo reforzado de colas y errores;
- congelamiento de cambios (solo correcciones);
- registro de hallazgos.

**Criterios de salida (go/no-go), para aprobar en la aprobación final:**

- cero incidentes críticos abiertos;
- cero diferencias fiscales sin explicar en el Reconciliation Center;
- flujo clínico completo sin pérdida de trazabilidad;
- entregas medidas por el Calendario;
- aceptación firmada por el laboratorio;
- decisión formal de Puerta V1.

Si el piloto no pasa, se corrige en la fase que corresponda y **F7C se repite**. La Puerta V1 no se cruza con excepciones.

### 35.4 Estado de D-01 a D-04 tras la revisión CTO

| ID | Estado | Observación incorporada |
| --- | --- | --- |
| D-01 | **Aprobada** (27/09/2026) | F7B = V1 Readiness. Se agrega **F7C Piloto Controlado (2 semanas)** antes de producción. La Puerta V1 se cruza al cerrar F7C |
| D-02 | **Aprobada** | `FREE` es el nombre visible configurable. El identificador interno no depende de él |
| D-03 | **Aprobada con observación** | Arquitectura de adaptadores para proveedor autorizado, DGII directo, sandbox y futuros. **Ningún conector se implementa todavía** |
| D-04 | **Aprobada** | `hr` es dueño de empleados y estructura laboral. Calidad los consume para competencias, capacitación y cumplimiento |

Las ADR relacionadas (0005, 0010, 0012 y 0022) registran la aprobación de su decisión, pero siguen en estado **Propuesta** hasta la aprobación final del Freeze.

## 36. Assumptions

- A-01: Todos los laboratorios clientes estarán obligados a e-CF antes de V1 (aviso DGII de agosto de 2026; plazo de pequeños al 15 de noviembre de 2026). A validar con fuentes oficiales antes de F7.
- A-02: V1 opera solo en República Dominicana, en español y en RD$; lo regional es preparación.
- A-03: Un laboratorio es un emisor fiscal (un RNC); varios RNC por tenant se modelan como varias configuraciones fiscales si hace falta.
- A-04: El piloto es un laboratorio con varias sucursales y ARS; imágenes y domicilio no son requisito de V1.
- A-05: Los precios de los planes son los de la especificación y cambian por configuración.
- A-06: La infraestructura ofrece un gestor de llaves administrado.
- A-07: Las pantallas de Figma siguen el Design System ya contrastado en la página de Componentes.
- A-08: El código de F0 permanece; el Freeze no exige rehacer nada construido.

## 37. ADR references

| ADR | Tema | Estado |
| --- | --- | --- |
| [0001](../adr/0001-monolito-modular.md) | Monolito modular | Aprobada (adenda: 55 módulos) |
| [0002](../adr/0002-multi-tenancy-rls.md) | Multi-tenancy y RLS | Aprobada |
| [0003](../adr/0003-comandos-auditoria-outbox.md) | Comandos, auditoría, outbox, idempotencia | Aprobada (adenda: etapa de suscripción, correlación) |
| [0004](../adr/0004-desviaciones-fase-0.md) | Ajustes técnicos de F0 | Aprobada |
| [0005](../adr/0005-einvoicing-interno.md) | e-invoicing interno consumido por Caja y Facturación | Propuesta (D-03 aprobada con observación) |
| [0006](../adr/0006-secuencia-fiscal-vs-interna.md) | Autorización fiscal frente a secuencia interna | Propuesta |
| [0007](../adr/0007-offline-y-contingencias.md) | Offline y contingencias separadas | Propuesta |
| [0008](../adr/0008-reglas-externas-versionadas.md) | Reglas fiscales y regulatorias versionadas | Propuesta |
| [0009](../adr/0009-llaves-de-firma.md) | Llaves de firma solo en servidor o nodo seguro | Propuesta |
| [0010](../adr/0010-puerta-v1.md) | Puerta V1, F7B, F7C y Quality V1 mínimo | Propuesta (D-01 aprobada) |
| [0011](../adr/0011-mantenimiento-fiscal.md) | Mantenimiento Fiscal | Propuesta |
| [0012](../adr/0012-suscripcion-billing-comision.md) | Suscripción, billing y comisión | Propuesta (D-02 aprobada) |
| [0013](../adr/0013-jerarquia-de-configuracion.md) | Jerarquía de configuración | Propuesta |
| [0014](../adr/0014-work-center-sample-centric.md) | Work Center sample-centric | Propuesta |
| [0015](../adr/0015-calidad.md) | Calidad en tres niveles | Propuesta |
| [0016](../adr/0016-clinical-ai.md) | Clinical AI como asistente | Propuesta |
| [0017](../adr/0017-portales-independientes.md) | Portales independientes y QR público | Propuesta |
| [0018](../adr/0018-equipment-connector.md) | Conector de equipos aislado | Propuesta |
| [0019](../adr/0019-analytics-vs-bi.md) | Analytics separado de BI | Propuesta |
| [0020](../adr/0020-result-delivery-calendar.md) | Result Delivery Calendar | Propuesta |
| [0021](../adr/0021-design-system-accesibilidad.md) | Figma como fuente, accesibilidad gana | Propuesta |
| [0022](../adr/0022-hr.md) | Dominio HR, turnos y guardias | Propuesta (D-04 aprobada) |
| [0023](../adr/0023-automation-engine.md) | Automation Engine por comandos | Propuesta |
| [0024](../adr/0024-builders.md) | Builders versionados | Propuesta |
| [0025](../adr/0025-reglas-clinicas-y-criticos.md) | Motor de reglas clínicas y valores críticos, separado de IA | Propuesta (v2.1) |
| [0026](../adr/0026-cadena-de-custodia.md) | Cadena de custodia de muestras | Propuesta (v2.1) |
| [0027](../adr/0027-centro-de-comunicacion.md) | Centro de Comunicación con Pacientes | Propuesta (v2.1) |
| [0028](../adr/0028-operations-center.md) | Operations Center | Propuesta (v2.1) |
| [0029](../adr/0029-inventario-kits-consumo.md) | Inventario por kits y consumo por perfil | Propuesta (v2.1) |
| [0030](../adr/0030-tubos-y-etiquetas.md) | Tubos y etiquetas | Propuesta (v2.1) |

---

## Verificación del Freeze (v2.1)

| Verificación | Resultado |
| --- | --- |
| Código funcional nuevo | Ninguno |
| Migraciones nuevas | Ninguna |
| Tablas nuevas | Ninguna (los nombres de tablas son conceptuales) |
| Pantallas funcionales nuevas | Ninguna |
| Cambios al código de F0 | Ninguno (`packages/contracts/src/modules.ts` intacto; se actualiza en F1, C-24) |
| Implementación de e-CF, HR, Delivery Calendar, Work Center ni de las capacidades D-23 a D-34 | Ninguna |
| Qué cambió | Solo `docs/architecture/*.md` y `docs/adr/*.md` en la rama `docs/architecture-freeze`; Design System (artefacto) y notas en los documentos de arquitectura |
| Estado de ADR 0005–0030 | **Propuesta** (0025–0030 nuevas en v2.1) |
| Pull request | No abierto |
| Merge a `main` | No realizado |

## Quality gate antes de F1

| Punto | Estado |
| --- | --- |
| Architecture Freeze terminado | **v2.1** — observaciones CTO integradas, esperando aprobación final |
| Observaciones CTO (D-23 a D-34, F7C, Operations Center) | Secciones 23.1, 33, 35.3 — pendiente de aprobación final |
| Calendario de Entregas completo | [RESULT_DELIVERY_CALENDAR.md](RESULT_DELIVERY_CALENDAR.md) — pendiente de aprobación |
| Work Center completo (sección 29) | [WORK_CENTER.md](WORK_CENTER.md) — pendiente de aprobación |
| D-01 a D-04 | **Aprobadas** (sección 35.4) |
| Roadmap F0–F7C | Sección 33.1 — pendiente de aprobación final |
| Domain map · Module map · Dependency graph | Secciones 2, 3, 4 — pendiente de aprobación |
| Tenant isolation · Security model | Secciones 5, 6 — pendiente de aprobación |
| Billing · Subscription · Commission | Secciones 10, 11, 12 — pendiente de aprobación |
| Caja y Facturación · e-CF · Mantenimiento Fiscal · Contingencia fiscal | Secciones 13–16 — pendiente de aprobación |
| Work Center · Quality V1 · HR · Agenda · Automation · Builders | Secciones 17, 18, 20, 21, 22, 28 — pendiente de aprobación |
| Analytics/BI separados · Clinical AI · Offline · Portals · Equipment Connector | Secciones 23–27 — pendiente de aprobación |
| Design System · Navigation · Roadmap | Secciones 31–33 — pendiente de aprobación |
| ADRs actualizados | 0005–0030 en estado Propuesta; 0001 y 0003 con adenda propuesta |

F1 no empieza hasta recibir exactamente: **ARCHITECTURE FREEZE APPROVED — START F1**.
