# F1.2 — Matriz de decisiones (borrador para aprobación)

Cada decisión sigue el formato: decisión, problema, opciones, recomendación, impacto, riesgos, alternativas descartadas y fase.

**Ninguna está aprobada ni implementada.** El detalle técnico de cada una está en `F1_2_AUTHZ.md`, `F1_2_SESSIONS_JWT.md` y `F1_2_MFA.md`.

---

## A. Alcance exacto de F1

**DECISIÓN:** qué elementos del roadmap del Freeze (§33, fila F1) se construyen en F1 y cuáles se difieren de forma explícita.

**PROBLEMA:** el Freeze pone en F1 varios elementos que no figuran en F1.1–F1.9:

- Configuration Engine;
- búsqueda y `Ctrl + K`;
- `workspace`;
- `esign`;
- i18n y moneda;
- observabilidad base;
- dispositivos;
- la adenda de auditoría.

La instrucción de inicio de F1 (CTO) limitó F1 a seguridad, AppShell y las deudas F1-TD.

**OPCIONES:**

1. Incorporar todo a F1 con bloques nuevos.
2. Diferir todo sin criterio.
3. Decidir elemento por elemento según su primer consumidor.

**RECOMENDACIÓN: opción 3.**

| Elemento del Freeze                                                                                          | Recomendación                                                                                                                                                                         | Motivo                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Autenticación, sesiones, MFA, las 5 deudas F1-TD, registro de 55 módulos, AppShell y Design System en código | **F1** (F1.3–F1.8)                                                                                                                                                                    | Ya planificado                                                                     |
| Dispositivos                                                                                                 | **Parcial en F1.5**: cada sesión guarda su dispositivo, IP y agente. **Diferido**: el registro o aprobación formal de dispositivos confiables, hasta el modo sin conexión (D-05) o F2 | La sesión cubre el control; aprobar dispositivos es una funcionalidad aparte       |
| `Ctrl + K`                                                                                                   | **Parcial en F1.8**: paleta de navegación entre las pantallas del AppShell. **Diferido**: búsqueda global (`search`), hasta que existan datos que buscar (F3)                         | Sin datos, la búsqueda no tiene contenido                                          |
| i18n y moneda                                                                                                | **Parcial en F1.8**: textos de interfaz por clave (`es-DO`) desde el primer componente. **Diferido**: el tipo monetario, a F3 (catálogo y precios)                                    | Preparar los textos cuesta poco al construir; el dinero aún no tiene consumidor    |
| Configuration Engine                                                                                         | **Diferido a F2**, como primer bloque de F2. En F1, los parámetros de seguridad se leen de configuración de plataforma validada con zod al arrancar (no en el código)                 | Su primer consumidor real son las sucursales, la suscripción y las políticas de F2 |
| `workspace` (continuar trabajando, vistas guardadas)                                                         | **Diferido a F4** (Mi Trabajo)                                                                                                                                                        | Es su primer consumidor                                                            |
| `esign`                                                                                                      | **Diferido a F5** (SOP críticos)                                                                                                                                                      | Es su primer consumidor                                                            |
| Observabilidad base                                                                                          | **Parcial en F1.9**: eventos de seguridad estructurados con `request_id`. **Diferido**: métricas y trazas, a F7B                                                                      | Los logs con `request_id` ya existen                                               |
| Adenda de auditoría (`client_time`, `offline`, actor `provider`)                                             | **Diferido**: `client_time`/`offline` con el modo sin conexión; `provider` a F7                                                                                                       | No tienen productor en F1                                                          |

**IMPACTO:** F1 queda en seguridad y fundamentos, como pidió el inicio de F1. El Freeze necesita una actualización documental de la fila F1 (sección 9 del diseño).

**RIESGOS:**

- F2 crece al recibir el Configuration Engine.
- Si algo diferido tiene un consumidor escondido en F2, habrá que adelantarlo.

**ALTERNATIVAS DESCARTADAS:**

- Opción 1: alarga F1 con piezas sin consumidor.
- Opción 2: pierde la trazabilidad.

