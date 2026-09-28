# F1.2 — Matriz de decisiones

Cada decisión sigue el formato: decisión, problema, opciones, recomendación, impacto, riesgos, alternativas descartadas y fase.

**Ninguna está aprobada ni implementada.** El detalle técnico está en `F1_2_AUTHZ.md`, `F1_2_SESSIONS_JWT.md` y `F1_2_MFA.md`, que deben coincidir con esta matriz.

| ID  | Tema                                    | Recomendación resumida                                                    | Fase       |
| --- | --------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| A   | Alcance de F1                           | Seguridad y AppShell en F1; resto diferido por primer consumidor          | Documental |
| B   | Primer usuario                          | Runner de infraestructura + token de activación de un solo uso            | F1.5       |
| C   | Contraseñas                             | `scrypt` como decisión pragmática, con migración futura a Argon2id        | F1.5       |
| D   | Access token                            | Solo identidad y metadatos; `lab` solo como comprobación                  | F1.5       |
| E   | Sesiones                                | Sesión persistente consultada en cada petición                            | F1.5       |
| F   | Refresh y CSRF                          | Cookie `HttpOnly` host-only + `Origin` exacto + cabecera + Fetch Metadata | F1.5       |
| G   | 401 frente a 403                        | 401 sin autenticación válida; 403 autenticado sin autorización            | F1.3–F1.6  |
| H   | Autorización desde la base              | Flujo único; la base es la fuente de verdad                               | F1.3       |
| I   | `x-branch-id`                           | Solo contexto validado; auditoría derivada por el servidor                | F1.4       |
| J   | MFA                                     | TOTP para usuarios de laboratorio; desafío separado; plataforma en F2     | F1.6       |
| K   | `ai`                                    | Se renombra solo el módulo; el tipo de actor queda igual                  | F1.7       |
| L   | Habilitación de módulos en F1           | Proveedor estático basado en el registro; `permissions != enabledModules` | F1.3       |
| M   | Estado del laboratorio                  | Estado operativo de plataforma, separado de billing                       | F1.3       |
| N   | Caminos de ejecución y actor `platform` | Tres caminos cerrados; sin atajos por tipo de actor                       | F1.5       |

---

## A. Alcance exacto de F1

**DECISIÓN:** qué elementos de la fila F1 del Freeze (§33) se construyen en F1 y cuáles se difieren de forma explícita.

**PROBLEMA:** el Freeze pone en F1 varios elementos que no figuran en F1.1–F1.9:

- Configuration Engine;
- búsqueda y `Ctrl + K`;
- `workspace`;
- `esign`;
- i18n y moneda;
- observabilidad base;
- dispositivos;
- la adenda de auditoría.

La instrucción de inicio de F1 limitó F1 a seguridad, AppShell y las deudas F1-TD.

**OPCIONES:**

1. Incorporar todo a F1.
2. Diferir todo sin criterio.
3. Decidir elemento por elemento según su primer consumidor.

**RECOMENDACIÓN: opción 3.**

| Elemento                                                                                                     | Recomendación                                                                                                                                         | Motivo                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Autenticación, sesiones, MFA, las 5 deudas F1-TD, registro de 55 módulos, AppShell y Design System en código | **F1** (F1.3–F1.8)                                                                                                                                    | Ya planificado                                                         |
| Dispositivos                                                                                                 | **Parcial en F1.5:** cada sesión guarda `device_id` **solo como dato informativo**. **Diferido:** el registro o aprobación de dispositivos confiables | La sesión cubre el control; aprobar dispositivos es otra funcionalidad |
| `Ctrl + K`                                                                                                   | **Parcial en F1.8:** navegación entre pantallas del AppShell. **Diferido:** búsqueda global, a F3                                                     | Sin datos no hay qué buscar                                            |
| i18n y moneda                                                                                                | **Parcial en F1.8:** textos por clave (`es-DO`). **Diferido:** tipo monetario, a F3                                                                   | El dinero aún no tiene consumidor                                      |
| Configuration Engine                                                                                         | **Diferido a F2** (primer bloque). En F1, los parámetros de seguridad salen de configuración de plataforma validada al arrancar, nunca del código     | Su primer consumidor real está en F2                                   |
| `workspace`                                                                                                  | **Diferido a F4**                                                                                                                                     | Primer consumidor: Mi Trabajo                                          |
| `esign`                                                                                                      | **Diferido a F5**                                                                                                                                     | Primer consumidor: SOP críticos                                        |
| Observabilidad base                                                                                          | **Parcial en F1.9:** eventos de seguridad estructurados con `request_id`. **Diferido:** métricas y trazas, a F7B                                      | Los logs con `request_id` ya existen                                   |
| Adenda de auditoría (`client_time`, `offline`, actor `provider`)                                             | **Diferido:** `client_time`/`offline` con el modo sin conexión; `provider` a F7                                                                       | Sin productor en F1                                                    |

