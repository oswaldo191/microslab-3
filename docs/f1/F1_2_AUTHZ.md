# F1.2 — Autorización desde la base, habilitación y contexto de sucursal

Cubre F1.3 (autorización desde la base) y F1.4 (`x-branch-id`). Todo es **propuesta**: no hay código ni migraciones. Corresponde a las decisiones H, I, L y M de `F1_2_DECISIONS.md`.

## 1. Flujo por petición autenticada

```
Petición HTTP
→ request_id
→ laboratorio      host/subdominio → platform.laboratory_directory (id, status)       ← autoridad del laboratorio
→ identidad        JWT: firma, iss, aud, exp; sub, sid; lab == laboratorio resuelto (solo comprobación)
→ lectura en la base (transacción de lectura, SET LOCAL app.laboratory_id = laboratorio resuelto)
   ├─ usuario       app.users: existe y status = 'active'
   ├─ sesión        app.user_sessions: id = sid, user_id = sub, activa y no vencida                 [desde F1.5]
   ├─ laboratorio   status en onboarding o active (sección 3)
   ├─ roles         app.user_roles ⋈ app.roles (status = 'active')
   ├─ permisos      app.role_permissions (unión de todos los roles activos)
   ├─ sucursales    app.user_branches ∪ todas las del laboratorio si algún rol activo tiene all_branches
   ├─ MFA           si ALGÚN rol activo tiene requires_mfa, la sesión debe tener mfa_verified_at     [desde F1.6]
   └─ sucursal activa  x-branch-id validado (sección 4)                                            [F1.4]
→ habilitación     enabledModules desde el proveedor de habilitación (sección 2)
→ TenantContext
→ CommandBus       sin cambios: módulo habilitado → permiso → motivo → validación → transacción
→ RLS              app.branch_ids / app.all_branches salen ahora de la base
```

**Fuente de verdad única de la autorización:** las tablas `app.users`, `app.roles`, `app.user_roles`, `app.role_permissions` y `app.user_branches`, que ya existen desde F0.

- El JWT solo identifica al usuario y a la sesión. Si trae claims de autorización (`perms`, `modules`, `branches`, `allBranches`), se ignoran.
- **El laboratorio nunca sale del JWT.** Se resuelve desde el host o subdominio. El claim `lab` solo se compara con ese resultado: si difieren, 401 `TOKEN_INVALID`.

**Cómo se ven las sucursales durante la resolución.** `app.branches` tiene una política RLS restrictiva por sucursal, así que la resolución va en dos pasos dentro de la misma transacción:

1. Se leen `app.user_branches` y `app.roles.all_branches`. Estas tablas solo tienen aislamiento por laboratorio.
2. Se fija `app.branch_ids` (o `app.all_branches`) con el alcance que el usuario ya tiene legítimamente, y solo entonces se consulta `app.branches`: existencia, estado y sucursal activa.

La resolución nunca ve más de lo que el propio usuario puede ver.

## 2. Habilitación de módulos en F1 (decisión L)

**Autorización y habilitación son distintas: `permissions != enabledModules`.**

|                          | Autorización                                | Habilitación de producto                            |
| ------------------------ | ------------------------------------------- | --------------------------------------------------- |
| Pregunta                 | ¿Puede este usuario hacer esto?             | ¿Tiene este laboratorio este módulo?                |
| Fuente en F1             | Base de datos (roles, permisos, sucursales) | Proveedor estático basado en el registro de módulos |
| Fuente desde F2          | Base de datos (sin cambios)                 | Plan y suscripción → `enabledModules`               |
| Control en el CommandBus | `assertPermission`                          | `assertModuleEnabled`                               |

Tener permiso sobre un módulo **no** implica que el módulo esté habilitado. El CommandBus exige ambos, en ese orden: primero habilitación, luego permiso.

**Comportamiento exacto en F1** (sin cambiar `assertModuleEnabled` ni `isModuleEnabled`):

- La función actual `isModuleEnabled` devuelve `true` si el módulo tiene `planGated: false` en `packages/contracts/src/modules.ts`. Si tiene `planGated: true`, devuelve `true` solo si figura en `ctx.enabledModules`.
- En F1, un **proveedor de habilitación estático** (una interfaz con una única implementación) fija `enabledModules` = **ningún módulo de plan**. La decisión es explícita y está documentada; no es un valor por omisión accidental.
- Los módulos que F1 usa (`security`, `configuration` y `audit`) tienen `planGated: false`, así que **siempre están habilitados**. Los comandos legítimos de F1 no se bloquean.
- Cualquier módulo de plan queda deshabilitado hasta F2, aunque un rol tenga permisos sobre él.
- **Prueba obligatoria en F1.3:** todo comando registrado pertenece a un módulo con `planGated: false`. Si un bloque de F1 agregara un comando de un módulo de plan, la prueba falla.
- **En F2**, la suscripción implementa la misma interfaz, sin cambiar el CommandBus.

