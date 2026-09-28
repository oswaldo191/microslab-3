# F1.2 — Diseño de seguridad de F1 (borrador para aprobación)

**Estado:** BORRADOR, sin aprobar. No hay código, migraciones ni commits.
**Base:** `main` en `2de3a86`, Architecture Freeze v2.2 y la auditoría de F1.2 del 27/09/2026.
**Alcance del documento:** diseño de F1.3 (autorización desde la base), F1.4 (contexto de sucursal), F1.5 (JWT, sesiones y hardening) y F1.6 (MFA).

## 0. Documentos propuestos en `docs/f1/`

| Documento               | Contenido                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `F1_2_DESIGN.md` (este) | Índice, alcance, reglas de arquitectura, modelo de datos resumido, amenazas, matriz F1.3–F1.6, migraciones y compatibilidad, rendimiento y criterios de aceptación |
| `F1_2_DECISIONS.md`     | Matriz de decisiones A–K, cada una con problema, opciones, recomendación, impacto, riesgos, alternativas descartadas y fase                                        |
| `F1_2_AUTHZ.md`         | Flujo de autorización desde la base, casos de estado, contrato de `x-branch-id` y consultas                                                                        |
| `F1_2_SESSIONS_JWT.md`  | Access token, sesiones, refresh, revocación, 401/403, contraseñas y alta del primer usuario                                                                        |
| `F1_2_MFA.md`           | Diseño de MFA para usuarios de laboratorio y lo que queda para F2                                                                                                  |

### ADR

**Una sola ADR nueva es necesaria: `0031-identidad-sesiones-autorizacion.md` (Propuesta).**

Por qué hace falta:

- Cambia una decisión vigente: la ADR 0004 dejó los permisos en el token "solo en F0", y ahora se fija la fuente de verdad definitiva.
- Define un contrato que todas las aplicaciones cliente heredarán (web, consola y portales): qué es el token, cómo se transporta la sesión y qué significan 401 y 403.
- Aclara la diferencia entre `platform.laboratories.status` y el estado de suscripción de F2, sin contradecir C-04.

El resto de decisiones (algoritmo de contraseñas, factor de MFA, parámetros y el tipo de actor `ai`) son de implementación. Se registran en `F1_2_DECISIONS.md` y no requieren ADR.

## 1. Reglas de arquitectura que este diseño respeta

- PostgreSQL con RLS forzado sigue siendo la autoridad del aislamiento. Ninguna validación de aplicación lo reemplaza; solo se suma a él.
- Toda escritura pasa por el CommandBus, incluidos login, logout, activación, cambio de contraseña y MFA. Sus efectos quedan en la auditoría encadenada y en el outbox.
- `TenantContext` conserva su forma. Lo único que cambia es **de dónde salen** `permissions`, `enabledModules`, `branchIds`, `allBranches` y `activeBranchId`: de la base, no del token.
- Idempotencia, secuencias, outbox y cadena de auditoría no se modifican.
- Nada de este diseño modifica el Architecture Freeze. Los ajustes documentales que el Freeze necesitará se listan en la sección 9.

## 2. Modelo de datos propuesto (resumen)

Todo son **propuestas**; nada existe todavía. El detalle está en `F1_2_SESSIONS_JWT.md` y en `F1_2_MFA.md`.

| Entidad                                                                                                                                   | Fase | Motivo                                                                        | UPDATE                              | DELETE físico |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------- | ------------- |
| Columnas nuevas en `app.users`: `failed_login_count`, `locked_until`, `password_changed_at` (se reutiliza `password_hash`, que ya existe) | F1.5 | Bloqueo por intentos e invalidación al cambiar la contraseña                  | Sí                                  | No            |
| `app.credential_tokens`                                                                                                                   | F1.5 | Activación del primer acceso y restablecimiento de contraseña, de un solo uso | Solo `used_at` y `revoked_at`       | No            |
| `app.user_sessions`                                                                                                                       | F1.5 | Sesión persistente, revocable, con dispositivo, IP y agente                   | Solo estado, tiempos y nivel de MFA | No            |
| `app.session_refresh_tokens`                                                                                                              | F1.5 | Rotación del refresh con detección de reutilización                           | Solo `used_at` y `revoked_at`       | No            |
| `app.roles.requires_mfa` (columna nueva)                                                                                                  | F1.6 | Qué roles exigen MFA                                                          | Sí                                  | —             |
| `app.user_mfa_factors`                                                                                                                    | F1.6 | Factor TOTP con el secreto cifrado                                            | Solo estado y `last_used_step`      | No            |
| `app.user_recovery_codes`                                                                                                                 | F1.6 | Códigos de recuperación de un solo uso                                        | Solo `used_at`                      | No            |
| Guarda de sucursal en `audit.audit_events` (clave foránea compuesta + trigger `branch_visible`)                                           | F1.4 | Que la base impida registrar una sucursal ajena                               | —                                   | —             |

