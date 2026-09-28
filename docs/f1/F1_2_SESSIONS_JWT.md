# F1.2 — Access token, sesiones, contraseñas y alta de usuarios (borrador)

Este documento cubre F1.5. Todo es **propuesta**; las decisiones de fondo están en `F1_2_DECISIONS.md` (B, C, D, E, F y G).

## 1. Access token

- **Claims:** `sub`, `lab`, `sid`, `iss = microslab`, `aud = microslab-api`, `iat`, `exp`, `jti`.
- **Cabecera:** `alg` = EdDSA (o ES256), `kid`, `typ = at+jwt`.
- **Vida:** 10 minutos, configurable. `exp` es obligatorio.
- **Validación con `jose`:**
  - lista blanca de un solo algoritmo;
  - `requiredClaims` = `sub`, `lab`, `sid`, `exp`, `iat`, `jti`;
  - tolerancia de reloj pequeña (≤ 30 s);
  - `kid` desconocido se rechaza con 401 `TOKEN_INVALID`.
- **Llaves:**
  - un par activo para firmar, más las llaves públicas anteriores mientras vivan sus tokens (10 minutos);
  - se cargan de variables de entorno o de un archivo de secretos montado hasta que exista D-10;
  - nunca están en el repositorio, en logs ni en respuestas.
- **Arranque en producción:** la configuración se niega a arrancar con un secreto de ejemplo o con llaves ausentes.

## 2. Sesión

- **Estados:** `active` → `revoked` (con motivo) o vencida (por inactividad o por límite absoluto).
- **Cada petición** comprueba que `sid` pertenece a `sub`, que la sesión está activa y que no está vencida. Revocar la sesión corta el access token de inmediato.
- **Refresh:** `POST /api/v1/auth/refresh`, con cookie `__Secure-ms_rt`.
  - El valor tiene la forma `<id del token>.<256 bits aleatorios>`. En la base se guarda solo `sha256(secreto)`.
  - En cada uso se marca `used_at`, se emite uno nuevo y se extiende la inactividad sin superar el límite absoluto.
  - **Reutilización:** si llega un token con `used_at` ya fijado, se revoca **toda** la sesión con motivo `reuse_detected` y se audita.
- **Logout:** `POST /api/v1/auth/logout` revoca la sesión y borra la cookie.
- **Cambio de contraseña:** revoca todas las demás sesiones del usuario. La actual sigue viva.
- **Bloqueo, baja o reset de credenciales o MFA:** revoca todas las sesiones del usuario.
- **Sesiones concurrentes:** máximo configurable (propuesta: 5). Al superarlo se revoca la más antigua, con motivo `session_limit`.
- **Qué se guarda y qué solo se audita:**

| Dato                                           | Se guarda en la sesión | Solo se audita                                         |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| IP y agente al crear y en el último refresh    | Sí                     | —                                                      |
| `device_id` (informativo, lo envía el cliente) | Sí                     | —                                                      |
| Creación, último refresh, vencimientos         | Sí                     | —                                                      |
| Nivel de MFA de la sesión                      | Sí (F1.6)              | —                                                      |
| Login correcto                                 | —                      | Sí (`security.session.created`)                        |
| Login fallido                                  | —                      | Sí (`security.login.failed`), con límite de frecuencia |
| Logout y revocaciones                          | Estado + motivo        | Sí                                                     |
| Reutilización del refresh                      | Estado + motivo        | Sí                                                     |
| Refresh correcto                               | Tiempos                | No (evita inundar la cadena de auditoría)              |

## 3. Modelo de datos propuesto (F1.5)

### 3.1 Columnas nuevas en `app.users`

`password_hash` **ya existe** y se reutiliza. Se agregan:

| Columna               | Propósito                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `failed_login_count`  | Intentos fallidos consecutivos                                                                    |
| `locked_until`        | Bloqueo temporal por intentos (distinto de `status = 'locked'`, que es un bloqueo administrativo) |
| `password_changed_at` | Política de contraseñas y auditoría                                                               |

- **Actualización:** sí, por comandos; `version` ya existe.
- **Borrado físico:** no.
- **Consultas:** las listas de usuarios nunca seleccionan `password_hash`, y la auditoría ya oculta toda clave que contenga `hash`.

### 3.2 `app.credential_tokens`

- **Propósito:** tokens de un solo uso para activación y restablecimiento.
- **Columnas:**
  - `id`, `laboratory_id`, `user_id`;
  - `purpose` (`activation` o `reset`);
  - `token_hash` (SHA-256, único);
  - `expires_at`, `used_at`, `revoked_at`;
  - `created_at`, `created_by_type`, `created_by`.
- **Claves:** primaria `id`; foránea compuesta `(laboratory_id, user_id)` → `app.users`.
- **Índices:** único en `token_hash`; `(laboratory_id, user_id) WHERE used_at IS NULL AND revoked_at IS NULL`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** emisión, uso y revocación.
- **Retención:** según D-09.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.