**IMPACTO:** F1 queda en seguridad y fundamentos. El Freeze necesita una actualización documental de su fila F1.

**RIESGOS:** F2 crece con el Configuration Engine.

**ALTERNATIVAS DESCARTADAS:**

- Opción 1: alarga F1 con piezas sin consumidor.
- Opción 2: pierde la trazabilidad.

**FASE:** decisión documental ahora; ejecución en F1.3–F1.9.

---

## B. Alta del primer usuario de laboratorio

**DECISIÓN:** cómo nace el primer usuario con acceso sin abrir un agujero de seguridad.

**PROBLEMA:**

- No hay emisor de tokens ni gestión de usuarios, que es de F2.
- La provisión de laboratorios también es de F2.
- Un login en F1 necesita usuarios con credenciales.

**OPCIONES:**

1. SQL de semilla con contraseña por defecto.
2. Endpoint público de registro.
3. Comando del runner de infraestructura (decisión N), que crea al usuario **sin contraseña** y emite un token de activación de un solo uso.

**RECOMENDACIÓN: opción 3.** Detalle en `F1_2_SESSIONS_JWT.md` §7.

- **Requisito previo:** el laboratorio existe. En F1 solo existe en datos de prueba o desarrollo; la provisión real es de F2.
- **Qué hace `security.admin.bootstrap`**, en una sola transacción con RLS del laboratorio objetivo:
  - crea el rol `lab_admin` desde una plantilla;
  - crea el usuario en estado `invited` y su asignación de rol;
  - emite el token de activación.
- **Guarda contra puerta trasera:** se niega si el laboratorio ya tiene un `lab_admin` activo. La única excepción es _break-glass_ (decisión N).
- **Activación:** por el pipeline de autenticación, con el token de un solo uso y vencimiento. El usuario fija su contraseña y, desde F1.6, da de alta el MFA.
- **Sucursal:** no hace falta, porque el rol abarca todas.
- **Recuperación:**
  - un administrador con `security.users.reset_credentials` por el CommandBus;
  - o, si no hay otro administrador, _break-glass_ por el runner;
  - la recuperación por correo del propio usuario queda para F6.

**IMPACTO:** crea la tabla `app.credential_tokens`, el runner de infraestructura y permisos nuevos no asignables.

**RIESGOS:**

- En F1, la autenticación del operador depende del control de acceso de la infraestructura (decisión N).
- El token de activación puede quedar expuesto; se mitiga con el vencimiento y el uso único.

**ALTERNATIVAS DESCARTADAS:**

- Opciones 1 y 2.
- Un usuario maestro compartido.

**FASE:** F1.5, con el alta de MFA en F1.6.

---

## C. Algoritmo de contraseñas

**DECISIÓN:** cómo se guardan y verifican las contraseñas.

**PROBLEMA:** no hay hashing implementado; `app.users.password_hash` existe pero no se usa.

**OPCIONES:**