**FASE:** decisión documental ahora; ejecución en F1.3–F1.9.

---

## B. Alta del primer usuario de laboratorio

**DECISIÓN:** cómo nace el primer usuario con acceso sin abrir un agujero de seguridad.

**PROBLEMA:**

- No hay emisor de tokens ni gestión de usuarios (que es F2).
- La provisión de laboratorios también es F2 (C-26).
- Un login en F1 necesita usuarios con credenciales.

**OPCIONES:**

1. SQL de semilla con contraseña por defecto.
2. Endpoint público de registro.
3. Comando CLI de _bootstrap_ que pasa por el CommandBus, con actor `platform`, y emite un **token de activación de un solo uso**, sin contraseña.

**RECOMENDACIÓN: opción 3.**

- **Requisito previo:** el laboratorio ya existe. En F1 solo existe en datos de prueba o de desarrollo; la provisión real es de F2.
- **Qué crea el comando `security.admin.bootstrap`**, en una sola transacción auditada:
  - el rol `lab_admin` a partir de una plantilla (`all_branches = true`, permisos de `security.*`, `configuration.*` y `audit.*` del catálogo);
  - el usuario en estado `invited` y su asignación de rol;
  - un token de activación.
- **Token de activación:** 256 bits aleatorios, guardados solo como hash, con vencimiento configurable (propuesta: 24 h). Se muestra una sola vez en la terminal del operador y nunca se registra en logs.
- **Guarda contra puerta trasera:** el comando se niega si el laboratorio ya tiene un administrador activo. Solo hay excepción con `--break-glass`, que exige motivo, se audita y revoca todas las sesiones del usuario afectado.
- **Activación:** el usuario la hace por la API (`POST /api/v1/auth/activate`) fijando su contraseña según la política. Desde F1.6, además, da de alta su MFA, porque `lab_admin` lo exige.
- **Sucursal:** no hace falta, porque el rol abarca todas. La primera sucursal se crea con el comando existente `configuration.branches.create`.
- **Recuperación:**
  - otro administrador con permiso `security.users.reset_credentials` (con motivo) emite un nuevo token de activación y revoca las sesiones;
  - si no hay otro administrador, se usa el mismo CLI con `--break-glass`;
  - la recuperación por correo del propio usuario queda para F6.

**IMPACTO:** crea la tabla `app.credential_tokens` y un punto de entrada CLI en `apps/api`. Hay un permiso nuevo en el catálogo.

**RIESGOS:**

- **Quién puede ejecutar el CLI:** quien tenga acceso operativo al servidor. Es un riesgo operacional; se mitiga con la auditoría y la guarda.
- **Exposición del token de activación:** se mitiga con el vencimiento y el uso único.

**ALTERNATIVAS DESCARTADAS:**

- Opción 1: contraseñas por defecto.
- Opción 2: registro abierto en un SaaS multi-laboratorio.
- Un "usuario maestro" compartido.

**FASE:** F1.5, con el alta de MFA en F1.6.

---

## C. Algoritmo de contraseñas

**DECISIÓN:** cómo se guardan y verifican las contraseñas.

**PROBLEMA:** no hay hashing implementado; `app.users.password_hash` existe pero no se usa.

**OPCIONES:**

| Criterio          | `crypto.scrypt` (Node)                                                                                         | Argon2id                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seguridad         | Función con uso intensivo de memoria, aceptada por OWASP con parámetros adecuados                              | Primera opción de OWASP; también usa memoria de forma intensiva                                                                                          |
| Dependencia       | Ninguna: forma parte de Node 22                                                                                | Paquete nuevo (`argon2` nativo o `@node-rs/argon2` con binarios precompilados). Node 22 no trae argon2 incluido                                          |
| Compilación       | Ninguna                                                                                                        | `argon2` requiere scripts de build, que pnpm 10 bloquea por defecto (habría que autorizarlos). `@node-rs/argon2` usa binarios por plataforma sin scripts |
| Portabilidad y CI | Total                                                                                                          | Depende de binarios por plataforma (macOS arm64 del equipo, Linux x64 del CI)                                                                            |
| Mantenimiento     | Lo mantiene Node                                                                                               | Un paquete de terceros más que auditar                                                                                                                   |
| Parámetros        | Propuesta OWASP: N=2^15, r=8, p=3 (32 MiB por cálculo), sal de 16 bytes, clave de 64 bytes, `maxmem` explícito | m=19 MiB, t=2, p=1 (OWASP)                                                                                                                               |
| Migración futura  | El formato autodescriptivo `$scrypt$N=…,r=…,p=…$sal$hash` permite rehashear en el siguiente login correcto     | —                                                                                                                                                        |