**No se crean** tablas de planes, suscripciones ni billing en F1.

## 3. Casos de estado

| Situación                                                | Resultado                                                                                                                                        | Código                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Sin token                                                | Rechazo                                                                                                                                          | 401 `UNAUTHENTICATED`                                               |
| Token inválido, o `lab` distinto al laboratorio resuelto | Rechazo                                                                                                                                          | 401 `TOKEN_INVALID`                                                 |
| El usuario (`sub`) no existe en el laboratorio           | Rechazo                                                                                                                                          | 401 `SESSION_REVOKED`                                               |
| Usuario `inactive`                                       | Rechazo; darlo de baja revoca sus sesiones                                                                                                       | 401 `SESSION_REVOKED`                                               |
| Usuario `invited`                                        | No puede tener sesión; solo puede activarse                                                                                                      | 401 `SESSION_REVOKED` si presenta un token                          |
| Usuario `locked`                                         | Rechazo; bloquearlo revoca sus sesiones                                                                                                          | 401 `SESSION_REVOKED` (en el login, `INVALID_CREDENTIALS` genérico) |
| Laboratorio `onboarding` o `active`                      | Permitido                                                                                                                                        | —                                                                   |
| Laboratorio `suspended` o `closed`                       | Rechazo                                                                                                                                          | 403 `LABORATORY_UNAVAILABLE`                                        |
| Sin roles activos                                        | Autenticado, sin permisos: solo puede usar su propia sesión (perfil, logout, cambio de contraseña, MFA). Cualquier comando de negocio se rechaza | 403 `PERMISSION_DENIED`                                             |
| Un rol activo exige MFA y la sesión no lo verificó       | Rechazo; debe volver a autenticarse con MFA                                                                                                      | 401 `MFA_REQUIRED`                                                  |
| Sin sucursales y sin `all_branches`                      | Autenticado; `branchIds = []`; RLS no le muestra filas por sucursal                                                                              | 403 `BRANCH_NOT_ALLOWED` si envía `x-branch-id`                     |
| Rol inactivo                                             | Se ignora en la unión                                                                                                                            | —                                                                   |
| `x-branch-id` hacia otra sucursal                        | Rechazo                                                                                                                                          | 403 `BRANCH_NOT_ALLOWED`                                            |

### Significado de `platform.laboratories.status` (decisión M)

Es el **estado operativo de la plataforma**, separado de billing, suscripción, plan y estado de pago. **Nunca se usa para impagos.** La suspensión por impago es un estado de suscripción de F2, con su lista de operaciones esenciales, conforme a C-04.