| Criterio          | `crypto.scrypt` (Node)                                                                   | Argon2id                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Posición técnica  | Alternativa válida y reconocida (memory-hard)                                            | **Opción moderna preferida cuando está disponible**                                                                      |
| Dependencia       | Ninguna: incluida en Node 22                                                             | Paquete nuevo: Node 22 no trae Argon2                                                                                    |
| Compilación       | Ninguna                                                                                  | `argon2` necesita scripts de build (pnpm 10 los bloquea sin autorización); `@node-rs/argon2` usa binarios por plataforma |
| Portabilidad y CI | Total                                                                                    | Depende de binarios por plataforma (macOS arm64, Linux x64)                                                              |
| Mantenimiento     | Lo mantiene Node                                                                         | Un paquete de terceros más que auditar y actualizar                                                                      |
| Parámetros        | N = 2^15, r = 8, p = 3 (≈32 MiB), sal de 16 bytes, clave de 64 bytes, `maxmem` explícito | Referencia OWASP: m = 19 MiB, t = 2, p = 1                                                                               |
| Migración futura  | Formato autodescriptivo que permite rehashear                                            | —                                                                                                                        |

**RECOMENDACIÓN: `crypto.scrypt`, como decisión pragmática de implementación para F1**, no como afirmación de que sea la mejor opción universal.

- La configuración queda explícita y guardada en cada hash: `$scrypt$N=32768,r=8,p=3$<sal>$<hash>`.
- En cada login correcto se rehashea si cambian los parámetros o el algoritmo, lo que permite migrar a Argon2id.
- La migración a Argon2id se reevalúa cuando esté disponible sin dependencias nativas nuevas, o cuando se apruebe añadir esa dependencia.

**IMPACTO:** sin dependencias ni cambios de lockfile.

**RIESGOS:**

- Unos 32 MiB por cálculo concurrente; se mitiga limitando la concurrencia y los intentos.
- Los parámetros deben revisarse periódicamente.

**ALTERNATIVAS DESCARTADAS:**

- bcrypt: límite de 72 bytes, menos resistente por memoria.
- PBKDF2: no usa memoria de forma intensiva.
- Argon2id ahora: implica una dependencia nativa sin aprobación.

**FASE:** F1.5.

---

## D. Contenido del access token (después de F1.5)

**DECISIÓN:** qué contiene el JWT.

**PROBLEMA:** hoy transporta autorización (`perms`, `modules`, `branches`, `allBranches`) y no exige `exp`.

**RECOMENDACIÓN:**