**RECOMENDACIÓN: `crypto.scrypt`** con los parámetros indicados, guardados dentro del propio hash:

- comparación con `timingSafeEqual`;
- concurrencia de cálculo limitada, para evitar agotar la memoria;
- rehash automático si cambian los parámetros o se migra a Argon2id.

La migración a Argon2id se reevalúa cuando Node lo traiga incluido y estable en la versión LTS del proyecto.

**IMPACTO:** sin dependencias ni cambios de lockfile.

**RIESGOS:**

- 32 MiB por login concurrente; se mitiga con el límite de concurrencia y el límite por IP.
- Los parámetros deben revisarse periódicamente.

**ALTERNATIVAS DESCARTADAS:**

- bcrypt: límite de 72 bytes y menos resistencia por memoria.
- PBKDF2: no usa memoria de forma intensiva.
- Argon2 ahora: dependencia y binarios nativos sin una ganancia que justifique romper "sin dependencias nuevas".

**FASE:** F1.5.

---

## D. Contenido del access token (después de F1.5)

**DECISIÓN:** qué contiene el JWT.

**PROBLEMA:** hoy transporta la autorización (`perms`, `modules`, `branches`, `allBranches`) y no exige `exp`.

**RECOMENDACIÓN:**

| Elemento                                             | Clasificación                               | ¿Va en el token?                                                            |
| ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `sub` (id del usuario)                               | Identidad                                   | **Sí**                                                                      |
| `lab` (id del laboratorio)                           | Identidad; debe coincidir con el subdominio | **Sí**                                                                      |
| `sid` (id de la sesión)                              | Vínculo con la sesión revocable             | **Sí**                                                                      |
| `iss`, `aud`                                         | Metadatos de seguridad                      | **Sí**, validados                                                           |
| `iat`, `exp`                                         | Metadatos de seguridad                      | **Sí**. `exp` obligatorio, con vida corta (propuesta: 10 min, configurable) |
| `jti`                                                | Metadatos de seguridad, para correlación    | **Sí**. No es lista de revocación; la revocación es por `sid`               |
| `kid`                                                | Cabecera JOSE, no claim                     | **Sí, en la cabecera**, para rotar llaves                                   |
| `typ`                                                | Cabecera JOSE                               | `at+jwt`                                                                    |
| `perms`, `modules`, `branches`, `allBranches`, roles | Autorización                                | **NO.** Se ignoran si aparecen                                              |
| Nombre, correo, cédula, sucursal activa, MFA         | Datos personales o de estado                | **NO**                                                                      |

- **Algoritmo:** asimétrico, con `jose` (ya instalado).
  - **Recomendado:** EdDSA (Ed25519).
  - **Alternativa aceptable:** ES256, si se prioriza la compatibilidad con otras librerías.
- **Llaves:** privada solo en el emisor. Mientras D-10 esté pendiente, se leen de variables de entorno o de un archivo de secretos montado; nunca del repositorio.
- **Rotación:** varias llaves públicas activas identificadas por `kid`.

**IMPACTO:** el token deja de ser fuente de autorización (cierra F1-TD-02 junto con F1.3).

**RIESGOS:** gestión de llaves antes de D-10; rotación mal coordinada.

**ALTERNATIVAS DESCARTADAS:**

- Seguir con HS256: un secreto compartido firma y verifica a la vez.
- Tokens opacos sin JWT: sería posible, pero cambia más de lo necesario.
- Lista de revocación por `jti`: innecesaria, porque la sesión se consulta en cada petición.