| Estado       | Significado                                                                                           | Efecto en F1                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding` | Alta y configuración inicial                                                                          | Login y peticiones permitidos                                                                                                                    |
| `active`     | Operación normal                                                                                      | Login y peticiones permitidos                                                                                                                    |
| `suspended`  | Suspensión administrativa de la plataforma (seguridad, orden legal, incumplimiento contractual grave) | Login y peticiones autenticadas: 403 `LABORATORY_UNAVAILABLE`. Las sesiones no se revocan y vuelven a servir si el laboratorio vuelve a `active` |
| `closed`     | Laboratorio dado de baja en la plataforma                                                             | 403 `LABORATORY_UNAVAILABLE`. La revocación de sus sesiones ocurre al cerrarlo, con un comando de F2                                             |

F1 solo **lee** este estado. Cambiarlo es de F2 (consola de plataforma).

## 4. Contrato de `x-branch-id` (F1.4, decisión I)

| Aspecto                                                       | Regla                                                                                                                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naturaleza                                                    | **Solo contexto operativo.** Nunca concede acceso; no es el mecanismo de aislamiento                                                                                                         |
| Formato                                                       | UUID canónico. Si no lo es: 400 `BRANCH_CONTEXT_INVALID`                                                                                                                                     |
| Ausente, con una sola sucursal permitida y sin `all_branches` | La sucursal activa se **deriva en el servidor**                                                                                                                                              |
| Ausente, con varias sucursales o con `all_branches`           | Sin sucursal activa; el servidor **no elige arbitrariamente**                                                                                                                                |
| Sucursal inexistente                                          | 403 `BRANCH_NOT_ALLOWED`                                                                                                                                                                     |
| Sucursal de otro laboratorio                                  | 403 `BRANCH_NOT_ALLOWED` (mismo código: no revela si existe en otro laboratorio)                                                                                                             |
| Sucursal del laboratorio no permitida                         | 403 `BRANCH_NOT_ALLOWED`                                                                                                                                                                     |
| Sucursal permitida pero `inactive`                            | No puede ser sucursal activa: 403 `BRANCH_NOT_ALLOWED`. Sus datos siguen visibles según RLS                                                                                                  |
| Con `all_branches`                                            | Cualquier sucursal **activa del mismo laboratorio** es válida                                                                                                                                |
| Relación con RLS                                              | RLS sigue usando el **conjunto completo** de sucursales permitidas (`app.branch_ids`), no solo la activa. `activeBranchId` es contexto para valores por defecto y auditoría                  |
| Qué se audita                                                 | `audit_events.branch_id` es **derivado por el servidor**: solo la sucursal activa validada, o `NULL`                                                                                         |
| Intento rechazado                                             | Evento de seguridad `security.branch_context.denied`, con la sucursal solicitada en `after_data` y nunca en `branch_id`. Tiene un límite de frecuencia por usuario para no inundar la cadena |

**Garantía en la base (defensa en profundidad), migración `0006`:**

- **Clave foránea compuesta** `(laboratory_id, branch_id)` de `audit.audit_events` hacia `app.branches`. Las sucursales nunca se borran, y PostgreSQL 16 admite claves foráneas desde tablas particionadas.
- **Trigger `BEFORE INSERT`** que rechaza el evento si `branch_id IS NOT NULL AND NOT kernel.branch_visible(branch_id)`.

Con ambos, **el cliente nunca puede escribir arbitrariamente `audit_events.branch_id`**, ni siquiera si un error de aplicación dejara pasar un valor.

**Antes de la migración:** verificar que las filas existentes cumplen la regla. Hoy solo hay datos de prueba.

## 5. Consulta de usuario y sesión en cada petición

La **base de datos es la fuente de verdad**. La sesión se consulta en cada petición porque eso permite revocar al instante.

- **Contexto de lectura:** una transacción de lectura por petición con `SET LOCAL app.laboratory_id` (el laboratorio resuelto por el host) y el actor. Es la misma mecánica de `PgTenantDatabase`, sin permisos de escritura.
  - Es independiente de la transacción del comando posterior. Entre ambas, RLS sigue aplicando el aislamiento.
- **Consulta 1**, parametrizada. Trae:
  - usuario (`id`, `status`, `version`);
  - sesión (`id`, `user_id`, `revoked_at`, `idle_expires_at`, `absolute_expires_at`, `mfa_verified_at`, `last_reauth_at`);
  - permisos (`array_agg(DISTINCT permission_key)` de los roles activos);
  - `bool_or(all_branches)`, `bool_or(requires_mfa)` y las sucursales de `user_branches`.
- **Consulta 2**, solo si viene `x-branch-id` o el usuario tiene `all_branches`: existencia y estado de la sucursal activa, con el alcance ya fijado.
- **Estado del laboratorio:** sale de la consulta del subdominio que ya existe (`laboratory_directory` expone `status`).
- **Índices:**
  - Las claves primarias existentes cubren `user_roles`, `role_permissions` y `user_branches`, porque empiezan por `laboratory_id` y el usuario o el rol.
  - La clave primaria de `app.user_sessions` (`id`) cubre la búsqueda por `sid`.
  - El único índice nuevo es el parcial `(laboratory_id, user_id) WHERE revoked_at IS NULL`, para contar y listar sesiones activas.
- **Qué puede cachearse:**
  - las llaves públicas de verificación del JWT;
  - el registro de módulos (es código).
- **Qué NO se convierte en fuente de autorización cacheada:**
  - el estado de la sesión;
  - el estado del usuario;
  - los permisos;
  - las sucursales;
  - el estado del laboratorio.

  Si en el futuro se mide la necesidad de caché (`F1_2_DESIGN.md` §7), sería de lectura a través, con TTL acotado y validación por `version`, y la revocación de la sesión se comprobaría siempre en la base.

- **Redis:** si se usa en el futuro para esto, **no sustituye** a la base como fuente de verdad. En F1 no se implementa Redis para autorización.
