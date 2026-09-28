# F1.2 — Autorización desde la base y contexto de sucursal (borrador)

Este documento cubre F1.3 (autorización desde la base) y F1.4 (`x-branch-id`). Todo es **propuesta**: no hay código ni migraciones.

## 1. Flujo por petición (F1.3; se completa en F1.5)

```
Petición HTTP
→ request_id
→ laboratorio          (subdominio → platform.laboratory_directory: id, status)
→ identidad            (JWT: firma, iss, aud, exp; sub, lab, sid; lab = laboratorio del subdominio)
→ transacción de lectura con SET LOCAL app.laboratory_id = lab, app.actor_* = usuario
   ├─ usuario          app.users: existe y status = 'active'
   ├─ sesión           app.user_sessions: sid del usuario, activa y no vencida      [desde F1.5]
   ├─ roles            app.user_roles ⋈ app.roles con status = 'active'
   ├─ permisos         app.role_permissions ⋈ platform.permissions (unión de todos los roles)
   ├─ sucursales       app.user_branches ∪ (todas las del laboratorio si algún rol activo tiene all_branches)
   ├─ MFA              si algún rol activo tiene requires_mfa, la sesión debe tenerlo verificado   [desde F1.6]
   └─ sucursal activa  x-branch-id validado contra las sucursales resueltas                        [F1.4]
→ módulos              enabledModules = ∅ hasta F2 (los módulos de F1 no dependen del plan)
→ TenantContext        { laboratoryId, actor, permissions, enabledModules, branchIds, allBranches, activeBranchId, … }
→ CommandBus           (sin cambios: módulo → permiso → motivo → Zod → transacción)
→ RLS                  app.branch_ids / app.all_branches salen ahora de la base
```

**Fuente de verdad única:** las tablas `app.users`, `app.roles`, `app.user_roles`, `app.role_permissions` y `app.user_branches`, que ya existen en F0. El token solo identifica. Si trae claims de autorización, se ignoran.

**Cómo se ven las sucursales durante la resolución.** `app.branches` tiene una política RLS restrictiva por sucursal, así que la resolución se hace en dos pasos dentro de la misma transacción:

1. Se leen `app.user_branches` y `app.roles.all_branches`. Estas tablas solo tienen aislamiento por laboratorio.
2. Se fija `app.branch_ids` (o `app.all_branches`) con **el alcance que el usuario ya tiene legítimamente**, y solo entonces se consulta `app.branches` (existencia, estado activo, sucursal activa).

El usuario nunca ve más de lo que su propio alcance permite.

## 2. Casos de estado

| Situación                                              | Resultado                                                                                                                               | Código                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Sin token                                              | Se rechaza                                                                                                                              | 401 `UNAUTHENTICATED`                                                         |
| Token inválido o `lab` distinto al del subdominio      | Se rechaza                                                                                                                              | 401 `TOKEN_INVALID`                                                           |
| El usuario (`sub`) no existe en el laboratorio         | Se rechaza                                                                                                                              | 401 `SESSION_REVOKED`                                                         |
| Usuario `inactive`                                     | Se rechaza; sus sesiones se revocan al darlo de baja                                                                                    | 401 `SESSION_REVOKED`                                                         |
| Usuario `invited`                                      | No puede tener sesión: solo puede activarse (`/auth/activate`)                                                                          | 401 `SESSION_REVOKED` si presenta un token                                    |
| Usuario `locked` (por intentos o por un administrador) | Se rechaza; sus sesiones se revocan al bloquearlo                                                                                       | 401 `SESSION_REVOKED` (y `INVALID_CREDENTIALS` genérico al intentar el login) |
| Laboratorio `onboarding`                               | Se permite (etapa de configuración)                                                                                                     | —                                                                             |
| Laboratorio `suspended`                                | Ver la decisión H2                                                                                                                      | 403 `LABORATORY_UNAVAILABLE` (propuesta)                                      |
| Laboratorio `closed`                                   | Se rechaza todo                                                                                                                         | 403 `LABORATORY_UNAVAILABLE`                                                  |
| Sin roles activos                                      | Autenticado, sin permisos: puede usar sus propios endpoints (perfil, logout, cambio de contraseña, MFA); cualquier comando responde 403 | 403 `PERMISSION_DENIED`                                                       |
| Sin sucursales y sin `all_branches`                    | Autenticado; `branchIds = []`. RLS no le muestra filas por sucursal                                                                     | 403 `BRANCH_NOT_ALLOWED` si envía `x-branch-id`                               |
| Rol inactivo                                           | Se ignora en la unión                                                                                                                   | —                                                                             |
| Otra sucursal (`x-branch-id` no permitido)             | Se rechaza                                                                                                                              | 403 `BRANCH_NOT_ALLOWED`                                                      |