**Reglas comunes a todas las tablas nuevas:**

- `laboratory_id`, `kernel.enable_tenant_rls(...)` y claves foráneas compuestas.
- El rol `microslab_app` recibe `SELECT, INSERT, UPDATE` y **nunca** `DELETE`.
- La retención queda sujeta a D-09. No se purga nada sin esa decisión.

**Lo que no se crea:**

- Ninguna tabla de "memberships": el usuario pertenece a un único laboratorio.
- Ninguna lista de revocación de JWT: la sesión se consulta en cada petición.
- Ningún contador de "versión de credenciales": revocar las sesiones cumple esa función.
- Ninguna tabla de planes: es de F2.

## 3. Modelo de amenazas de F1

| Amenaza                       | Defensa                                                                                                                                                                                  | Fase        | Prueba requerida                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| Robo del access token         | Vida corta (propuesta: 10 min). Cada petición comprueba que la sesión (`sid`) siga activa, así que el token muere al revocar la sesión. Nunca se guarda en `localStorage`                | F1.5        | Un token válido cuya sesión está revocada recibe 401 `SESSION_REVOKED`                                          |
| Robo del refresh token        | Cookie `HttpOnly; Secure; SameSite=Strict` con ruta restringida; valor aleatorio de 256 bits guardado solo como hash; rotación en cada uso                                               | F1.5        | El refresh se rota y el anterior deja de servir                                                                 |
| Replay del access token       | `exp` corto y `sid` comprobado en la base. `jti` sirve para trazabilidad, no como lista de revocación                                                                                    | F1.5        | Un token vencido recibe 401 `TOKEN_EXPIRED`; uno sin `exp` recibe 401 `TOKEN_INVALID`                           |
| Reutilización del refresh     | Si llega un refresh ya usado, se revoca **toda la sesión** y queda auditado                                                                                                              | F1.5        | Presentar dos veces el mismo refresh revoca la sesión y deja un evento de auditoría                             |
| Permisos inflados en el token | El token no contiene permisos. Si trae claims de más, se ignoran                                                                                                                         | F1.3        | Un token con `perms: ["*"]` no concede nada                                                                     |
| `x-branch-id` manipulado      | Se valida contra las sucursales permitidas resueltas en la base. Además, un trigger en la auditoría rechaza sucursales no visibles                                                       | F1.4        | Sucursal ajena, de otro laboratorio, inexistente o no UUID: 403 o 400, y nunca llega a `audit_events.branch_id` |
| Usuario bloqueado             | Bloquearlo revoca sus sesiones; la resolución exige `status = 'active'`                                                                                                                  | F1.3 · F1.5 | Un usuario `locked` con token vigente recibe 401                                                                |
| Laboratorio suspendido        | La resolución consulta `platform.laboratories.status` (decisión H2 en `F1_2_AUTHZ.md`)                                                                                                   | F1.3        | Un laboratorio `closed` o `suspended` recibe 403 `LABORATORY_UNAVAILABLE`                                       |
| Cambio de contraseña          | Revoca todas las demás sesiones del usuario                                                                                                                                              | F1.5        | Tras el cambio, las sesiones anteriores reciben 401                                                             |
| Logout                        | Revoca la sesión en la base y borra la cookie                                                                                                                                            | F1.5        | Tras el logout, el access token recibe 401 y el refresh es rechazado                                            |
| Sesión antigua                | Expiración por inactividad y expiración absoluta                                                                                                                                         | F1.5        | Una sesión que pasó su límite absoluto no puede refrescarse                                                     |
| Fuerza bruta                  | Contador por cuenta con bloqueo progresivo, más límite por IP y por cuenta en Redis (ya disponible por BullMQ, sin dependencia nueva)                                                    | F1.5        | Tras N fallos, bloqueo temporal; la contraseña correcta no entra mientras dura                                  |
| Enumeración de usuarios       | Misma respuesta y mismo tiempo para usuario inexistente, contraseña errónea, cuenta invitada o bloqueada (se calcula un hash ficticio)                                                   | F1.5        | Las respuestas son idénticas y los tiempos están dentro de un margen                                            |
| CSRF (por usar cookie)        | `SameSite=Strict`, cookie limitada a `/api/v1/auth`, verificación de `Origin` y cabecera obligatoria `X-Requested-With`. El refresh solo devuelve el token a JavaScript del mismo origen | F1.5        | Un POST desde otro origen es rechazado                                                                          |
| XSS (token en el navegador)   | Access token solo en memoria; refresh inaccesible para JavaScript; CSP en F1.8                                                                                                           | F1.5 · F1.8 | Revisión de que no se usa `localStorage` ni `sessionStorage` para tokens                                        |

