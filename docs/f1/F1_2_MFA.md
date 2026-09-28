# F1.2 — Diseño de MFA (F1.6)

Diseño **aprobado** (F1.2 cerrada; ADR 0031 aprobada el 28/09/2026) y **no implementado**: no hay código, migraciones ni dependencias. Corresponde a la decisión J de `F1_2_DECISIONS.md`.

## 1. Alcance

| Quién                                                                        | Fase                                                                                             | Motivo                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Usuarios de laboratorio (`app.users`) con **algún** rol activo que exige MFA | **F1.6**, obligatorio                                                                            | Su modelo existe desde F0                               |
| Usuarios de laboratorio sin ese rol                                          | **F1.6**, opcional (lo activa el propio usuario); una vez activo, se exige como a los demás      | Sin costo adicional                                     |
| Super Admin y usuarios de plataforma                                         | Cuando exista su modelo, con la consola que el Freeze asigna a F2; obligatorio desde ese momento | El modelo de usuarios de plataforma **NO EXISTE** en F1 |
| Portales de paciente y médico                                                | F16                                                                                              | Autenticación propia (ADR 0017)                         |

**Regla de MFA requerido:** el MFA es requerido si el usuario tiene un factor MFA activo **o** algún rol activo exige MFA.

- **Por roles:** basta con que **cualquiera** de los roles activos del usuario tenga `requires_mfa = true`. No depende de un rol "principal", porque un usuario puede tener varios.
- **Por activación voluntaria:** si el usuario activó su propio factor, el MFA se le exige igual que si un rol lo requiriera.
- Se evalúa como `factor activo OR bool_or(requires_mfa)` sobre los roles activos, tanto en el login como en cada petición (`F1_2_AUTHZ.md` §1).
- La plantilla `lab_admin` trae `requires_mfa = true`, y los roles fiscales de F7 también lo tendrán (Freeze §6).

**Aclaración (no cambia el Freeze):** el Freeze exige MFA para Super Admin, pero el modelo de usuarios de plataforma no existe hasta la consola que el Freeze asigna a F2. Por eso F1.6 cubre solo usuarios de laboratorio. La aclaración documental posible está en `F1_2_DESIGN.md` §12.

## 2. Factor

- **TOTP** (RFC 6238): SHA-1, 6 dígitos, periodo de 30 s, ventana de ±1 periodo.
- **Implementación:** con `node:crypto` (HMAC), verificada con los vectores de prueba de la RFC. Sin dependencias.
- **Anti-replay:** se guarda `last_used_step` y se rechaza un código de ese periodo o de uno anterior.
- **Secreto:** cifrado en reposo con AES-256-GCM. La llave se carga de variables de entorno o de un archivo de secretos montado, como **solución temporal de diseño**; la gestión definitiva depende de D-10, y esta solución no se lleva a producción sin resolverla (`F1_2_DESIGN.md` §3). `secret_key_id` permite rotarla.
- **Descartados:** SMS (intercambio de SIM, costo, proveedor), correo (no existe hasta F6), WebAuthn o passkeys (fuera del alcance de F1.2).

## 3. Desafío MFA (`MFA challenge ≠ access JWT`)

El desafío MFA es un **artefacto separado**: representa un intento de autenticación a medio completar. **No es una sesión ni un access token.**