| Elemento                                                            | Clasificación                                  | ¿Va en el token?                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sub`                                                               | Identidad del usuario                          | **Sí**                                                                                                                                                                                                                                                                                                                                           |
| `sid`                                                               | Vínculo con la sesión revocable                | **Sí**                                                                                                                                                                                                                                                                                                                                           |
| `lab`                                                               | **Comprobación de consistencia**, no autoridad | **Sí**. El laboratorio efectivo se resuelve siempre desde host/subdominio → `laboratory_directory` → base, y se verifica contra el usuario y la sesión. Si `lab` difiere del laboratorio resuelto, la petición se rechaza (401 `TOKEN_INVALID`). Se conserva para que un token de un laboratorio no pueda usarse ni por error en otro subdominio |
| `iss`, `aud`                                                        | Metadatos de seguridad                         | **Sí**, validados                                                                                                                                                                                                                                                                                                                                |
| `iat`, `exp`                                                        | Metadatos de seguridad                         | **Sí**; `exp` obligatorio, 10 min configurable                                                                                                                                                                                                                                                                                                   |
| `jti`                                                               | Metadatos de seguridad (correlación)           | **Sí**; no es lista de revocación                                                                                                                                                                                                                                                                                                                |
| `kid`                                                               | Cabecera JOSE                                  | **Sí, en la cabecera**                                                                                                                                                                                                                                                                                                                           |
| `typ`                                                               | Cabecera JOSE                                  | `at+jwt`                                                                                                                                                                                                                                                                                                                                         |
| `perms`, `modules`, `branches`, `allBranches`, roles                | Autorización y habilitación                    | **NO.** Se ignoran si aparecen                                                                                                                                                                                                                                                                                                                   |
| Nombre, correo, cédula, sucursal activa, estado de MFA, `device_id` | Datos personales o de estado                   | **NO**                                                                                                                                                                                                                                                                                                                                           |

- **Algoritmo:** asimétrico con `jose`. Recomendado EdDSA (Ed25519); ES256 es una alternativa aceptable.
- **Llaves:** la privada solo en el emisor, desde variables de entorno o un archivo de secretos montado hasta D-10.
- **Rotación:** por `kid`.

**IMPACTO:** el token deja de ser fuente de autorización y de laboratorio.

**RIESGOS:** gestión de llaves antes de D-10.

**ALTERNATIVAS DESCARTADAS:**

- HS256: secreto compartido.
- Quitar `lab`: se pierde una comprobación barata de consistencia.
- Lista de revocación por `jti`: innecesaria, porque la sesión se consulta en cada petición.

**FASE:** F1.5. F1.3 ya ignora los claims de autorización y usa `lab` solo como comprobación.

---

## E. Sesiones

**DECISIÓN:** qué es una sesión y cómo termina.

**RECOMENDACIÓN:** sesión persistente en `app.user_sessions`, consultada **en cada petición** en la base, que es la fuente de verdad. Esto permite revocarla al instante. Detalle en `F1_2_SESSIONS_JWT.md` §3 y §4.

- **Creación:** solo después de completar la autenticación: contraseña y, si se exige, TOTP.
- **Vencimiento:** por inactividad (30 min sin refrescar) y absoluto (12 h). Ambos configurables.
- **Rotación:** del refresh en cada uso, con detección de reutilización.
- **Revocación inmediata:** logout, cambio de contraseña, bloqueo o baja del usuario, reset de credenciales o MFA, reutilización detectada y exceso de sesiones (máximo 5; se revoca la más antigua).
- **Se guarda:**
  - IP y agente al crear la sesión y en el último refresh;
  - `device_id` como dato **informativo y no confiable**, que nunca se usa para autenticar, autorizar, como factor ni en lugar del MFA.
- **Solo se audita:** login correcto y fallido, logout, revocaciones, reutilización y bloqueos.

**ALTERNATIVAS DESCARTADAS:**

- Sesiones sin estado, solo con JWT.
- Sesión en Redis como fuente de verdad.

**FASE:** F1.5.

---

## F. Transporte del refresh token y CSRF

**DECISIÓN:** cookie o cuerpo de la respuesta, y cómo se defiende la cookie contra CSRF.

| Criterio       | Cookie `HttpOnly`                    | Cuerpo de la respuesta                             |
| -------------- | ------------------------------------ | -------------------------------------------------- |
| XSS            | JavaScript no puede leer el refresh  | Un XSS lo roba                                     |
| CSRF           | Requiere defensas                    | No aplica                                          |
| SPA React/Vite | Al recargar, refresca con la cookie  | Obliga a guardarlo en almacenamiento del navegador |
| Subdominios    | Cookie host-only por laboratorio     | —                                                  |
| CORS           | Requiere la API en el mismo origen   | Funciona entre orígenes                            |
| Logout         | El servidor revoca y borra la cookie | El cliente debe olvidar el token                   |

**RECOMENDACIÓN: cookie `HttpOnly`**, defendida por una **combinación** de medidas; ninguna basta por sí sola:

1. `HttpOnly`, `Secure`, `SameSite=Strict`.
2. **Host-only**, sin atributo `Domain`: cada laboratorio tiene su propia cookie.
3. `Path=/api/v1/auth`.
4. **Verificación estricta de `Origin`:** debe ser exactamente `https://<host del laboratorio>`; sin `Origin`, se rechaza.
5. **Cabecera propia obligatoria** (`X-Requested-With`), como defensa adicional, no única.
6. **Fetch Metadata** como defensa adicional, si el navegador la envía: `Sec-Fetch-Site` debe ser `same-origin`, y se rechaza `same-site`.

**Subdominios hermanos.** `lab-a.<dominio>` y `lab-b.<dominio>` son **el mismo _site_** aunque sean orígenes distintos. `SameSite=Strict` no impide que una página de `lab-a` envíe una petición a `lab-b` con la cookie de `lab-b`. Por eso no se confía solo en `SameSite`; los controles 4, 5 y 6 cierran ese caso.