### Decisión H2: significado de `platform.laboratories.status = 'suspended'`

**Problema:** la regla C-04 del Freeze dice que la suspensión **por falta de pago** nunca bloquea lo clínico esencial. Esa suspensión es un estado de **suscripción** (`billing`, F2), con una etapa propia en la tubería. En cambio, `platform.laboratories.status` ya existe en F0 y hoy no se usa.

**Recomendación:**

- `platform.laboratories.status` es el estado **operativo o administrativo** de la plataforma: alta en curso, suspensión administrativa (por seguridad o por un tema legal) o cierre. **No se usa para impagos.**
- En F1.3, `suspended` y `closed` bloquean toda petición autenticada con 403 `LABORATORY_UNAVAILABLE`.
- La suspensión por impago llega en F2 como estado de suscripción, con su lista de operaciones esenciales (D-06).

Esta aclaración va en la ADR 0031, porque evita que en el futuro se use el campo equivocado.

**Alternativa descartada:** tratar `suspended` como solo lectura en F1. Duplicaría la lógica que F2 define para la suscripción.

## 3. Contrato de `x-branch-id` (F1.4)

| Aspecto                               | Regla                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naturaleza                            | **Solo contexto operativo.** Nunca concede acceso                                                                                                                                                                                                                                                                                |
| Formato                               | UUID canónico; si no lo es, 400 `BRANCH_CONTEXT_INVALID` (hoy provoca un 500)                                                                                                                                                                                                                                                    |
| Ausente                               | Si el usuario tiene exactamente una sucursal permitida y no tiene `all_branches`, esa sucursal pasa a ser la activa, **derivada por el servidor**. En cualquier otro caso, sin sucursal activa (`activeBranchId` indefinido)                                                                                                     |
| Sucursal inexistente                  | 403 `BRANCH_NOT_ALLOWED`                                                                                                                                                                                                                                                                                                         |
| Sucursal de otro laboratorio          | 403 `BRANCH_NOT_ALLOWED` (mismo código: no revela si existe en otro laboratorio)                                                                                                                                                                                                                                                 |
| Sucursal del laboratorio no permitida | 403 `BRANCH_NOT_ALLOWED`                                                                                                                                                                                                                                                                                                         |
| Sucursal permitida pero `inactive`    | 403 `BRANCH_NOT_ALLOWED` como sucursal activa. Sus datos siguen visibles según RLS                                                                                                                                                                                                                                               |
| Con `all_branches`                    | Cualquier sucursal **activa del mismo laboratorio** es válida                                                                                                                                                                                                                                                                    |
| Relación con RLS                      | RLS sigue filtrando con **todas** las sucursales permitidas (`app.branch_ids`), no solo con la activa. La sucursal activa sirve para valores por defecto y para la auditoría                                                                                                                                                     |
| Qué se audita                         | `audit_events.branch_id` = solo la sucursal activa **validada por el servidor**, o `NULL`. Un intento rechazado se registra como evento de seguridad (`security.branch_context.denied`, con la sucursal solicitada dentro de `after_data`, nunca en `branch_id`), con límite de frecuencia por usuario para no inundar la cadena |

**Garantía en la base (defensa en profundidad), en la migración `0006`:**

- **Clave foránea compuesta** `(laboratory_id, branch_id)` de `audit.audit_events` hacia `app.branches`. Es segura porque las sucursales nunca se borran, y PostgreSQL 16 admite claves foráneas desde tablas particionadas.
- **Trigger `BEFORE INSERT`** que rechaza el evento si `branch_id IS NOT NULL AND NOT kernel.branch_visible(branch_id)`.

Con eso, **el cliente nunca puede elegir `audit_events.branch_id`**, ni siquiera si un error de aplicación dejara pasar un valor.

**Prueba previa a la migración:** verificar que las filas actuales cumplen la regla. Hoy solo existen datos de prueba.

## 4. Consultas propuestas (orientativas)

Hay dos consultas dentro de la transacción de lectura, las dos con parámetros:

1. **Usuario, sesión, roles, permisos y sucursales asignadas.** Usuario por `id`, sesión por `sid`, agregación de permisos con `array_agg(DISTINCT permission_key)`, `bool_or(all_branches)`, `bool_or(requires_mfa)` y `array_agg` de `user_branches`.
2. **Solo si hace falta** (viene `x-branch-id` o el usuario tiene `all_branches`): existencia y estado de la sucursal activa, con el alcance ya fijado.

**Índices:** las claves primarias de `user_roles`, `role_permissions` y `user_branches` empiezan por `laboratory_id` y cubren estas búsquedas. No se proponen índices nuevos para F1.3.

**Estado del laboratorio:** se lee en la misma consulta del subdominio que ya existe, porque la vista `platform.laboratory_directory` ya expone `status`.
