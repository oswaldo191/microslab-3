# F1.2 — Diseño de MFA (F1.6) (borrador)

Todo es **propuesta**; no hay código ni migraciones.

## 1. Alcance

| Quién                                                          | Fase                                             | Motivo                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Usuarios de laboratorio (`app.users`) con un rol que exige MFA | **F1.6**                                         | Su modelo existe desde F0                                                      |
| Usuarios de laboratorio sin ese rol                            | **F1.6, opcional** (lo activa el propio usuario) | Sin costo adicional                                                            |
| Super Admin y usuarios de plataforma                           | **F2**, obligatorio desde el primer día          | El modelo de usuarios de plataforma **NO EXISTE**: llega con la consola (C-26) |
| Portales de paciente y médico                                  | F16                                              | Autenticación propia (ADR 0017)                                                |

**Qué roles lo exigen:** una columna nueva `app.roles.requires_mfa`.

- La plantilla `lab_admin` la trae en `true`.
- Los roles fiscales, que existirán en F7, la tendrán en `true`, como pide el Freeze (§6).

**Contradicción resuelta:** el Freeze exige MFA para Super Admin, pero ese usuario no existe hasta F2. Por eso F1.6 cubre solo usuarios de laboratorio. Hay que actualizar la sección 6 del Freeze para indicarlo (sección 9 del diseño).

## 2. Factor

- **TOTP** (RFC 6238): SHA-1, 6 dígitos, periodo de 30 s y ventana de ±1 periodo.
- **Implementación:** con `node:crypto` (HMAC), verificada con los vectores de prueba de la RFC. No requiere dependencias.
- **Anti-replay:** se guarda el último periodo usado (`last_used_step`); un código de ese periodo o de uno anterior se rechaza.
- **Descartados:**
  - SMS: intercambio de SIM, costo y dependencia de un proveedor.
  - Correo: no existe hasta F6.
  - WebAuthn o passkeys: después de V1.

## 3. Flujos

- **Login con MFA:**
  1. La contraseña correcta crea la sesión en estado "pendiente de MFA" (`mfa_verified_at IS NULL`) y responde 401 `MFA_REQUIRED` con un token de desafío de vida corta.
  2. Con un código válido se fija `mfa_verified_at` y se emiten el access token y el refresh.
- **Alta (enrollment):**
  1. Si el usuario tiene un rol que exige MFA y no tiene factor, recibe 403 `MFA_ENROLLMENT_REQUIRED` en todo, salvo en los endpoints de alta.
  2. Se genera el secreto y se muestra el URI `otpauth://` una sola vez.
  3. El usuario confirma con un código válido; el factor pasa a `active`.
  4. Se muestran **una sola vez** 10 códigos de recuperación.
- **Códigos de recuperación:**
  - 10 códigos de 10 caracteres en base32, guardados solo como hash (SHA-256 con sal por usuario);
  - cada uno sirve una sola vez;
  - usar uno se audita y avisa al usuario;
  - regenerarlos invalida los anteriores.
- **Reset:**
  - lo hace un administrador con `security.users.reset_mfa`, con motivo y reautenticación;
  - si no hay otro administrador, se usa el CLI de bootstrap con `--break-glass`;
  - el reset desactiva el factor, revoca **todas** las sesiones del usuario y lo obliga a darse de alta de nuevo.
- **Sesiones al activar el MFA:** se revocan todas las demás sesiones del usuario; la actual queda verificada.
  - Si un rol pasa a exigir MFA, las sesiones de sus usuarios sin factor quedan limitadas a 403 `MFA_ENROLLMENT_REQUIRED` en la siguiente petición.
- **Bloqueo:** los fallos de TOTP cuentan en `failed_login_count`, con el mismo backoff que la contraseña.
- **Reautenticación (Freeze §6, adenda de la ADR 0003):**
  - los comandos que la declaran exigen `last_reauth_at` reciente (propuesta: 5 min), con contraseña o TOTP;
  - si no la tienen, responden 401 `REAUTH_REQUIRED`;
  - es una etapa declarada por comando, que la adenda de la ADR 0003 ya anticipa;
  - no cambia el orden del resto de la tubería.

## 4. Modelo de datos propuesto (F1.6)

### 4.1 `app.roles.requires_mfa`

Columna booleana, con `false` por defecto.

### 4.2 `app.user_mfa_factors`

- **Columnas:**
  - `id`, `laboratory_id`, `user_id`;
  - `type` (`totp`);
  - `secret_ciphertext`, `secret_key_id` (cifrado AES-256-GCM);
  - `status` (`pending`, `active`, `disabled`);
  - `last_used_step`;
  - `created_at`, `activated_at`, `disabled_at`, `disabled_by`, `disabled_reason`.
- **Claves:** foránea compuesta al usuario.
- **Índice:** único `(laboratory_id, user_id) WHERE status = 'active'`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** alta, desactivación y reset (el secreto nunca se audita; la redacción ya lo cubre).
- **Actualización:** solo estado y `last_used_step`.
- **Borrado físico:** no.

**La llave de cifrado del secreto TOTP** depende de D-10, igual que las llaves del JWT.

- Mientras tanto, viene de variables de entorno o de un archivo de secretos montado.
- `secret_key_id` permite rotarla.
- Hace falta cifrar: un volcado de la base sin la llave no debe permitir saltarse el MFA.

### 4.3 `app.user_recovery_codes`

- **Columnas:** `id`, `laboratory_id`, `user_id`, `factor_id`, `code_hash`, `created_at`, `used_at`, `revoked_at`.
- **Claves:** foránea compuesta al factor.
- **RLS:** aislamiento por laboratorio.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.

### 4.4 Columnas en `app.user_sessions`

`mfa_verified_at` y `last_reauth_at` (tabla definida en F1.5).