## 4. Matriz F1.3 → F1.6

|                  | F1.3 Autorización desde la base                                                                                                      | F1.4 Seguridad del contexto de sucursal                                           | F1.5 JWT, sesiones y hardening                                                                                                              | F1.6 MFA                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Objetivo**     | La base es la única fuente de permisos, módulos, sucursales y estado                                                                 | `x-branch-id` es solo contexto validado; la auditoría no acepta sucursales ajenas | Emisión segura, sesiones revocables, bloqueo por intentos, 401/403                                                                          | Segundo factor para usuarios de laboratorio en los roles que lo exijan                                                      |
| **Cambios**      | `AccessResolver` usado por el middleware; nuevos códigos de error; se ignoran los claims de autorización del token                   | Validación del header, sucursal activa por defecto, guarda en la base             | Login, refresh, logout, activación y cambio de contraseña como comandos; firma asimétrica con `kid`; cookie de refresh; límites de intentos | Alta del factor, verificación, códigos de recuperación, reset por administrador, reautenticación                            |
| **Dependencias** | Tablas existentes de F0                                                                                                              | F1.3                                                                              | F1.3 y F1.4; decisiones C, D, E y F                                                                                                         | F1.5; decisión J; llave de cifrado (D-10)                                                                                   |
| **Migraciones**  | Ninguna (los índices de las claves primarias bastan)                                                                                 | `0006`: clave foránea compuesta y trigger en `audit.audit_events`                 | `0007`: columnas de `app.users`, `credential_tokens`, `user_sessions`, `session_refresh_tokens`, permisos nuevos                            | `0008`: `roles.requires_mfa`, `user_mfa_factors`, `user_recovery_codes`, columnas de MFA en `user_sessions`                 |
| **Pruebas**      | Permisos inflados, rol inactivo, sin rol, usuario inexistente o no activo, laboratorio no disponible, unión de roles, `all_branches` | Matriz de ataques de `x-branch-id`; el trigger rechaza una inserción directa      | Casos de la sección 3 en expiración, revocación, reutilización, fuerza bruta, enumeración y CSRF                                            | Alta, código correcto e incorrecto, anti-replay de TOTP, códigos de recuperación de un solo uso, reset, sesiones al activar |
| **Riesgos**      | Latencia; romper los tests de F0                                                                                                     | Un bug del trigger bloquea escrituras legítimas                                   | Complejidad de rotación; cookies en desarrollo                                                                                              | Pérdida del segundo factor; custodia de la llave de cifrado                                                                 |
| **Aceptación**   | Sección 8                                                                                                                            | Sección 8                                                                         | Sección 8                                                                                                                                   | Sección 8                                                                                                                   |
| **No toca**      | RLS, CommandBus, auditoría, outbox, frontend                                                                                         | CommandBus, sesiones, JWT                                                         | RLS de F0, CommandBus salvo los comandos nuevos, frontend (F1.8)                                                                            | Usuarios de plataforma (F2), WebAuthn                                                                                       |

## 5. Migraciones y compatibilidad

- **Hecho clave:** hoy **no existe ningún emisor de tokens**, así que no hay sesiones ni tokens reales en uso. La compatibilidad temporal solo afecta a pruebas y desarrollo.
- **Orden de migraciones:** `0006` (F1.4), `0007` (F1.5), `0008` (F1.6). Todas solo agregan; ninguna modifica ni borra datos existentes.
  - `0006` agrega una clave foránea sobre `audit.audit_events`. Antes hay que comprobar que no existan filas con sucursales inválidas; hoy solo hay datos de prueba.
- **Compatibilidad entre F1.3 y F1.5:**
  - F1.3 sigue aceptando el token HS256 actual, pero **solo** para identidad (`sub`, `lab`); ignora `perms`, `modules`, `branches` y `allBranches`.
  - F1.5 reemplaza HS256 por firma asimétrica y exige `sid`. Desde ese momento, un token sin `sid` es inválido.
- **Datos de prueba:** `infra/db/tests/fixtures.sql` se amplía con roles, `role_permissions`, `user_roles` y `user_branches` para los laboratorios A y B, sin cambiar las filas existentes.
- **Tests que construyen `TenantContext` a mano** (`test/support/context.ts`):
  - **Se conservan.** Prueban el CommandBus, cuyo contrato no cambia.
  - La resolución desde la base se prueba aparte: pruebas nuevas de `AccessResolver` contra PostgreSQL, y pruebas HTTP del middleware con tokens de prueba firmados con una llave de prueba.
