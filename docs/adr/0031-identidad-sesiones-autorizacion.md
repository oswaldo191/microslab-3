# ADR 0031 — Identidad, sesiones y autorización

**Estado:** **Propuesta** · 27 de septiembre de 2026 · formaliza el diseño aprobado de F1.2. Es criterio de entrada de F1.3: debe aprobarse antes de iniciar su implementación.

## Contexto

En F0, la API valida un JWT HS256 que nadie emite y toma de él los permisos, los módulos habilitados y las sucursales. La [ADR 0004](0004-desviaciones-fase-0.md) aceptó esa situación **solo para F0**. No existen login, sesiones ni MFA.

El diseño de F1.2 define cómo se identifica, autentica y autoriza cada petición:

- [`F1_2_DESIGN.md`](../f1/F1_2_DESIGN.md)
- [`F1_2_DECISIONS.md`](../f1/F1_2_DECISIONS.md)
- [`F1_2_AUTHZ.md`](../f1/F1_2_AUTHZ.md)
- [`F1_2_SESSIONS_JWT.md`](../f1/F1_2_SESSIONS_JWT.md)
- [`F1_2_MFA.md`](../f1/F1_2_MFA.md)

**Los documentos de F1.2 contienen el diseño detallado. Esta ADR formaliza solo las decisiones arquitectónicas estables que heredan las fases siguientes.** Si esta ADR y F1.2 difieren, es un error que debe corregirse.

## Decisión

### 1. Identidad de la petición y fuente de verdad

- **El laboratorio** se resuelve siempre desde el host o subdominio → `platform.laboratory_directory` → base de datos. Nunca sale del token.
- **La identidad de sesión** puede estar representada por el JWT de acceso:
  - `sub`, `sid` y `lab`;
  - `iss`, `aud`, `iat`, `exp` y `jti`;
  - `kid` en la cabecera.
- **El claim `lab`** es solo una comprobación de consistencia con el laboratorio resuelto. Si difiere, la petición se rechaza. Nunca es autoridad para seleccionar el laboratorio.
- **El JWT no es fuente de verdad de la autorización.** No contiene permisos, módulos, sucursales ni `allBranches`; si aparecen, se ignoran.
- **Autorización persistida:** los permisos efectivos y el acceso a sucursales salen de la base de datos en cada petición: `app.users`, `app.roles`, `app.user_roles`, `app.role_permissions` y `app.user_branches`.

### 2. Permisos frente a módulos habilitados

- **`permissions != enabledModules`.** La autorización ("¿puede este usuario?") y la habilitación de producto ("¿tiene este laboratorio el módulo?") son controles distintos. El CommandBus exige ambos. Tener permiso sobre un módulo no implica que esté habilitado.
- **En F1**, `enabledModules` se resuelve con un proveedor estático basado en el registro de módulos:
  - los módulos con `planGated: false` siempre están habilitados;
  - los módulos de plan quedan deshabilitados.
  - `assertModuleEnabled` no cambia.
- **En F2**, la habilitación por suscripción y plan implementa ese mismo proveedor. Esta ADR no diseña F2.

### 3. Estado operativo del laboratorio

`platform.laboratories.status` es el **estado operativo de la plataforma**. Es independiente de billing, suscripción, plan y estado de pago, y nunca se usa para impagos (C-04). Los estados son:

- `onboarding`
- `active`
- `suspended`
- `closed`

Su efecto sobre el login y las peticiones autenticadas está definido en F1.2 (decisión M). La suspensión por impago pertenece a la suscripción de F2.

### 4. Sesión persistente

- **Fuente de verdad:** la sesión vive en la base de datos (`app.user_sessions`) y se consulta en cada petición. Revocarla corta el acceso de inmediato.
- **Redis:** si se utiliza más adelante, no será la fuente de verdad de la sesión.
- **Valores aprobados:**

| Parámetro                         | Valor      |
| --------------------------------- | ---------- |
| Vida del access JWT               | 10 minutos |
| Expiración por inactividad        | 30 minutos |
| Duración absoluta de la sesión    | 12 horas   |
| Sesiones concurrentes por usuario | máximo 5   |

- **Refresh:** rota en cada uso, con detección de reutilización. Viaja en una cookie `HttpOnly` host-only, protegida contra CSRF según F1.2.
- **Semántica de errores:**
  - 401 cuando no hay autenticación válida;
  - 403 cuando hay autenticación pero falta autorización o habilitación.

### 5. Desafío MFA separado del access token

El desafío MFA:

- es independiente del access token;
- **no es un JWT**;
- dura **5 minutos**;
- es de **un solo uso**;
- admite **máximo 5 intentos**;
- se consume de forma segura: bloqueo de la fila y transición atómica en una sola transacción.

**Cuando el MFA es requerido**, porque cualquier rol activo lo exige, **la sesión solo puede crearse después de un MFA válido**. Un desafío nunca se acepta como access token ni concede autorización en la API.

### 6. Caminos de ejecución y mecanismo de escritura

Esta sección distingue dos conceptos:

- **Caminos de ejecución:** por dónde entra una operación.
- **Mecanismo de escritura:** qué pieza del kernel escribe los datos.