**FASE:** F1.5 (F1.3 ya ignora los claims de autorización).

---

## E. Sesiones

**DECISIÓN:** qué es una sesión y cómo termina.

**RECOMENDACIÓN:** sesión persistente en `app.user_sessions`, consultada en cada petición. El detalle está en `F1_2_SESSIONS_JWT.md` §2.

- **Vencimiento:** por inactividad (propuesta: 30 min sin refrescar) y absoluto (propuesta: 12 h, un turno).
- **Rotación:** del refresh en cada uso, con detección de reutilización.
- **Revocación inmediata:** logout, cambio de contraseña, bloqueo o baja del usuario, reset de credenciales o MFA, reutilización detectada, y exceso de sesiones concurrentes (propuesta: máximo 5 por usuario; se revoca la más antigua).
- **Qué se guarda:** IP, agente y dispositivo al crear la sesión y en el último refresh.
- **Qué solo se audita:** login correcto y fallido, logout, revocaciones, reutilización y bloqueos.

**RIESGOS:** una escritura por refresh; complejidad de la reutilización.

**ALTERNATIVAS DESCARTADAS:**

- Sesiones sin estado, solo con JWT: no permiten revocar al instante.
- Sesión en Redis como única fuente: se perdería la trazabilidad y RLS no la cubriría.

**FASE:** F1.5.

---

## F. Transporte del refresh token

**DECISIÓN:** cookie HttpOnly o cuerpo de la respuesta.

| Criterio                              | Cookie `HttpOnly`                                                                                              | Cuerpo de la respuesta                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| XSS                                   | JavaScript no puede leer el refresh                                                                            | El refresh queda en memoria o almacenamiento y un XSS lo roba           |
| CSRF                                  | Requiere defensas: `SameSite=Strict`, ruta restringida, `Origin` y cabecera obligatoria                        | No aplica                                                               |
| SPA React/Vite                        | Al recargar la página se refresca con la cookie, sin almacenamiento                                            | Para sobrevivir a una recarga habría que usar `localStorage` (inseguro) |
| Dominio y subdominio                  | Cookie host-only del subdominio del laboratorio (sin atributo `Domain`): **no se comparte entre laboratorios** | —                                                                       |
| CORS                                  | Requiere que la API esté en el **mismo origen** (`<lab>.<dominio>/api/v1`), como ya hace el proxy de Vite      | Funciona entre orígenes                                                 |
| Logout                                | El servidor revoca la sesión y borra la cookie                                                                 | El cliente debe olvidar el token; el servidor revoca                    |
| Clientes no navegador (conector, API) | No aplica                                                                                                      | Adecuado; tienen su propio mecanismo en F16 y F17+                      |

**RECOMENDACIÓN: cookie `HttpOnly`.**