| Aspecto                    | Diseño                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cómo se crea               | Solo en el pipeline de autenticación: tras una contraseña correcta (propósito `login` o `enrollment`) o, dentro de una sesión existente, al pedir reautenticación (propósito `reauth`)           |
| Forma                      | Valor opaco de 256 bits aleatorios, **no es un JWT**. En la base solo se guarda su hash                                                                                                          |
| Usuario asociado           | `user_id` del usuario que acertó la contraseña (`login`, `enrollment`) o del dueño de la sesión que se reautentica (`reauth`)                                                                    |
| Sesión asociada            | Ninguna en `login` y `enrollment`, porque la sesión aún no existe. En `reauth`, el `session_id` de la sesión que se reautentica                                                                  |
| Propósito                  | `login`, `enrollment` o `reauth`. Cada endpoint acepta solo su propósito                                                                                                                         |
| Vinculación con el intento | Guarda el laboratorio (del host), la IP y el agente del intento. Solo se acepta en el mismo laboratorio                                                                                          |
| Expiración                 | Corta: 5 min                                                                                                                                                                                     |
| Estado                     | `pending` → `consumed`; o `expired`; o `locked` al agotar los intentos                                                                                                                           |
| Intentos                   | Máximo 5. Cada fallo cuenta también en `failed_login_count` del usuario                                                                                                                          |
| Uso único                  | Se consume con `SELECT … FOR UPDATE`: pasa de `pending` a `consumed` en la misma transacción que crea la sesión (en `reauth`, la que actualiza `last_reauth_at`)                                 |
| Replay y reutilización     | Un desafío `consumed`, `expired` o `locked` recibe 401 `CHALLENGE_INVALID` y queda auditado. No crea sesión                                                                                      |
| Si expira                  | 401 `CHALLENGE_INVALID`; el usuario debe volver a empezar desde la contraseña                                                                                                                    |
| Quién lo usa               | Solo los endpoints `/api/v1/auth/mfa/*`. **No se acepta como access token:** presentado como `Bearer`, recibe 401 `TOKEN_INVALID` porque no es un JWT con `typ = at+jwt`                         |
| Qué autoriza               | **Nada** en la API. Solo permite completar el MFA del intento al que pertenece                                                                                                                   |
| Transporte                 | En el cuerpo de la respuesta de `login` y en el cuerpo de `mfa/*`. Se guarda en memoria del cliente, nunca en almacenamiento persistente del navegador. Sin el TOTP del usuario no sirve de nada |

**Cómo un desafío válido se convierte en sesión.** En **una sola transacción**, con RLS del laboratorio del host:

1. Se bloquea la fila del desafío y se comprueba que está `pending`, vigente, con intentos disponibles, del mismo laboratorio y del propósito del endpoint.
2. Se verifica el TOTP (con anti-replay) o un código de recuperación.
   - **Si falla:** se incrementan los intentos del desafío y del usuario; la transacción termina sin crear sesión.
3. Si es correcto:
   - el desafío pasa a `consumed`;
   - se actualiza `last_used_step`;
   - se crea `app.user_sessions` con `mfa_verified_at = now()`;
   - se emite el refresh;
   - se escribe la auditoría y el evento.
4. Se devuelven el access JWT y la cookie de refresh.

En `reauth`, el paso 3 no crea sesión: actualiza `last_reauth_at` de la sesión asociada, en la misma transacción.

El desafío **no puede convertirse en sesión sin verificar el TOTP** o un código de recuperación. Ningún otro camino crea una sesión a partir de un desafío.

## 4. Flujos

**Sin MFA exigido:**

```
contraseña correcta → sesión autenticada → access JWT + refresh
```

**Con MFA exigido y factor activo:**

```
contraseña correcta → 401 MFA_REQUIRED + desafío (login)
→ POST /auth/mfa/verify { challenge, code }
→ TOTP válido → desafío consumido → sesión autenticada → access JWT + refresh
```

**Con MFA exigido y sin factor (alta):**

```
contraseña correcta → 401 MFA_ENROLLMENT_REQUIRED + desafío (enrollment)
→ POST /auth/mfa/enroll/start { challenge }      → secreto nuevo (pending) + URI otpauth:// mostrado una sola vez
→ POST /auth/mfa/enroll/confirm { challenge, code } → TOTP válido → factor active + 10 códigos de recuperación (una sola vez)
→ desafío consumido → sesión autenticada → access JWT + refresh
```

**Reautenticación:**

- Los comandos que la declaran exigen `last_reauth_at` reciente (5 min); si no, 401 `REAUTH_REQUIRED`.
- El cliente pide un desafío `reauth` sobre su sesión y lo consume con TOTP o un código de recuperación, igual que los demás desafíos (§3); se actualiza `last_reauth_at`. No se crea una sesión nueva.
- Es una etapa declarada por comando, que la adenda de la ADR 0003 ya anticipa.