Hay **tres caminos de ejecución cerrados** (decisión N de F1.2), pero **solo dos mecanismos de escritura**: el CommandBus y, como excepción enumerada, el pipeline de autenticación.

| Camino de ejecución              | Mecanismo de escritura                          | Qué cubre                                                                                                        |
| -------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1. **CommandBus**                | **CommandBus**                                  | Toda operación de negocio y administración de un usuario autenticado, con módulo habilitado y permiso de la base |
| 2. **Pipeline de autenticación** | **Pipeline de autenticación** (única excepción) | Solo estos puntos de entrada: login, MFA, refresh, logout, activación y cambio de la propia contraseña           |
| 3. **Runner de infraestructura** | **CommandBus** (el mismo)                       | Una lista fija de comandos de infraestructura, con contexto de mínimo privilegio                                 |

- **El CommandBus** sigue siendo el mecanismo central de escritura para las operaciones de negocio y para el runner de infraestructura.
- **El runner de infraestructura** no es un segundo mecanismo de escritura independiente: es un punto de entrada controlado que ejecuta comandos a través del mismo CommandBus, con las mismas etapas.
- **El pipeline de autenticación** es la **única vía de escritura** que constituye una excepción al principio general de la ADR 0003.
  - Está **cerrada y limitada** a los puntos de entrada enumerados.
  - No exige un permiso de negocio, pero cada punto tiene su propia verificación.
  - Conserva las garantías del kernel: validación, límite de intentos, transacción con RLS, auditoría encadenada y outbox, e idempotencia donde aplica.
  - No ejecuta comandos de negocio.

**Relación con la [ADR 0003](0003-comandos-auditoria-outbox.md).** La ADR 0003, aprobada, establece que todo cambio de datos es un comando ejecutado por el CommandBus. Esta ADR propone **delimitar** ese principio con la única excepción del pipeline de autenticación.

- **Mientras esta ADR esté en estado Propuesta**, la excepción **no está formalmente aprobada** como decisión arquitectónica, y el principio de la ADR 0003 rige sin excepciones.
- **Al aprobarse esta ADR**, esa aprobación formaliza la excepción delimitada.
- **La ADR 0003 no queda modificada automáticamente.** Su alineación documental posterior es un trabajo separado, y no se modifica en esta tarea.

### 7. Actor `platform`

- `platform` es un actor técnico y auditado. **No implica privilegios implícitos.**
- **No existe** ningún bypass genérico del tipo `if actor === platform`.
- Las operaciones de infraestructura requieren contexto explícito:
  - identidad del operador;
  - laboratorio objetivo;
  - motivo obligatorio;
  - clave de idempotencia;
  - auditoría y controles de producción.
- Los permisos de infraestructura **no son asignables** a roles como permisos normales.

### 8. Sucursal, autorización y RLS

- **Formato de `x-branch-id`:** UUID canónico. Si es inválido, **400**.
- **Rechazos:** una sucursal inexistente, de otro laboratorio o no permitida recibe **403**.
- **Sucursal inactiva:** no puede ser la sucursal activa.
- **`allBranches`:** permite cualquier sucursal **activa del mismo laboratorio**.
- **RLS:** limita por el conjunto de sucursales permitidas, resueltas en la base.
- **Sucursal activa:** es **contexto**, no sustituye a la autorización ni al aislamiento.
- **Auditoría:** la sucursal registrada es **derivada por el servidor**. El cliente nunca fija `audit_events.branch_id`, y la base lo refuerza con la clave `(laboratory_id, branch_id)` y un trigger de visibilidad.

## Consecuencias

- Reemplaza la solución provisional de la [ADR 0004](0004-desviaciones-fase-0.md) (permisos en el token) cuando esta ADR se apruebe. La ADR 0004 no se modifica en esta tarea.
- Todas las aplicaciones cliente heredan el mismo contrato: token, sesión, 401/403 y desafío MFA. Esto incluye la web, la consola de plataforma y los portales.
- Cada petición autenticada tiene el costo de una transacción de lectura. No se agrega caché si no se mide la necesidad.
- **La implementación depende de F1.3–F1.6.** El despliegue a producción de F1.5 y F1.6 depende de D-10 (gestión de secretos y origen de la API), según F1.2.
- El [Architecture Freeze](../architecture/ARCHITECTURE_FREEZE.md) no se modifica. Esta ADR no amplía el alcance de F1 ni diseña F2: suscripciones, planes, habilitación por suscripción y capacidades de plataforma siguen siendo de F2.

## Referencias

- Diseño de F1.2:
  - [`F1_2_DESIGN.md`](../f1/F1_2_DESIGN.md)
  - [`F1_2_DECISIONS.md`](../f1/F1_2_DECISIONS.md) (decisiones D, E, F, G, H, I, J, L, M y N)
  - [`F1_2_AUTHZ.md`](../f1/F1_2_AUTHZ.md)
  - [`F1_2_SESSIONS_JWT.md`](../f1/F1_2_SESSIONS_JWT.md)
  - [`F1_2_MFA.md`](../f1/F1_2_MFA.md)
- [ADR 0003](0003-comandos-auditoria-outbox.md): comandos, auditoría y outbox.
- [ADR 0004](0004-desviaciones-fase-0.md): desviaciones de F0.
- [Architecture Freeze](../architecture/ARCHITECTURE_FREEZE.md).
