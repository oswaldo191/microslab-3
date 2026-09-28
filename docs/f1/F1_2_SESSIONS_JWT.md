# F1.2 — Autenticación, sesiones, JWT e infraestructura

Cubre F1.5. Diseño **aprobado** (F1.2 cerrada; ADR 0031 aprobada el 28/09/2026) y **no implementado**: no hay código, migraciones ni dependencias. Corresponde a las decisiones B, C, D, E, F, G y N de `F1_2_DECISIONS.md`. El MFA (F1.6) está en `F1_2_MFA.md`.

## 1. Pipeline de autenticación

Los puntos de entrada de autenticación **no requieren un permiso de negocio**. El usuario aún no está autenticado o solo actúa sobre su propia sesión, y el login no puede exigir un permiso que el usuario todavía no tiene.

Aun así, **no son un bypass**:

- Forman una **lista cerrada**; no hay más puntos de entrada que estos.
- No ejecutan comandos de negocio.
- Ninguno actúa sobre otro usuario: solo crean, reautentican o cierran la propia sesión, o gestionan el propio factor MFA.

| Punto de entrada                                           | Verificación propia                                                                                   | Garantías                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `login`                                                    | Laboratorio del host, usuario, contraseña, estado del usuario, estado del laboratorio, MFA exigido    | Validación, límite de intentos, transacción con RLS, auditoría y outbox                                  |
| `mfa/verify`, `mfa/enroll/*`                               | Desafío MFA válido + TOTP o código de recuperación (`F1_2_MFA.md`)                                    | Validación, límite de intentos, transacción con RLS, auditoría y outbox                                  |
| `refresh`                                                  | Refresh vigente, no usado, de una sesión activa                                                       | Transacción con RLS, rotación, detección de reutilización, auditoría de anomalías                        |
| `logout`                                                   | Sesión propia (access token + refresh)                                                                | Transacción con RLS, auditoría y outbox                                                                  |
| `activate`                                                 | Token de activación de un solo uso y vigente                                                          | Validación, transacción con RLS, **idempotencia** (el token se consume una sola vez), auditoría y outbox |
| `password` (cambio de la propia contraseña)                | Sesión propia + contraseña actual                                                                     | Validación, límite de intentos, transacción con RLS, auditoría y outbox                                  |
| Desafío de reautenticación (`reauth`, F1.6)                | Sesión propia activa; el desafío se consume con TOTP o código de recuperación (`F1_2_MFA.md` §3 y §4) | Validación, límite de intentos, transacción con RLS, auditoría y outbox                                  |
| Activación voluntaria del MFA desde una sesión (F1.6)      | Sesión propia + TOTP de confirmación (`F1_2_MFA.md` §5)                                               | Validación, límite de intentos, transacción con RLS, auditoría y outbox; revoca las demás sesiones       |
| Regeneración de los propios códigos de recuperación (F1.6) | Sesión propia + reautenticación reciente (`F1_2_MFA.md` §5)                                           | Validación, transacción con RLS, auditoría y outbox; invalida los códigos anteriores                     |

**Garantías comunes:**

- **Laboratorio:** se resuelve siempre desde el host.
- **Transacción:** la abre `PgTenantDatabase` con `SET LOCAL app.laboratory_id`, de modo que RLS aísla igual que en el CommandBus.
- **Auditoría:** encadenada, con `request_id`, IP y agente.
  - El actor es `user` con el id del usuario, o `user` con id nulo cuando el intento no corresponde a ningún usuario.
  - El correo intentado solo se guarda si coincide con un usuario del laboratorio; si no, se guarda su hash.
- **Eventos:** van al outbox en la misma transacción.
- **Validación:** Zod en la entrada.
- **Límite de intentos:** por IP y por cuenta, con un almacén de contadores efímeros que nunca es fuente de autorización.

**Qué no pasa por aquí:** las acciones sobre **otros** usuarios, como restablecer credenciales o MFA, revocar sesiones ajenas o cambiar roles. Esas van por el CommandBus con permiso de la base.