- **Rollback:**
  - Cada bloque es su propio conjunto de commits dentro de su PR, con merge commit (sin squash), así que se puede revertir por bloque.
  - Las migraciones son de avance. Revertir significa aplicar una migración nueva que desactive el trigger o deje de usar las tablas; nunca se borran datos.
  - Hasta cerrar F1.5 se puede volver a HS256 revirtiendo el PR.

## 6. Rendimiento

- **Costo por petición autenticada:** una transacción de lectura con dos o tres consultas:
  - usuario + sesión + laboratorio;
  - roles, permisos y sucursales;
  - la sucursal activa, solo si viene `x-branch-id` o el usuario tiene `all_branches`.
- **Índices:** alcanzan las claves primarias existentes (`user_roles`, `role_permissions` y `user_branches` empiezan por `laboratory_id` y el usuario o rol). Se proponen solo los índices nuevos de sesiones: `(laboratory_id, user_id) WHERE revoked_at IS NULL` y el hash del refresh (único).
- **Estimación:** pocos milisegundos con la base en la misma región. Es la misma cantidad de viajes que una transacción de comando pequeña.
- **Límites:** `last_seen_at` se actualiza solo al refrescar, no en cada petición, para no escribir por lectura.
- **Caché: no se agrega.** Solo se introduciría si la resolución supera un umbral medido (propuesta: p95 > 15 ms, o que represente más del 20 % de la carga de la base). Diseño previsto:
  - caché por `(laboratory_id, user_id, sid)` con TTL ≤ 30 s;
  - invalidación con las columnas `version` que **ya existen** en `app.users` y `app.roles`;
  - una sesión revocada se comprueba siempre en la base, sin caché.

## 7. Qué queda fuera de F1.3–F1.6

- Usuarios y MFA de plataforma (Super Admin): F2.
- Gestión de usuarios y roles desde la interfaz: F2 (C-12).
- Recuperación de contraseña por correo por parte del propio usuario: requiere el correo de `notifications` (F6).
- WebAuthn o passkeys: después de V1.
- Planes y módulos por plan: F2. Hasta entonces, `enabledModules` queda vacío, y los módulos de F1 no dependen del plan.

## 8. Criterios de aceptación

**F1.2 (diseño) terminado cuando:**

1. Estos cinco documentos y la ADR 0031 estén aprobados, con cada decisión A–K resuelta como aprobada, modificada o diferida.
2. El alcance de F1 (decisión A) esté aprobado y los cambios documentales de la sección 9 estén autorizados.
3. Las decisiones que dependen de D-10 (llaves, cifrado) tengan una solución provisional aprobada.

**F1.3:**

- Ningún permiso, módulo o sucursal sale del token; está probado con un token inflado.
- Los estados de usuario, rol y laboratorio de `F1_2_AUTHZ.md` responden con el código definido.
- Las pruebas de F0 siguen en verde y el CI completo pasa.

**F1.4:**

- Los seis casos de `x-branch-id` responden según el contrato.
- Una inserción directa en la auditoría con una sucursal no visible es rechazada por la base.
- No existe ningún camino por el que el cliente fije `audit_events.branch_id`.

**F1.5:**

- El token contiene solo lo definido en D.
- Hay pruebas de expiración, revocación, rotación, reutilización, logout, cambio de contraseña, bloqueo, enumeración y CSRF.
- No hay secretos en el código.
- `.env.example` no permite arrancar en producción con un secreto de ejemplo.

**F1.6:**

- Los roles con `requires_mfa` no operan sin factor activo.
- TOTP con anti-replay; códigos de recuperación de un solo uso.
- Reset solo por administrador, con motivo y auditoría.
- Las demás sesiones se revocan al activar el MFA.

## 9. Documentación existente que habría que actualizar (no se modifica ahora)

| Documento                                                        | Cambio propuesto                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/ARCHITECTURE_FREEZE.md` §33 y §33.1 (fila F1) | Registrar lo que se difiere de F1 según la decisión A                                                                             |
| `ARCHITECTURE_FREEZE.md` §6                                      | Aclarar que el MFA de Super Admin llega con los usuarios de plataforma en F2                                                      |
| `docs/adr/0003-comandos-auditoria-outbox.md` (adenda)            | Fijar en qué fase llegan la reautenticación (F1.6), `client_time`/`offline` (con el modo sin conexión) y el actor `provider` (F7) |
| `docs/adr/0004-desviaciones-fase-0.md`                           | Nota: superada en permisos por la ADR 0031 cuando se apruebe                                                                      |
| `docs/f1/F1_PLAN.md`                                             | F1.2 = diseño aprobado; enlaces a estos documentos; criterios de aceptación actualizados                                          |
| `.env.example`                                                   | Solo en F1.5: reemplazar `JWT_SECRET` por la configuración de llaves                                                              |