**Access token:** solo en memoria.

**IMPACTO:** exige la API en el mismo origen que la app en producción (**NO DETERMINADO**; se confirma con D-10). Para leer la cookie se usaría el paquete `cookie` (ya está en el lockfile como dependencia de Express), lo que requiere regenerar el lockfile; la alternativa es un lector propio mínimo.

**RIESGOS:** entorno de desarrollo con HTTPS o `localhost` y resolución del subdominio en local.

**ALTERNATIVAS DESCARTADAS:**

- Cuerpo de la respuesta con `localStorage`.
- Confiar solo en `SameSite`.

**FASE:** F1.5 (backend) y F1.8 (frontend).

---

## G. 401 frente a 403

**DECISIÓN:** qué significa cada estado y qué códigos internos existen.

- **401:** no hay autenticación válida.
- **403:** hay autenticación válida, pero no autorización.

**RECOMENDACIÓN:**

| HTTP | Código                       | Cuándo                                                                                                                                                                                |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `UNAUTHENTICATED`            | Sin token                                                                                                                                                                             |
| 401  | `TOKEN_INVALID`              | Firma, formato, `iss`, `aud` o `kid` inválidos; falta `exp` o `sid`; `lab` distinto al laboratorio resuelto; se presenta algo que no es un access token (por ejemplo, un desafío MFA) |
| 401  | `TOKEN_EXPIRED`              | `exp` vencido                                                                                                                                                                         |
| 401  | `SESSION_REVOKED`            | Sesión inexistente, revocada o vencida; usuario inexistente, `invited`, `locked` o `inactive`                                                                                         |
| 401  | `INVALID_CREDENTIALS`        | Login fallido por cualquier causa (genérico)                                                                                                                                          |
| 401  | `MFA_REQUIRED`               | Paso del login: contraseña correcta, falta verificar TOTP; se entrega un desafío MFA                                                                                                  |
| 401  | `MFA_ENROLLMENT_REQUIRED`    | Paso del login: contraseña correcta, un rol exige MFA y no hay factor; se entrega un desafío de alta                                                                                  |
| 401  | `CHALLENGE_INVALID`          | Desafío MFA inexistente, vencido, consumido o con intentos agotados                                                                                                                   |
| 401  | `REAUTH_REQUIRED`            | La acción exige reautenticación reciente                                                                                                                                              |
| 403  | `PERMISSION_DENIED` (existe) | Autenticado, sin el permiso                                                                                                                                                           |
| 403  | `MODULE_DISABLED` (existe)   | Módulo no habilitado para el laboratorio (decisión L)                                                                                                                                 |
| 403  | `BRANCH_NOT_ALLOWED`         | `x-branch-id` inexistente, de otro laboratorio, no permitido o inactivo                                                                                                               |
| 403  | `LABORATORY_UNAVAILABLE`     | Laboratorio `suspended` o `closed` (decisión M)                                                                                                                                       |
| 400  | `TENANT_REQUIRED` (existe)   | Sin subdominio de laboratorio                                                                                                                                                         |
| 400  | `BRANCH_CONTEXT_INVALID`     | `x-branch-id` con formato inválido                                                                                                                                                    |

**ALTERNATIVAS DESCARTADAS:** todo 403, como hoy.

**FASE:** F1.3 (autorización, habilitación y estado), F1.4 (sucursal), F1.5 (token y sesión), F1.6 (MFA).

---

## H. Autorización desde la base

**DECISIÓN:** flujo único de resolución, con la base como fuente de verdad. Detalle en `F1_2_AUTHZ.md` §1–§3.

**RECOMENDACIÓN:**

Petición → laboratorio (host) → identidad (JWT) → usuario → sesión → estado del laboratorio → roles activos → permisos → sucursales → MFA exigido → habilitación de módulos → `TenantContext` → CommandBus → RLS.

**FASE:** F1.3; la sesión desde F1.5; el MFA desde F1.6.

---

## I. Contrato de `x-branch-id`