Los tres últimos puntos de entrada forman parte del pipeline de autenticación, no del CommandBus, porque solo actúan sobre la propia sesión o el propio factor. **No agregan endpoints nuevos:** se atienden dentro de las rutas `/api/v1/auth/mfa/*` ya previstas en §10, y su forma concreta se fija al implementar F1.6.

## 2. Access token (decisión D)

- **Claims:** `sub`, `sid`, `lab`, `iss = microslab`, `aud = microslab-api`, `iat`, `exp`, `jti`.
- **Cabecera:** `alg` EdDSA (o ES256), `kid`, `typ = at+jwt`.
- **Vida:** 10 min, configurable; `exp` obligatorio.
- **`lab`:** solo es una comprobación de consistencia.
  - El laboratorio efectivo se resuelve desde host/subdominio → `laboratory_directory` → base, y se verifica contra el usuario y la sesión.
  - Si `lab` no coincide, 401 `TOKEN_INVALID`.
  - `lab` nunca es fuente de autorización ni de autoridad sobre el laboratorio.
- **Nunca contiene:** permisos, módulos, sucursales, `allBranches`, roles, datos personales, sucursal activa, estado de MFA ni `device_id`.
- **Validación con `jose`:**
  - lista blanca de un algoritmo;
  - `requiredClaims`: `sub`, `sid`, `lab`, `exp`, `iat`, `jti`;
  - tolerancia de reloj de 30 s o menos;
  - `kid` desconocido: 401 `TOKEN_INVALID`.
- **Qué acepta como access token:** solo un JWT con `typ = at+jwt`. Cualquier otro artefacto (desafío MFA, token de activación, refresh) recibe 401 `TOKEN_INVALID`.
- **Llaves:**
  - la privada solo en el emisor;
  - las públicas anteriores siguen activas mientras vivan sus tokens;
  - se cargan de variables de entorno o de un archivo de secretos montado, como **solución temporal de diseño**; la gestión definitiva depende de D-10, y esta solución no se lleva a producción sin resolverla (`F1_2_DESIGN.md` §3);
  - nunca están en el repositorio, en logs ni en respuestas;
  - producción no arranca con una llave o secreto de ejemplo.

## 3. Sesión (decisión E)

- **Creación:** solo al completar la autenticación, es decir, contraseña más TOTP si el MFA es requerido (el usuario tiene un factor MFA activo **o** algún rol activo exige MFA). Antes de eso **no existe sesión**; existe, como mucho, un desafío MFA.
- **Estados:** `active` → `revoked` (con motivo) o vencida (por inactividad o por límite absoluto).
- **En cada petición** se comprueba en la base que `sid` pertenece a `sub`, que está activa y que no está vencida (`F1_2_AUTHZ.md` §5). Revocar la sesión corta el access token de inmediato.
- **Revocación:**
  - logout;
  - cambio de contraseña (revoca las demás sesiones);
  - bloqueo, baja, o reset de credenciales o MFA (revoca todas);
  - reutilización del refresh (`reuse_detected`);
  - exceso de sesiones concurrentes (máximo 5; se revoca la más antigua, `session_limit`).
- **`device_id`:** dato **operativo y de auditoría**, enviado por el cliente y por lo tanto **no confiable**. Nunca se usa para autenticar, para autorizar, como factor de seguridad ni en lugar del MFA.
- **Qué se guarda y qué solo se audita:**

| Dato                                        | Se guarda en la sesión | Solo se audita                                         |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| IP y agente al crear y en el último refresh | Sí                     | —                                                      |
| `device_id` (informativo, no confiable)     | Sí                     | —                                                      |
| Creación, último refresh, vencimientos      | Sí                     | —                                                      |
| `mfa_verified_at`, `last_reauth_at`         | Sí (F1.6)              | —                                                      |
| Login correcto                              | —                      | Sí (`security.session.created`)                        |
| Login fallido                               | —                      | Sí (`security.login.failed`), con límite de frecuencia |
| Logout y revocaciones                       | Estado + motivo        | Sí                                                     |
| Reutilización del refresh                   | Estado + motivo        | Sí                                                     |
| Refresh correcto                            | Tiempos                | No, para no inundar la cadena                          |