- **Atributos:** nombre `__Secure-ms_rt`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`, sin `Domain`.
- **Access token:** solo en memoria.
- **Defensas contra CSRF:** `SameSite=Strict`, cabecera obligatoria `X-Requested-With` y verificación de `Origin` en `/api/v1/auth/*`.
- **Cómo se lee la cookie:** el paquete `cookie`, que **ya está en el lockfile** (0.7.2, dependencia transitiva de Express), se agregaría como dependencia directa. Eso requiere regenerar el lockfile en tu equipo. La alternativa es un lector propio mínimo.

**IMPACTO:** exige la API en el mismo origen que la app en producción (**NO DETERMINADO** hoy; se confirma con D-10).

**RIESGOS:** en desarrollo hace falta HTTPS o `localhost`, donde los navegadores aceptan `Secure`, y resolver el subdominio en local (hallazgo de la auditoría).

**ALTERNATIVAS DESCARTADAS:** cuerpo de la respuesta con `localStorage`.

**FASE:** F1.5 (backend) y F1.8 (frontend).

---

## G. 401 frente a 403

**DECISIÓN:** qué significa cada estado y qué códigos internos existen.

**RECOMENDACIÓN:**

| HTTP | Código interno               | Cuándo                                                                                                          |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 401  | `UNAUTHENTICATED`            | Sin token                                                                                                       |
| 401  | `TOKEN_INVALID`              | Firma, formato, `iss`, `aud` o `kid` inválidos, falta `exp` o `sid`, o `lab` distinto al del subdominio         |
| 401  | `TOKEN_EXPIRED`              | `exp` vencido (el cliente debe refrescar)                                                                       |
| 401  | `SESSION_REVOKED`            | Sesión inexistente, revocada o vencida; usuario inexistente, `locked` o `inactive`                              |
| 401  | `INVALID_CREDENTIALS`        | Login fallido por cualquier causa (genérico, sin enumeración)                                                   |
| 401  | `MFA_REQUIRED`               | Paso de login: falta verificar el segundo factor                                                                |
| 401  | `REAUTH_REQUIRED`            | La acción exige reautenticación reciente                                                                        |
| 403  | `PERMISSION_DENIED` (existe) | Autenticado, sin el permiso                                                                                     |
| 403  | `MODULE_DISABLED` (existe)   | Módulo fuera del plan                                                                                           |
| 403  | `BRANCH_NOT_ALLOWED`         | `x-branch-id` inexistente, de otro laboratorio o no permitido (un único código, para no revelar cuáles existen) |
| 403  | `LABORATORY_UNAVAILABLE`     | Laboratorio `suspended` o `closed` (ver la decisión H2 en `F1_2_AUTHZ.md`)                                      |
| 403  | `MFA_ENROLLMENT_REQUIRED`    | Rol que exige MFA sin factor activo: solo se permiten los endpoints de alta de MFA                              |
| 400  | `TENANT_REQUIRED` (existe)   | Sin subdominio de laboratorio                                                                                   |
| 400  | `BRANCH_CONTEXT_INVALID`     | `x-branch-id` con formato inválido (hoy provoca un 500)                                                         |

El filtro de errores ya traduce `DomainError` a HTTP. Solo cambian la tabla de códigos y el middleware.

**ALTERNATIVAS DESCARTADAS:** todo 403, como hoy, porque el cliente no distingue "refrescar" de "sin permiso".

**FASE:** F1.3 (códigos de autorización y estado), F1.4 (sucursal) y F1.5 (token y sesión).

---

## H. Autorización desde la base

Se desarrolla en `F1_2_AUTHZ.md`: flujo, casos de estado y decisión H2 sobre el estado del laboratorio.

**FASE:** F1.3.

---

## I. Contrato de `x-branch-id`

Se desarrolla en `F1_2_AUTHZ.md` §3.

**FASE:** F1.4.

---

## J. MFA

Se desarrolla en `F1_2_MFA.md`.

**FASE:** F1.6; los usuarios de plataforma, en F2.

---

## K. Módulo `ai` frente a tipo de actor `'ai'`

**DECISIÓN:** si el rename de F1.7 debe tocar el tipo de actor.

**PROBLEMA:** existen dos cosas llamadas `ai`:

- **El módulo `ai`:** `packages/contracts/src/modules.ts` y `apps/api/src/modules/ai/`.
- **El tipo de actor `'ai'`:** `ActorType` en `request-context.ts` y el `CHECK` de `audit.audit_events.actor_type`.

**ANÁLISIS:** son **dos decisiones independientes**.

- El módulo es un dominio funcional, que el Freeze renombra a `clinical-ai`.
- El tipo de actor describe **qué clase de actor** realizó una acción (usuario, sistema, voz, IA, dispositivo…). No pertenece a un módulo, y una IA futura fuera de lo clínico (voz, BI) seguiría siendo actor `ai`.

**RECOMENDACIÓN:**

- F1.7 renombra **solo el módulo** (registro, carpeta y claves de permisos `ai.*`, si existieran).
- El tipo de actor `'ai'` **no cambia**.
- Se deja constancia en F1.7 de que no son dos módulos paralelos.

**IMPACTO:** evita modificar el `CHECK` de la tabla de auditoría, que es inmutable y está particionada.

**ALTERNATIVAS DESCARTADAS:** renombrar el actor a `clinical-ai`, porque mezcla el dominio con la clase de actor.

**FASE:** F1.7.