**DECISIÓN:** `x-branch-id` es solo contexto operativo validado por el servidor. El cliente nunca fija `audit_events.branch_id`. Detalle en `F1_2_AUTHZ.md` §4.

**FASE:** F1.4.

---

## J. MFA

**DECISIÓN:**

- TOTP para usuarios de laboratorio.
- Es obligatorio si **cualquier** rol activo del usuario lo exige.
- El desafío MFA es un artefacto separado del access token.
- Los usuarios de plataforma quedan para F2.

Detalle en `F1_2_MFA.md`.

**FASE:** F1.6; plataforma en F2.

---

## K. Módulo `ai` frente a tipo de actor `'ai'`

**DECISIÓN:** son dos decisiones independientes.

- **El módulo funcional** `ai` se renombra a `clinical-ai` en F1.7: registro, carpeta y permisos `ai.*` si existieran.
- **El tipo de actor** `'ai'` (`ActorType` y el `CHECK` de `audit.audit_events.actor_type`) **permanece `'ai'`**. Describe qué clase de actor realizó una acción, no a qué módulo pertenece.

**IMPACTO:** no se toca el `CHECK` de la auditoría, que es inmutable y está particionada.

**ALTERNATIVAS DESCARTADAS:** renombrar el actor, porque mezcla el dominio con la clase de actor.

**FASE:** F1.7.

---

## L. Habilitación de módulos en F1 (`enabledModules`)

**DECISIÓN:** de dónde sale `enabledModules` mientras no existan planes ni suscripciones.

**PROBLEMA:**

- `CommandBus` llama a `assertModuleEnabled` antes de comprobar el permiso.
- La versión anterior de este diseño decía "`enabledModules = ∅` hasta F2", lo que se leía como un bloqueo.
- F1 no debe crear tablas de planes, suscripciones ni billing.

**OPCIONES:**

1. Conjunto vacío implícito.
2. Tablas de planes en F1.
3. Un **proveedor de habilitación estático y explícito**, basado en el registro de módulos existente, que F2 reemplaza por la suscripción.

**RECOMENDACIÓN: opción 3.** Detalle en `F1_2_AUTHZ.md` §2.

- **Autorización y habilitación son controles distintos: `permissions != enabledModules`.**
  - **Autorización** (¿puede este usuario?): sale **exclusivamente** de la base (roles, permisos, `role_permissions`, `user_roles`, `user_branches`, acceso a sucursales).
  - **Habilitación** (¿tiene el laboratorio este módulo?): en F1 sale del proveedor estático; desde F2, de la suscripción y el plan.
  - **Tener permiso sobre un módulo no implica que esté habilitado.** El CommandBus exige ambos.
- **Comportamiento de `assertModuleEnabled` en F1** (sin cambiar su código actual):
  - un módulo con `planGated: false` en `packages/contracts/src/modules.ts` **siempre** está habilitado;
  - un módulo con `planGated: true` solo está habilitado si figura en `enabledModules`;
  - en F1, el proveedor estático devuelve una lista vacía de módulos de plan, porque F1 no ejecuta ningún comando de un módulo de plan.
- **Por qué los comandos de F1 no se bloquean:** `security`, `configuration` y `audit` tienen `planGated: false` en el registro, así que siempre están habilitados.
- **F1 garantiza esto con una prueba:** todo comando registrado en F1 pertenece a un módulo con `planGated: false`.

**IMPACTO:** no se crean tablas. El proveedor queda como una interfaz que F2 implementa con `plan/suscripción → enabledModules`.

**RIESGOS:** que un bloque de F1 agregue un comando de un módulo de plan. La prueba anterior lo detecta.

**ALTERNATIVAS DESCARTADAS:**

- Opción 1: ambigua.
- Opción 2: adelanta F2.
- Habilitar todo por defecto: borra la diferencia entre permiso y habilitación.

**FASE:** F1.3.

---

## M. Estado del laboratorio (`platform.laboratories.status`)

**DECISIÓN:** qué significa cada estado y qué ocurre con las peticiones autenticadas.