## 4. Refresh y CSRF (decisión F)

**Refresh:** `POST /api/v1/auth/refresh`, con la cookie `__Secure-ms_rt`.

- **Valor:** `<id del token>.<256 bits aleatorios>`. En la base se guarda solo `sha256(secreto)`.
- **En cada uso:**
  1. se bloquea la fila y se comprueba que no esté usada;
  2. se marca `used_at`;
  3. se emite un nuevo refresh y un nuevo access token;
  4. se extiende la inactividad sin superar el límite absoluto.
- **Reutilización:** si llega un refresh con `used_at` ya fijado, se revoca **toda** la sesión (`reuse_detected`) y se audita.
- **Refresh desconocido:** se rechaza **sin** revocar la sesión, para que conocer un `sid` no permita cerrar la sesión de otro.

**Cookie:** `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, **host-only** (sin `Domain`). Cada laboratorio tiene la suya y no se comparte entre subdominios.

**Defensa contra CSRF:** es una combinación; ninguna medida basta sola. Se aplica en todos los `/api/v1/auth/*` que usan la cookie:

1. La cookie con los atributos anteriores.
2. **Verificación estricta de `Origin`:** debe ser exactamente `https://<host del laboratorio>`. Si falta o difiere, se rechaza.
3. **Cabecera propia obligatoria** (`X-Requested-With: microslab`). Obliga a una petición de JavaScript del mismo origen, porque entre orígenes exigiría CORS, que no se habilita. Es una defensa adicional, no la única.
4. **Fetch Metadata**, si el navegador la envía: `Sec-Fetch-Site` debe ser `same-origin`; `same-site` y `cross-site` se rechazan. También es una defensa adicional.

**Subdominios hermanos:** `lab-a.<dominio>` y `lab-b.<dominio>` son **el mismo _site_** aunque sean orígenes distintos. `SameSite=Strict` no impide que una página de `lab-a` dispare una petición a `lab-b` con la cookie de `lab-b`. Por eso no se confía solo en `SameSite`: los controles 2, 3 y 4 cierran ese caso.

**Access token en el navegador:** solo en memoria. Al recargar la página, el cliente llama a `refresh` con la cookie. Nunca se usa `localStorage` ni `sessionStorage` para credenciales.

**Requisito de despliegue:** la API debe estar en el **mismo origen** que la app (`<lab>.<dominio>/api/v1`), como ya hace el proxy de Vite en desarrollo. En producción está **NO DETERMINADO** y debe definirse **antes del despliegue productivo** (D-10).

## 5. Flujos

**Login sin MFA exigido:**

```
POST /auth/login { email, password }
→ laboratorio del host (onboarding/active; si no, 403 LABORATORY_UNAVAILABLE: excepción explícita de la decisión G)
→ límite de intentos
→ usuario del laboratorio con status 'active' y no bloqueado temporalmente
→ contraseña (scrypt; hash ficticio si el usuario no existe)
→ ¿MFA requerido? (factor activo o algún rol activo lo exige) → no
→ se crea la sesión → access JWT (cuerpo) + refresh (cookie)
```

Cualquier fallo de usuario, contraseña o estado del usuario responde el mismo 401 `INVALID_CREDENTIALS`.

**Login con MFA exigido:**

```
contraseña correcta → ¿MFA requerido? (factor activo o algún rol activo lo exige) → sí
→ sin sesión todavía
→ se crea un desafío MFA → 401 MFA_REQUIRED (o MFA_ENROLLMENT_REQUIRED) con el desafío
→ POST /auth/mfa/verify { challenge, code } → TOTP válido
→ se consume el desafío → se crea la sesión → access JWT + refresh
```

Detalle en `F1_2_MFA.md` §3.

**Activación:** `POST /auth/activate { token, password }`.

- El token de activación es de un solo uso y vence (24 h).
- Se aplica la política de contraseñas y el usuario pasa de `invited` a `active`.
- **No crea sesión:** el usuario inicia sesión después. Si su rol exige MFA, el primer login le pide el alta.

**Logout:** `POST /auth/logout`. Revoca la sesión (`logout`), marca como revocado su refresh vigente y borra la cookie. El access token deja de servir en la siguiente petición.

**Refresh:** rotación y detección de reutilización (§4).

**Cambio de la propia contraseña:** `POST /auth/password`.

- Exige sesión, la contraseña actual y la política de contraseñas.
- Revoca las demás sesiones del usuario.
- Es de autoservicio: modificar la contraseña de **otro** usuario pasa por el CommandBus con `security.users.reset_credentials`.

## 6. Runner de infraestructura (decisión N)

Es un camino controlado para un **número cerrado** de comandos de infraestructura. **No es una identidad que se salte el CommandBus ni la autorización.**

| Aspecto                     | Regla                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comandos admitidos          | Solo los marcados como de infraestructura: `security.admin.bootstrap` (primer administrador), `security.admin.break_glass` (reemitir activación o resetear el MFA del último administrador). Ningún otro comando puede ejecutarse por aquí                                                                                                                    |
| Cómo se ejecuta             | CLI en `apps/api`, sin endpoint HTTP. Solo en el entorno desplegado, desde el acceso operativo del servidor                                                                                                                                                                                                                                                   |
| Quién puede ejecutarlo      | Operadores de plataforma autorizados. En F1, el control de acceso es el de la infraestructura (quién puede entrar al entorno de ejecución); su mecanismo definitivo depende de D-10. Cuando exista la consola de plataforma (F2 según el Freeze), con usuarios de plataforma y MFA, reemplazará el uso rutinario, y el runner quedará solo para _break-glass_ |
| Identificación del operador | `--operator <identificador>` obligatorio, contrastado con una lista de operadores de la configuración de plataforma. Si está disponible, se registra también la identidad de la infraestructura                                                                                                                                                               |
| Laboratorio objetivo        | `--lab <subdominio>`, resuelto en `platform.laboratory_directory`. En producción se exige además `--confirm-lab <subdominio>` repetido                                                                                                                                                                                                                        |
| Motivo                      | Obligatorio, de 20 caracteres o más, con referencia a un ticket en producción                                                                                                                                                                                                                                                                                 |
| Contexto                    | Se construye un `TenantContext` de **mínimo privilegio**: actor `{ type: 'platform', id: operador }`, `laboratoryId` = objetivo, `permissions` = **exactamente** el permiso del comando ejecutado, sin sucursales, `requestId` nuevo                                                                                                                          |
| Autorización                | El comando pasa por el **mismo** `CommandBus.execute`: módulo habilitado, permiso, motivo, validación, transacción con RLS del laboratorio objetivo, auditoría y outbox. **No existe** ninguna excepción por ser `platform`                                                                                                                                   |
| Permisos no asignables      | `security.admin.bootstrap` y `security.admin.break_glass` tienen `assignable = false` en `platform.permissions`. Un control en la base impide agregarlos a `app.role_permissions`, así que ningún usuario puede recibirlos                                                                                                                                    |
| Idempotencia                | `--idempotency-key` obligatoria. La respuesta guardada en `kernel.idempotency_keys` **nunca contiene secretos**: se guarda el id del token, no su valor. Una repetición devuelve el mismo resultado sin volver a mostrar el token; para otro token hace falta _break-glass_                                                                                   |
| Auditoría                   | Evento encadenado en el laboratorio objetivo, con actor `platform`, operador, motivo, `request_id` y host de ejecución. Además, un evento de seguridad en el log estructurado                                                                                                                                                                                 |
| Producción                  | Exige `--confirm-lab`, motivo con ticket y una alerta de seguridad por ejecución. `bootstrap` se niega si ya existe un `lab_admin` activo. `break_glass` revoca todas las sesiones del usuario afectado                                                                                                                                                       |
| Credenciales                | **Nunca** se crea una contraseña por defecto. El usuario solo obtiene acceso mediante un token de activación de un solo uso, que se muestra una sola vez al operador y nunca se registra en logs                                                                                                                                                              |

## 7. Alta del primer usuario (decisión B)

1. **Bootstrap.** El operador ejecuta `security.admin.bootstrap` por el runner (§6) con el laboratorio, el correo y el nombre. En una transacción:
   - crea el rol `lab_admin` desde una plantilla (`all_branches = true`, `requires_mfa = true` desde F1.6, permisos **asignables** de `security.*`, `configuration.*` y `audit.*`);
   - crea el usuario en estado `invited` y su asignación de rol;
   - crea un token de activación (24 h, un solo uso).
2. **Entrega.** El token se entrega al futuro administrador fuera de banda.
3. **Activación.** El usuario activa su cuenta (§5), fijando su contraseña.
4. **Primer login.** Desde F1.6 exige el alta del MFA, porque `lab_admin` lo requiere.
5. **Sucursal.** La primera se crea con el comando existente `configuration.branches.create`, por el CommandBus.
6. **Recuperación.**
   - Un administrador usa `security.users.reset_credentials` por el CommandBus, con motivo: emite un nuevo token de activación y revoca las sesiones.
   - Si no queda otro administrador, se usa `security.admin.break_glass` por el runner.
   - La recuperación por correo del propio usuario queda para F6.

## 8. Modelo de datos (F1.5)

### 8.1 `app.users`, columnas nuevas

`password_hash` **ya existe** y se reutiliza. Se agregan:

- `failed_login_count`;
- `locked_until` (bloqueo temporal por intentos, distinto del bloqueo administrativo `status = 'locked'`);
- `password_changed_at`.

Las listas de usuarios nunca seleccionan `password_hash`, y la auditoría oculta toda clave que contenga `hash`.

### 8.2 `platform.permissions.assignable`

- Columna booleana, `true` por defecto.
- Un trigger en `app.role_permissions` rechaza los permisos con `assignable = false`.

### 8.3 `app.credential_tokens`

- **Columnas:**
  - `id`, `laboratory_id`, `user_id`;
  - `purpose` (`activation` o `reset`);
  - `token_hash` (SHA-256, único);
  - `expires_at`, `used_at`, `revoked_at`;
  - `created_at`, `created_by_type`, `created_by`.
- **Claves:** foránea compuesta `(laboratory_id, user_id)`.
- **Índices:** único en `token_hash`; `(laboratory_id, user_id) WHERE used_at IS NULL AND revoked_at IS NULL`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** emisión, uso y revocación.
- **Retención:** según D-09.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.

### 8.4 `app.user_sessions`

- **Columnas:**
  - `id` (el `sid`), `laboratory_id`, `user_id`;
  - `created_at`, `last_refresh_at`, `idle_expires_at`, `absolute_expires_at`;
  - `created_ip`, `last_ip`, `user_agent` (truncado), `device_id` (informativo);
  - `revoked_at`, `revoked_reason`, `revoked_by`;
  - en F1.6: `mfa_verified_at`, `last_reauth_at`.
- **Claves:** foránea compuesta al usuario.
- **Índices:** clave primaria `id`; `(laboratory_id, user_id) WHERE revoked_at IS NULL`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** creación y revocación.
- **Actualización:** tiempos, IP, estado y MFA.
- **Borrado físico:** no.

### 8.5 `app.session_refresh_tokens`

- **Columnas:** `id`, `laboratory_id`, `session_id`, `token_hash` (único), `issued_at`, `expires_at`, `used_at`, `revoked_at`.
- **Claves:** foránea compuesta a la sesión.
- **Índices:** único en `token_hash`; `(laboratory_id, session_id)`.
- **RLS:** aislamiento por laboratorio.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.
- **Por qué es una tabla aparte:** distingue un refresh **ya usado** (reutilización, que revoca la sesión) de uno **desconocido** (se rechaza sin revocar).

**Permisos del rol `microslab_app`:** `SELECT, INSERT, UPDATE` en estas tablas; **nunca** `DELETE`.

## 9. Contraseñas (decisión C)

- **Algoritmo:** `crypto.scrypt`, como **decisión pragmática de implementación**.
  - Argon2id es la opción moderna preferida cuando está disponible; scrypt es una alternativa válida.
  - Se elige scrypt porque no requiere dependencias nuevas ni binarios nativos.
- **Configuración explícita:** N = 2^15, r = 8, p = 3 (≈32 MiB por cálculo), sal de 16 bytes, clave de 64 bytes, `maxmem` explícito.
- **Formato autodescriptivo:** `$scrypt$N=32768,r=8,p=3$<sal>$<hash>`.
- **Migración:** en cada login correcto se rehashea si cambian los parámetros o el algoritmo, lo que permite pasar a Argon2id sin forzar cambios de contraseña.
- **Comparación:** con `timingSafeEqual`. Si el usuario no existe, se calcula un hash ficticio para igualar tiempos.
- **Concurrencia:** limitada, para no agotar la memoria.
- **Política:**
  - mínimo 12 caracteres;
  - se rechaza si coincide con el correo o con listas comunes;
  - sin caducidad forzada;
  - los parámetros son de plataforma, validados al arrancar, mientras no exista el Configuration Engine previsto en el Freeze.
- **Bloqueo por intentos:** backoff progresivo (5 fallos → 15 min), más el límite por IP y por cuenta.

## 10. Endpoints previstos

| Método y ruta                                                  | Camino              | Requiere                                | Resultado                                                                                                                           |
| -------------------------------------------------------------- | ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/login`                                      | Autenticación       | Correo y contraseña                     | Access token + cookie, o 401 `MFA_REQUIRED` / `MFA_ENROLLMENT_REQUIRED` con desafío                                                 |
| `POST /api/v1/auth/mfa/verify`                                 | Autenticación       | Desafío + TOTP o código de recuperación | Access token + cookie                                                                                                               |
| `POST /api/v1/auth/mfa/enroll/start` · `/confirm`              | Autenticación       | Desafío de alta (+ TOTP en `confirm`)   | URI `otpauth://`; luego access token + cookie + códigos de recuperación                                                             |
| `POST /api/v1/auth/refresh`                                    | Autenticación       | Cookie + defensas CSRF                  | Nuevo access token; rotación                                                                                                        |
| `POST /api/v1/auth/logout`                                     | Autenticación       | Access token + cookie + defensas CSRF   | Sesión revocada, cookie borrada                                                                                                     |
| `POST /api/v1/auth/activate`                                   | Autenticación       | Token de activación                     | Usuario `active`, sin sesión                                                                                                        |
| `POST /api/v1/auth/password`                                   | Autenticación       | Sesión + contraseña actual              | Contraseña cambiada; demás sesiones revocadas                                                                                       |
| `GET /api/v1/auth/me`                                          | Lectura autenticada | Access token                            | Usuario, laboratorio, permisos efectivos y sucursales resueltos en la base. Es solo para mostrar; la interfaz nunca decide permisos |
| Reset de credenciales, reset de MFA, revocar sesiones de otros | CommandBus          | Permiso de la base + motivo             | Según el comando                                                                                                                    |

**Permisos nuevos previstos para el catálogo:**

| Permiso                            | ¿Asignable a roles? | Motivo             |
| ---------------------------------- | ------------------- | ------------------ |
| `security.admin.bootstrap`         | No                  | Obligatorio        |
| `security.admin.break_glass`       | No                  | Obligatorio        |
| `security.users.reset_credentials` | Sí                  | Obligatorio        |
| `security.users.reset_mfa`         | Sí                  | Obligatorio (F1.6) |
| `security.sessions.revoke`         | Sí                  | Obligatorio        |
| `security.sessions.view`           | Sí                  | No                 |