### 3.3 `app.user_sessions`

- **Columnas:**
  - `id` (el `sid`, UUID v7), `laboratory_id`, `user_id`;
  - `created_at`, `last_refresh_at`, `idle_expires_at`, `absolute_expires_at`;
  - `created_ip`, `last_ip`, `user_agent` (truncado), `device_id`;
  - `revoked_at`, `revoked_reason`, `revoked_by`;
  - en F1.6: `mfa_verified_at` y `last_reauth_at`.
- **Claves:** primaria `id`; foránea compuesta `(laboratory_id, user_id)`.
- **Índices:** `(laboratory_id, user_id) WHERE revoked_at IS NULL`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** creación y revocación.
- **Actualización:** tiempos, IP y estado.
- **Borrado físico:** no.

### 3.4 `app.session_refresh_tokens`

- **Columnas:** `id`, `laboratory_id`, `session_id`, `token_hash` (único), `issued_at`, `expires_at`, `used_at`, `revoked_at`.
- **Claves:** foránea compuesta a `app.user_sessions`.
- **Índices:** único en `token_hash`; `(laboratory_id, session_id)`.
- **RLS:** aislamiento por laboratorio.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.
- **Por qué es una tabla aparte:** distinguir un token **ya usado** (reutilización real, que revoca la sesión) de uno **desconocido**, que se rechaza sin revocar. Así nadie puede cerrar la sesión de otro con solo conocer su `sid`.

**Permisos del rol `microslab_app`:** `SELECT, INSERT, UPDATE` sobre estas tablas y **sin** `DELETE`.

## 4. Contraseñas

- **Algoritmo:** `crypto.scrypt` con N = 2^15, r = 8, p = 3, sal de 16 bytes, clave de 64 bytes y `maxmem` explícito.
- **Formato autodescriptivo:** `$scrypt$N=32768,r=8,p=3$<sal>$<hash>`. Permite rehashear en el login si cambian los parámetros o se migra a Argon2id.
- **Comparación:** con `timingSafeEqual`. Si el usuario no existe, se calcula un hash ficticio para igualar tiempos.
- **Política:**
  - mínimo 12 caracteres;
  - se rechaza si coincide con el correo o con listas comunes;
  - sin caducidad forzada;
  - los parámetros son de plataforma, validados al arrancar, hasta que exista el Configuration Engine (F2).
- **Bloqueo por intentos:** backoff progresivo (propuesta: 5 fallos → 15 min), más límite por IP y por cuenta en Redis.

## 5. Alta del primer usuario (decisión B)

1. **CLI de bootstrap.** Un operador ejecuta el comando con el subdominio, el correo, el nombre, su propio identificador de operador y un motivo. Pasa por el CommandBus como `security.admin.bootstrap`, con actor `platform`, y todo queda auditado.
2. **Guarda.** El comando se niega si el laboratorio ya tiene un `lab_admin` activo. La excepción es `--break-glass`, que exige motivo y revoca las sesiones.
3. **Qué crea:**
   - el rol `lab_admin` a partir de la plantilla, con `all_branches = true`;
   - el usuario en estado `invited` y su asignación de rol;
   - un token de activación (24 h, de un solo uso), que se muestra una sola vez y nunca se registra.
4. **Activación.** `POST /api/v1/auth/activate` con el token y la nueva contraseña. El usuario pasa a `active`. En F1.6, el primer login exige además dar de alta el MFA.
5. **Recuperación.** Un administrador con `security.users.reset_credentials` (con motivo) emite un nuevo token y revoca las sesiones. Si no hay otro administrador, se usa el CLI con `--break-glass`. La recuperación por correo queda para F6.

**Permisos nuevos propuestos para el catálogo:**

- `security.admin.bootstrap` (solo lo usa el CLI);
- `security.users.reset_credentials` (requiere motivo);
- `security.sessions.revoke` (requiere motivo);
- `security.sessions.view`.

## 6. Endpoints propuestos (F1.5)

| Método y ruta                | Autenticación                    | Resultado                                                                                                                        |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/login`    | Ninguna                          | Access token en el cuerpo; refresh en la cookie; o `MFA_REQUIRED` (F1.6)                                                         |
| `POST /api/v1/auth/refresh`  | Cookie                           | Nuevo access token y rotación del refresh                                                                                        |
| `POST /api/v1/auth/logout`   | Access token y cookie            | Revoca la sesión y borra la cookie                                                                                               |
| `POST /api/v1/auth/activate` | Token de activación              | Fija la contraseña                                                                                                               |
| `POST /api/v1/auth/password` | Access token + contraseña actual | Cambia la contraseña y revoca las demás sesiones                                                                                 |
| `GET /api/v1/auth/me`        | Access token                     | Usuario, laboratorio, permisos efectivos y sucursales resueltos en la base (para la interfaz; la interfaz nunca decide permisos) |

Todos pasan por el middleware de laboratorio (subdominio). Las escrituras pasan por el CommandBus.