**Rol que pasa a exigir MFA:** en la siguiente petición, la resolución ve `bool_or(requires_mfa) = true` y una sesión sin `mfa_verified_at`. Responde 401 `MFA_REQUIRED` y el usuario vuelve a autenticarse con MFA.

## 5. Códigos de recuperación, reset, bloqueo y sesiones

- **Códigos de recuperación:**
  - 10 códigos de 10 caracteres en base32, guardados solo como hash (SHA-256 con sal por usuario);
  - cada uno sirve una vez y solo junto con un desafío válido;
  - usar uno se audita;
  - regenerarlos invalida los anteriores.
- **Reset del MFA de otro usuario:**
  - por el CommandBus, con `security.users.reset_mfa`, motivo y reautenticación;
  - si no queda otro administrador, `security.admin.break_glass` por el runner de infraestructura (`F1_2_SESSIONS_JWT.md` §6);
  - el reset desactiva el factor, revoca **todas** las sesiones del usuario, y el siguiente login exige el alta.
- **Bloqueo:** los fallos de TOTP cuentan en el desafío (máximo 5) y en `failed_login_count` del usuario, con el mismo backoff que la contraseña.
- **Sesiones al activar el MFA:**
  - Si el usuario lo activa voluntariamente desde una sesión, se revocan sus demás sesiones y la actual queda con `mfa_verified_at`.
  - En el alta obligatoria no existían sesiones previas, porque el login no la creó.
- **Auditoría:**
  - alta y confirmación del factor;
  - verificación fallida;
  - desafío vencido o reutilizado;
  - uso de un código de recuperación y su regeneración;
  - reset y desactivación.

  El secreto y los códigos nunca se auditan; la redacción de la auditoría ya oculta las claves `mfa` y `otp`.

## 6. Modelo de datos (F1.6)

### 6.1 `app.roles.requires_mfa`

Columna booleana, `false` por defecto.

### 6.2 `app.user_mfa_factors`

- **Columnas:**
  - `id`, `laboratory_id`, `user_id`;
  - `type` (`totp`);
  - `secret_ciphertext`, `secret_key_id`;
  - `status` (`pending`, `active`, `disabled`);
  - `last_used_step`;
  - `created_at`, `activated_at`, `disabled_at`, `disabled_by`, `disabled_reason`.
- **Claves:** foránea compuesta al usuario.
- **Índices:** único `(laboratory_id, user_id) WHERE status = 'active'`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** alta, desactivación y reset.
- **Actualización:** solo `status`, `last_used_step` y las columnas de activación y desactivación (`activated_at`, `disabled_at`, `disabled_by`, `disabled_reason`).
- **Borrado físico:** no.

### 6.3 `app.user_recovery_codes`

- **Columnas:** `id`, `laboratory_id`, `user_id`, `factor_id`, `code_hash`, `created_at`, `used_at`, `revoked_at`.
- **Claves:** foránea compuesta al factor.
- **RLS:** aislamiento por laboratorio.
- **Actualización:** solo `used_at` y `revoked_at`.
- **Borrado físico:** no.

### 6.4 `app.mfa_challenges`

- **Columnas:**
  - `id`, `laboratory_id`, `user_id`;
  - `session_id` (solo en `reauth`);
  - `purpose` (`login`, `enrollment`, `reauth`);
  - `challenge_hash` (único);
  - `status` (`pending`, `consumed`, `expired`, `locked`);
  - `attempts`, `max_attempts`;
  - `created_at`, `expires_at`, `consumed_at`;
  - `created_ip`, `user_agent`.
- **Claves:** foráneas compuestas al usuario y, cuando existe, a la sesión.
- **Índices:** único en `challenge_hash`; `(laboratory_id, user_id, status)`.
- **RLS:** aislamiento por laboratorio.
- **Auditoría:** creación, consumo y fallos.
- **Retención:** según D-09.
- **Actualización:** solo estado, `attempts` y `consumed_at`.
- **Borrado físico:** no.

### 6.5 Columnas en `app.user_sessions`

`mfa_verified_at` y `last_reauth_at`. La tabla está definida en F1.5.