**PROBLEMA:**

- El campo existe desde F0 y hoy no se usa.
- La regla C-04 del Freeze dice que la suspensión **por impago** nunca bloquea lo clínico esencial. Esa suspensión pertenece a la suscripción de F2.

**RECOMENDACIÓN:** `platform.laboratories.status` es el **estado operativo de la plataforma**, totalmente separado de billing, suscripción, plan y estado de pago. **Nunca se usa para impagos.**

| Estado       | Significado operativo                                                                                                           | Peticiones autenticadas      | Login                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------- |
| `onboarding` | Alta y configuración inicial en curso                                                                                           | Permitidas                   | Permitido                    |
| `active`     | Operación normal                                                                                                                | Permitidas                   | Permitido                    |
| `suspended`  | Suspensión **administrativa** decidida por la plataforma: incidente de seguridad, orden legal, incumplimiento contractual grave | 403 `LABORATORY_UNAVAILABLE` | 403 `LABORATORY_UNAVAILABLE` |
| `closed`     | Laboratorio dado de baja en la plataforma                                                                                       | 403 `LABORATORY_UNAVAILABLE` | 403 `LABORATORY_UNAVAILABLE` |

- **Sesiones:** `suspended` no las revoca; quedan bloqueadas mientras dure y vuelven a servir si el laboratorio vuelve a `active`. Cerrar un laboratorio revoca sus sesiones. Esa acción es de F2, porque F1 no tiene comandos para cambiar el estado del laboratorio.
- **Sin lógica de billing en F1.** La suspensión por impago llega en F2 como estado de suscripción, con su lista de operaciones esenciales (D-06).

**IMPACTO:** se registra en la ADR 0031.

**ALTERNATIVAS DESCARTADAS:** usar este campo para impagos, porque contradice C-04.

**FASE:** F1.3.

---

## N. Caminos de ejecución y actor `platform`

**DECISIÓN:** cómo se ejecutan la autenticación y los comandos de infraestructura sin crear un atajo de autorización.

**PROBLEMA:**

- El bootstrap usa el actor `platform`.
- El login no puede exigir un permiso que el usuario aún no tiene.
- Ninguno de los dos debe convertirse en un bypass del CommandBus.

**RECOMENDACIÓN:** tres caminos cerrados (`F1_2_DESIGN.md` §2):

1. **CommandBus** para todo lo que hace un usuario autenticado, con permiso de la base.
2. **Pipeline de autenticación** para una lista fija de puntos de entrada (login, MFA, refresh, logout, activación, cambio de la propia contraseña). Sin permiso de negocio, pero con verificación propia, validación, límite de intentos, transacción con RLS, auditoría e idempotencia donde aplica.
3. **Runner de infraestructura** para una lista fija de comandos marcados como de infraestructura, que pasan por el **mismo CommandBus** con actor `platform` y contexto de mínimo privilegio.

**Reglas:**

- **No existe** ninguna regla "si el actor es `platform`, omitir la autorización". `platform` es un actor técnico y auditado, sin privilegios implícitos.
- Los permisos de infraestructura (`security.admin.bootstrap`, `security.admin.break_glass`) están marcados como **no asignables** y nunca pueden darse a un rol.
- Quién ejecuta el runner, cómo se autentica, las restricciones de producción, la idempotencia y la auditoría están definidos en `F1_2_SESSIONS_JWT.md` §6.

**IMPACTO:**

- El CommandBus no cambia su contrato.
- Aparecen el pipeline de autenticación y el runner como piezas nuevas y cerradas.
- `platform.permissions` recibe la marca `assignable`.

**RIESGOS:**

- En F1, la autenticación del operador depende del acceso a la infraestructura. En F2, la consola con usuarios de plataforma y MFA reemplaza el uso rutinario, y el runner queda solo para _break-glass_.

**ALTERNATIVAS DESCARTADAS:**

- Permitir comandos sin permiso dentro del CommandBus: abre un bypass general.
- Exceptuar al actor `platform`.
- Un endpoint HTTP de administración de plataforma en F1.

**FASE:** F1.5.
