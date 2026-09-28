# F1.2 — Diseño de seguridad de F1 (documento índice)

**Estado:** BORRADOR en revisión (PR #3). Incluye las correcciones de la revisión técnica del 27/09/2026. No hay código, migraciones ni dependencias.
**Base:** `main` en `2de3a86`, Architecture Freeze v2.2 y la auditoría de F1.2.
**Alcance:** diseño de F1.3 (autorización desde la base), F1.4 (contexto de sucursal), F1.5 (JWT, sesiones y hardening) y F1.6 (MFA).

## 0. Mapa de documentos

| Documento               | Qué define                                                                                                                                                                 | Decisiones          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `F1_2_DESIGN.md` (este) | Índice, reglas, caminos de ejecución, modelo de datos resumido, amenazas, matriz F1.3–F1.6, compatibilidad, rendimiento, criterios de aceptación y documentos a actualizar | —                   |
| `F1_2_DECISIONS.md`     | Matriz de decisiones A–N con problema, opciones, recomendación, impacto, riesgos, alternativas descartadas y fase                                                          | Todas               |
| `F1_2_AUTHZ.md`         | Resolución de la autorización desde la base, habilitación de módulos en F1, estado del laboratorio, contrato de `x-branch-id` y consultas                                  | H, I, L, M          |
| `F1_2_SESSIONS_JWT.md`  | Caminos de autenticación e infraestructura, access token, sesiones, refresh, CSRF, contraseñas y alta del primer usuario                                                   | B, C, D, E, F, G, N |
| `F1_2_MFA.md`           | MFA de usuarios de laboratorio, desafío MFA y lo que queda para F2                                                                                                         | J                   |

Si un documento detallado y la matriz de decisiones difieren, es un error que debe corregirse. Ninguno prevalece sobre el otro.

### ADR

**Una sola ADR nueva es necesaria: `0031-identidad-sesiones-autorizacion.md`.** No se crea todavía. Motivos:

- Cambia una decisión vigente: la ADR 0004 dejó los permisos en el token "solo en F0", y ahora se fija la fuente de verdad definitiva.
- Define un contrato que heredan todas las aplicaciones cliente: significado del token, transporte de la sesión, 401 frente a 403, desafío MFA.
- Fija dos separaciones que afectan a fases futuras:
  - **autorización** (base de datos) frente a **habilitación de producto** (registro de módulos en F1, suscripción desde F2);
  - `platform.laboratories.status` frente al estado de suscripción.
- Define que el actor `platform` no concede privilegios implícitos.

El resto (algoritmo de contraseñas, factor de MFA, parámetros y el tipo de actor `ai`) son decisiones de implementación. Quedan en `F1_2_DECISIONS.md` y no requieren ADR.

## 1. Reglas de arquitectura

- **Aislamiento:** PostgreSQL con RLS forzado sigue siendo la autoridad. Toda validación de aplicación se suma a él y nunca lo reemplaza.
- **Contexto:** `TenantContext` conserva su forma. Cambia **de dónde salen** sus datos:

| Campo                      | Fuente en F1                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `laboratoryId`             | Host o subdominio → `platform.laboratory_directory`. El claim `lab` del JWT solo se contrasta con este valor |
| `actor`                    | Usuario de la sesión, verificado en la base                                                                  |
| `permissions`              | Base de datos: roles, `role_permissions`, `user_roles`                                                       |
| `branchIds`, `allBranches` | Base de datos: `user_branches` y `roles.all_branches`                                                        |
| `activeBranchId`           | `x-branch-id` validado por el servidor, o derivado por el servidor                                           |
| `enabledModules`           | Habilitación de producto: registro de módulos en F1; suscripción desde F2 (ver `F1_2_AUTHZ.md` §2)           |

- **Autorización y habilitación son distintas:** `permissions != enabledModules`. Tener un permiso sobre un módulo no significa que el módulo esté habilitado para el laboratorio. Son dos controles separados del CommandBus y los dos deben cumplirse.
- **El JWT nunca es fuente de autorización.** Ni permisos, ni módulos, ni sucursales, ni laboratorio.
- **Sin atajos por tipo de actor.** No existe ninguna regla del tipo "si el actor es `platform` (o `system`), omitir la autorización".
- **Sin cambios** en la cadena de auditoría, el outbox, la idempotencia ni las secuencias.
- **Architecture Freeze:** este diseño no lo modifica. Los ajustes documentales que necesitará se listan en la sección 9.

## 2. Caminos de ejecución

Toda escritura ocurre por **uno de estos tres caminos**, todos cerrados y enumerados. No hay un cuarto.

| Camino                                                 | Qué ejecuta                                                                                                                                                                     | Cómo se autoriza                                                                                                                                                                                                                            | Garantías del kernel                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CommandBus** (existente, sin cambios en su contrato) | Toda operación de negocio y administración hecha por un usuario autenticado, por ejemplo crear sucursales, restablecer credenciales de otro usuario o revocar sesiones de otros | Módulo habilitado + permiso de la base + motivo si aplica                                                                                                                                                                                   | Validación, transacción con RLS, idempotencia, auditoría encadenada, outbox                                                                        |
| **Pipeline de autenticación** (nuevo, cerrado)         | Login, verificación y alta de MFA, refresh, logout, activación, cambio de la propia contraseña                                                                                  | No requiere un permiso de negocio, porque el usuario aún no está autenticado o actúa solo sobre su propia sesión. Cada punto de entrada tiene su propia verificación: token de activación, contraseña, desafío MFA, refresh o sesión propia | Validación, límite de intentos, transacción con RLS del laboratorio del host, auditoría encadenada, outbox; idempotencia donde aplica (activación) |
| **Runner de infraestructura** (nuevo, cerrado)         | Solo los comandos marcados como de infraestructura: bootstrap del primer administrador, reemisión _break-glass_, reset _break-glass_ de MFA                                     | Pasa por el **mismo CommandBus**, con actor `platform` y un contexto de **mínimo privilegio**: exactamente el permiso del comando ejecutado, y solo el laboratorio objetivo. Ese permiso está marcado como no asignable a roles             | Todas las del CommandBus, más operador identificado, motivo obligatorio, clave de idempotencia y alerta de seguridad                               |

El pipeline de autenticación **no** es una puerta trasera del CommandBus:

- Solo existe para una lista fija de puntos de entrada, definida en `F1_2_SESSIONS_JWT.md` §1.
- No ejecuta comandos de negocio.
- Ninguno de sus puntos de entrada concede autorización más allá de crear o cerrar la propia sesión.

## 3. Modelo de datos propuesto (resumen)

Todo son propuestas; nada existe todavía.

| Entidad                                                                                                                            | Fase | Motivo                                                     | UPDATE                                | DELETE físico |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- | ------------------------------------- | ------------- |
| Columnas en `app.users`: `failed_login_count`, `locked_until`, `password_changed_at` (se reutiliza `password_hash`, que ya existe) | F1.5 | Bloqueo por intentos y política de contraseñas             | Sí                                    | No            |
| Columna en `platform.permissions`: `assignable` (y un control que impida asignar a roles los permisos no asignables)               | F1.5 | Que los permisos de infraestructura nunca lleguen a un rol | Sí (catálogo)                         | No            |
| `app.credential_tokens`                                                                                                            | F1.5 | Activación y restablecimiento de un solo uso               | Solo `used_at` y `revoked_at`         | No            |
| `app.user_sessions`                                                                                                                | F1.5 | Sesión persistente y revocable                             | Solo estado, tiempos, IP y MFA        | No            |
| `app.session_refresh_tokens`                                                                                                       | F1.5 | Rotación con detección de reutilización                    | Solo `used_at` y `revoked_at`         | No            |
| Columna en `app.roles`: `requires_mfa`                                                                                             | F1.6 | Roles que exigen MFA                                       | Sí                                    | —             |
| `app.user_mfa_factors`                                                                                                             | F1.6 | Factor TOTP con el secreto cifrado                         | Solo estado y `last_used_step`        | No            |
| `app.user_recovery_codes`                                                                                                          | F1.6 | Códigos de recuperación de un solo uso                     | Solo `used_at` y `revoked_at`         | No            |
| `app.mfa_challenges`                                                                                                               | F1.6 | Desafío MFA de vida corta, distinto del access token       | Solo estado, intentos y `consumed_at` | No            |
| Guarda de sucursal en `audit.audit_events`: clave foránea compuesta `(laboratory_id, branch_id)` + trigger `branch_visible`        | F1.4 | Que la base impida registrar una sucursal ajena            | —                                     | —             |

**Reglas comunes:**

- `laboratory_id`, `kernel.enable_tenant_rls(...)` y claves foráneas compuestas en todas las tablas de laboratorio.
- `microslab_app` recibe `SELECT, INSERT, UPDATE` y nunca `DELETE`.
- La retención queda sujeta a D-09.

**Lo que no se crea en F1:**

- tablas de planes, suscripciones o billing (son de F2);
- tabla de "memberships" (el usuario pertenece a un único laboratorio);
- lista de revocación de JWT;
- contador de "versión de credenciales" (revocar sesiones cumple esa función).

## 4. Modelo de amenazas de F1

| Amenaza                                    | Defensa                                                                                                                                                                                     | Fase        | Prueba requerida                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Robo del access token                      | Vida corta (10 min); cada petición comprueba en la base que la sesión `sid` siga activa; token solo en memoria                                                                              | F1.5        | Un token válido cuya sesión está revocada recibe 401 `SESSION_REVOKED`                                                          |
| Robo del refresh token                     | Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, host-only, ruta `/api/v1/auth`; 256 bits aleatorios guardados solo como hash; rotación en cada uso                                          | F1.5        | El refresh anterior deja de servir tras rotar                                                                                   |
| Replay del access token                    | `exp` obligatorio y corto; `sid` comprobado en la base                                                                                                                                      | F1.5        | Token vencido: 401 `TOKEN_EXPIRED`; sin `exp`: 401 `TOKEN_INVALID`                                                              |
| Reutilización del refresh                  | Un refresh ya usado revoca **toda la sesión** y se audita                                                                                                                                   | F1.5        | Dos usos del mismo refresh revocan la sesión                                                                                    |
| Permisos inflados en el token              | El token no contiene autorización; los claims de más se ignoran                                                                                                                             | F1.3        | Un token con `perms: ["*"]` no concede nada                                                                                     |
| Laboratorio del token distinto al del host | `lab` es solo una comprobación de consistencia contra el laboratorio del host                                                                                                               | F1.3        | `lab` distinto: 401 `TOKEN_INVALID`                                                                                             |
| `x-branch-id` manipulado                   | Validación contra las sucursales resueltas en la base; trigger y clave foránea en la auditoría                                                                                              | F1.4        | Sucursal ajena, de otro laboratorio, inexistente o no UUID: 403 o 400, y nunca llega a `audit_events.branch_id`                 |
| Uso del actor `platform` como atajo        | No hay regla por tipo de actor; runner cerrado con mínimo privilegio; permisos de infraestructura no asignables                                                                             | F1.5        | Un rol no puede recibir `security.admin.bootstrap`; un comando fuera de la lista de infraestructura no se ejecuta por el runner |
| Desafío MFA usado como access token        | El desafío es opaco, no es un JWT, y solo lo acepta `/auth/mfa/*`                                                                                                                           | F1.6        | Presentar el desafío como Bearer: 401 `TOKEN_INVALID`                                                                           |
| Replay o reutilización del desafío MFA     | Uso único, 5 min, máximo 5 intentos, bloqueo de fila al consumirlo                                                                                                                          | F1.6        | Segundo uso: 401 `CHALLENGE_INVALID`                                                                                            |
| Usuario bloqueado                          | Bloquear revoca sus sesiones; la resolución exige `status = 'active'`                                                                                                                       | F1.3 · F1.5 | Usuario `locked` con token vigente: 401                                                                                         |
| Laboratorio suspendido o cerrado           | La resolución consulta el estado operativo del laboratorio                                                                                                                                  | F1.3        | 403 `LABORATORY_UNAVAILABLE`                                                                                                    |
| Cambio de contraseña                       | Revoca las demás sesiones del usuario                                                                                                                                                       | F1.5        | Las sesiones anteriores reciben 401                                                                                             |
| Logout                                     | Revoca la sesión y borra la cookie                                                                                                                                                          | F1.5        | Tras el logout, el access token recibe 401 y el refresh es rechazado                                                            |
| Sesión antigua                             | Expiración por inactividad y absoluta                                                                                                                                                       | F1.5        | Una sesión que pasó su límite absoluto no refresca                                                                              |
| Fuerza bruta                               | Contador por cuenta con bloqueo progresivo; límite por IP y por cuenta                                                                                                                      | F1.5        | Tras N fallos, bloqueo temporal                                                                                                 |
| Enumeración de usuarios                    | Misma respuesta y mismo tiempo en todos los fallos de login (hash ficticio si el usuario no existe)                                                                                         | F1.5        | Respuestas idénticas; tiempos dentro de un margen                                                                               |
| CSRF, incluido desde subdominios hermanos  | `SameSite=Strict` **no basta**, porque los subdominios de dos laboratorios son el mismo _site_. Se exige también `Origin` exacto, cabecera propia y, como defensa adicional, Fetch Metadata | F1.5        | Un POST desde otro laboratorio (mismo _site_, otro origen) es rechazado                                                         |
| XSS con token en el navegador              | Access token solo en memoria; refresh inaccesible para JavaScript; CSP en F1.8                                                                                                              | F1.5 · F1.8 | No se usa `localStorage` ni `sessionStorage` para credenciales                                                                  |
| `device_id` falsificado                    | Es un dato informativo enviado por el cliente y no confiable; nunca autentica ni autoriza                                                                                                   | F1.5        | Cambiar `device_id` no altera ninguna decisión de acceso                                                                        |

## 5. Matriz F1.3 → F1.6

|                  | F1.3 Autorización desde la base                                                                                                                                                                                                                        | F1.4 Contexto de sucursal                                                         | F1.5 JWT, sesiones y hardening                                                                                                      | F1.6 MFA                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objetivo**     | La base es la única fuente de permisos, sucursales y estado. La habilitación de módulos queda separada                                                                                                                                                 | `x-branch-id` es solo contexto validado; la auditoría no acepta sucursales ajenas | Pipeline de autenticación, runner de infraestructura, sesiones revocables, bloqueo por intentos, 401/403, CSRF                      | Segundo factor para usuarios de laboratorio, con desafío separado del token                                                                                            |
| **Cambios**      | `AccessResolver` en el middleware; proveedor de habilitación estático; códigos de error nuevos; los claims de autorización del token se ignoran                                                                                                        | Validación del header, sucursal activa derivada, guarda en la base                | Login, refresh, logout, activación y cambio de contraseña; runner de infraestructura; firma asimétrica con `kid`; cookie de refresh | Alta del factor, desafío, verificación, códigos de recuperación, reset, reautenticación                                                                                |
| **Dependencias** | Tablas de F0                                                                                                                                                                                                                                           | F1.3                                                                              | F1.3, F1.4; decisiones B–G y N                                                                                                      | F1.5; decisión J; llave de cifrado (D-10)                                                                                                                              |
| **Migraciones**  | Ninguna                                                                                                                                                                                                                                                | `0006`: clave foránea compuesta y trigger en la auditoría                         | `0007`: columnas de `app.users`, `platform.permissions.assignable`, `credential_tokens`, `user_sessions`, `session_refresh_tokens`  | `0008`: `roles.requires_mfa`, `user_mfa_factors`, `user_recovery_codes`, `mfa_challenges`, columnas de MFA en `user_sessions`                                          |
| **Pruebas**      | Permisos inflados; rol inactivo; sin rol; usuario inexistente o no activo; laboratorio no disponible; unión de roles; `all_branches`; comando legítimo de F1 no bloqueado por habilitación; módulo de plan sin habilitar bloqueado aunque haya permiso | Matriz de ataques de `x-branch-id`; el trigger rechaza una inserción directa      | Casos de la sección 4 para token, sesión, refresh, CSRF y runner de infraestructura                                                 | Desafío: uso único, vencimiento, límite de intentos, no aceptado como Bearer; TOTP con anti-replay; recuperación; reset; sesiones al activar; regla de "cualquier rol" |
| **Riesgos**      | Latencia; romper los tests de F0                                                                                                                                                                                                                       | Un bug del trigger bloquea escrituras legítimas                                   | Complejidad de rotación; cookies en desarrollo; autenticación del operador antes de F2                                              | Pérdida del segundo factor; custodia de la llave                                                                                                                       |
| **Aceptación**   | §8                                                                                                                                                                                                                                                     | §8                                                                                | §8                                                                                                                                  | §8                                                                                                                                                                     |
| **No toca**      | RLS, contrato del CommandBus, auditoría, outbox, frontend                                                                                                                                                                                              | CommandBus, sesiones, JWT                                                         | RLS de F0; contrato del CommandBus; frontend (F1.8)                                                                                 | Usuarios de plataforma (F2); WebAuthn                                                                                                                                  |

## 6. Migraciones y compatibilidad

- **Hecho clave:** hoy **no existe ningún emisor de tokens**, así que no hay sesiones reales que mantener. La compatibilidad temporal afecta solo a pruebas y desarrollo.
- **Orden:** `0006` (F1.4), `0007` (F1.5), `0008` (F1.6). Solo agregan.
  - `0006` agrega una clave foránea sobre `audit.audit_events`. Antes hay que verificar que las filas actuales la cumplen; hoy solo hay datos de prueba.
- **Entre F1.3 y F1.5:** F1.3 sigue aceptando el token HS256 actual **solo para identidad** (`sub`, `lab` como comprobación) e ignora `perms`, `modules`, `branches` y `allBranches`. F1.5 introduce la firma asimétrica y exige `sid`.
- **Datos de prueba:** `infra/db/tests/fixtures.sql` se amplía con roles, permisos, `user_roles` y `user_branches` para los laboratorios A y B, sin cambiar las filas existentes.
- **Tests que construyen `TenantContext` a mano:** se conservan, porque prueban el CommandBus, cuyo contrato no cambia. La resolución desde la base y el middleware se prueban aparte, contra PostgreSQL y por HTTP.
- **Rollback:**
  - cada bloque va en sus propios commits y PR, con merge commit;
  - las migraciones son de avance: revertir es aplicar una migración nueva que desactive el trigger o deje de usar una tabla, sin borrar datos;
  - hasta cerrar F1.5 se puede volver a HS256 revirtiendo el PR.

## 7. Rendimiento

Detalle en `F1_2_AUTHZ.md` §5.

- **Costo:** una transacción de lectura por petición autenticada, con dos o tres consultas parametrizadas: usuario, sesión y laboratorio; roles, permisos y sucursales; y la sucursal activa solo cuando hace falta.
- **Índices:** alcanzan las claves primarias existentes y las de las tablas nuevas. El único índice adicional es el parcial de sesiones activas por usuario.
- **Escrituras:** `last_seen_at` se actualiza solo al refrescar, no en cada petición.
- **Caché: no se agrega.** Solo se consideraría si la resolución supera un umbral medido (propuesta: p95 > 15 ms, o más del 20 % de la carga de la base). Aun así:
  - el estado de la sesión, el estado del usuario, los permisos y las sucursales **nunca** se convierten en fuente de verdad en caché;
  - la base de datos sigue siendo la fuente de verdad;
  - Redis, si se usa en el futuro para esto, no la sustituye.

## 8. Criterios de aceptación

**F1.2 (diseño) terminado cuando:**

1. Estos cinco documentos estén aprobados, con cada decisión A–N marcada como aprobada, modificada o diferida.
2. La ADR 0031 esté redactada y aprobada.
3. El alcance de F1 (decisión A) esté aprobado y los cambios documentales de la sección 9 estén autorizados.
4. Las dependencias de D-10 (llaves de firma, llave de cifrado de MFA, autenticación del operador) tengan una solución provisional aprobada.

**F1.3:**

- Ningún permiso, sucursal ni laboratorio sale del token (probado con un token inflado y con un `lab` distinto).
- La habilitación de módulos sale del proveedor estático; un comando legítimo de F1 no se bloquea; un módulo de plan sin habilitar se bloquea aunque haya permiso.
- Los estados de usuario, rol y laboratorio responden con el código definido.
- Las pruebas de F0 y el CI completo pasan.

**F1.4:**

- Los casos del contrato de `x-branch-id` responden como está definido.
- Una inserción directa en la auditoría con una sucursal no visible es rechazada por la base.
- No existe ningún camino por el que el cliente fije `audit_events.branch_id`.

**F1.5:**

- El token contiene solo lo definido en la decisión D.
- Hay pruebas de expiración, revocación, rotación, reutilización, logout, cambio de contraseña, bloqueo, enumeración, CSRF (incluido el subdominio hermano) y del runner de infraestructura (mínimo privilegio, motivo, idempotencia sin secretos en la respuesta guardada).
- No hay secretos en el código.
- Producción no arranca con un secreto o llave de ejemplo.

**F1.6:**

- Si **cualquier** rol activo del usuario exige MFA, no hay sesión sin TOTP verificado.
- El desafío MFA no se acepta como access token, es de un solo uso y vence.
- TOTP con anti-replay; códigos de recuperación de un solo uso.
- Reset solo por administrador (con motivo) o por el runner de infraestructura.
- Las demás sesiones se revocan al activar el MFA.

## 9. Documentación existente que habría que actualizar (no se modifica ahora)

| Documento                                                        | Cambio propuesto                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/ARCHITECTURE_FREEZE.md` §33 y §33.1 (fila F1) | Registrar lo que se difiere de F1 según la decisión A                                                                                                   |
| `ARCHITECTURE_FREEZE.md` §6                                      | Aclarar que el MFA de Super Admin llega con los usuarios de plataforma en F2                                                                            |
| `ARCHITECTURE_FREEZE.md` §5 y §11                                | Remitir a la ADR 0031 para la separación entre estado operativo del laboratorio y estado de suscripción                                                 |
| `docs/adr/0003-comandos-auditoria-outbox.md` (adenda)            | Registrar los tres caminos de ejecución; la fase de la reautenticación (F1.6); `client_time`/`offline` con el modo sin conexión; actor `provider` en F7 |
| `docs/adr/0004-desviaciones-fase-0.md`                           | Nota: superada en permisos por la ADR 0031 cuando se apruebe                                                                                            |
| `docs/f1/F1_PLAN.md`                                             | F1.2 = diseño aprobado; enlaces a estos documentos; criterios actualizados                                                                              |
| `packages/contracts/src/permissions.json`                        | En F1.5: permisos nuevos y marca `assignable`                                                                                                           |
| `.env.example`                                                   | En F1.5: reemplazar `JWT_SECRET` por la configuración de llaves                                                                                         |
