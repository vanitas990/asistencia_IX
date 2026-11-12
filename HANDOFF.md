# ASIX — Documento de traspaso técnico

**Fecha de referencia:** 12 de noviembre de 2026  
**Repositorio:** `vanitas990/asistencia_IX`  
**Raíz de trabajo:** `C:\ASIX`

Este documento describe el estado observado en el código del repositorio. No implica
que las migraciones ya se hayan ejecutado en Neon ni que el despliegue remoto coincida
con la copia local. No incluye valores de `.env`.

## 1. Stack tecnológico y estructura

### Stack

- **Cliente:** React Native 0.88, Expo SDK 58 y Expo Router; TypeScript.
- **Interfaz:** Dark Glassmorphism, superficies con `expo-blur` y videos de fondo con
  `expo-video`.
- **API:** Node.js 20+, Express 5, ES modules, Zod para validar payloads.
- **Persistencia:** Neon PostgreSQL Serverless mediante `@neondatabase/serverless`.
- **Autenticación:** contraseñas Argon2id, JWT HS256 (access y refresh), almacenamiento
  de refresh token en `expo-secure-store` en móvil y `localStorage` en Web.
- **Integración externa:** API de personas/facultades UNHEVAL, consumida únicamente
  desde el servidor.
- **Herramientas adicionales:** `expo-camera`, `expo-clipboard`, `expo-media-library`,
  `expo-print`, `expo-sharing`, `react-native-qrcode-svg`, Zod.

### Carpetas y archivos relevantes

| Ruta | Responsabilidad |
|---|---|
| `src/app/` | Pantallas Expo Router. `(auth)` contiene login y registro; `(app)` contiene Home, perfil, QR, asistencias y vinculaciones. |
| `src/components/` | UI compartida, incluyendo `FondoAnimado` y `PhoneConfirmationModal`. |
| `src/context/AuthContext.tsx` | Estado y persistencia de sesión, login, registro, refresh y llamadas autenticadas. |
| `src/services/` | Clientes tipados de API: auth, perfil, vinculaciones, asistencias, QR, etc. |
| `src/schemas/` | Esquemas Zod del cliente. |
| `src/types/` y `src/theme/` | Tipos de dominio y tokens/estilos compartidos. |
| `api/routes/` | Endpoints Express (`auth`, `perfiles`, `estudiantes`, `asistencias`, `qr`, `vinculaciones`). |
| `api/middleware/` | Autenticación JWT, autorización por rol, límite de intentos. |
| `api/schemas/` | Validación de payloads de servidor. |
| `api/utils/` | Acceso a UNHEVAL, Argon2/JWT, códigos de recuperación, avatar y utilidades. |
| `api/migrations/` | Migraciones incrementales para Neon. |
| `api/tests/` | Pruebas Node `node:test`. |
| `db/schema.sql` | Bootstrap destructivo que elimina y recrea el esquema. **No ejecutarlo en una base con datos que se deban conservar.** |
| `assets/fondo/` | Videos separados para Web y móvil. |

La URL de API móvil se resuelve en `src/services/api.ts`: Web usa `localhost`; Android
puede usar `localhost` con `EXPO_PUBLIC_USE_ADB_REVERSE=true` y el túnel ADB, y el resto
de desarrollo móvil obtiene el host desde `Constants.expoConfig?.hostUri`. En un build
de producción se usa `EXPO_PUBLIC_API_URL` si está configurada y no es una URL loopback.

## 2. Esquema de base de datos (Neon)

El bootstrap actual define las siete tablas siguientes. Los tipos se expresan como
PostgreSQL. `IDENTITY` indica columna identity; `PK`, clave primaria; `FK`, clave externa.
Los campos “nullable” no están declarados `NOT NULL` en el SQL correspondiente.

### `perfiles`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `auth_user_id` | `uuid` | `NOT NULL UNIQUE`; identidad de autenticación y `sub` del JWT. |
| `dni` | `char(8)` | `NOT NULL UNIQUE`; check de exactamente 8 dígitos. |
| `rol` | `text` | `NOT NULL`; check `supervisor` o `alumno`. |
| `nombre` | `text` | `NOT NULL`; nombre completo. |
| `facultad` | `text` | Nullable. |
| `carrera` | `text` | `NOT NULL`. En supervisores representa área/especialidad en la app. |
| `created_at` | `timestamptz` | `DEFAULT now()`. |
| `password_hash` | `text` | Nullable; hash Argon2id de la contraseña del supervisor. |
| `requiere_cambio_password` | `boolean` | `NOT NULL DEFAULT false`; bandera de contraseña temporal. |
| `avatar_url` | `text` | Nullable; el servidor admite Data URL de imagen y limita el contenido. |
| `origen_datos` | `text` | Añadida por migración 006; `NOT NULL DEFAULT 'manual'`, valores `api` o `manual`. |
| `telefono` | `text` | Añadida por migración 006; nullable. |
| `correo_institucional` | `text` | Añadida por migración 006; nullable. |
| `correo_personal` | `text` | Añadida por migración 006; nullable. |
| `correo_preferido` | `text` | Añadida por migración 006; `NOT NULL DEFAULT 'institucional'`, valores `institucional` o `personal`. |

No hay columnas `apellido` ni `ciclo` en el `db/schema.sql` actual ni en las consultas
de perfil activas. La migración 005 intenta cambiar la nulabilidad de `ciclo`, por lo
que debe verificarse contra el esquema real antes de ejecutarla.

### `codigos_recuperacion_supervisor`

Creada por migración 007 y también incluida en el bootstrap.

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `perfil_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `codigo_hash` | `text` | `NOT NULL UNIQUE`; SHA-256 del código normalizado, nunca su texto claro. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`. |

Se crean tres códigos aleatorios por supervisor al emitir/reemplazar códigos. Son
`UNH-` + 24 dígitos hexadecimales en mayúsculas (96 bits aleatorios). La tabla tiene RLS
y política para el perfil supervisor propietario. El código presentado se elimina al
consumirse; emitir un nuevo conjunto elimina los anteriores.

### `vinculaciones`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `supervisor_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `alumno_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `estado` | `text` | `NOT NULL`; `pendiente` o `activo`. |
| `metodo` | `text` | `NOT NULL`; `id` o `qr`. |
| `created_at` | `timestamptz` | `DEFAULT now()`. |

Restricción `UNIQUE (supervisor_id, alumno_id)`. Índices por alumno/estado y
supervisor/estado.

### `qr_supervisor`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `supervisor_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `token` | `text` | `NOT NULL UNIQUE`. |
| `activo` | `boolean` | `DEFAULT true`. |
| `created_at` | `timestamptz` | `DEFAULT now()`. |

Índice único parcial permite como máximo un QR activo por supervisor; migración 004
habilita guardar QR anteriores inactivos.

### `qr_alumno`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `alumno_id` | `integer` | `NOT NULL UNIQUE FK perfiles(id) ON DELETE CASCADE`. |
| `token` | `text` | `NOT NULL UNIQUE`. |
| `activo` | `boolean` | `NOT NULL DEFAULT true` en migración 003. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` en migración 003. |

### `asistencias`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `id` | `integer` | Identity, PK. |
| `alumno_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `supervisor_id` | `integer` | `NOT NULL FK perfiles(id) ON DELETE CASCADE`. |
| `qr_token` | `text` | `NOT NULL`; token usado para registrar. |
| `tipo` | `text` | `NOT NULL`; check `entrada` o `salida`. |
| `timestamp` | `timestamptz` | `DEFAULT now()`. |
| `sincronizado` | `boolean` | `DEFAULT true`. |

Índices por alumno/timestamp y supervisor/timestamp.

### `rate_limits`

| Columna | Tipo | Restricciones/uso |
|---|---|---|
| `clave` | `text` | PK; clave derivada de acción e IP hasheada. |
| `contador` | `integer` | `DEFAULT 0`. |
| `ventana_inicio` | `timestamptz` | `DEFAULT now()`. |

El middleware aplica 10 solicitudes por clave en una ventana de 15 minutos. RLS está
habilitado en las tablas del bootstrap; `rate_limits` no tiene política de usuario. La
API debe conectarse con un rol que pueda operar con el RLS habilitado, como documenta
`api/README.md` (rol de servidor con `BYPASSRLS`).

### Migraciones y salvedades de esquema

Migraciones existentes: `001-add-password-hash.sql`, `002-add-avatar-url.sql`,
`003-create-qr-alumno.sql`, `004-allow-qr-regeneration.sql`,
`005-allow-null-supervisor-academics.sql`, `006-add-contact-profile-fields.sql`,
`007-supervisor-password-recovery.sql`.

El bootstrap y la cadena histórica de migraciones no están completamente sincronizados:
por ejemplo, `db/schema.sql` ya declara algunas columnas que también introducen
migraciones, pero omite las columnas de contacto/origen que añade la 006; además, la 005
referencia `ciclo`, ausente del bootstrap actual. Revisar la estructura real de Neon y
ejecutar solo las migraciones necesarias. La 007 es requisito para los endpoints de
recuperación y emisión de códigos.

## 3. Endpoints del backend (`api/`)

Base local por defecto: `http://localhost:3000`. Respuestas exitosas suelen envolver los
datos en `data`; errores usan `{ "error": "..." }`. Los endpoints protegidos usan
`Authorization: Bearer <access_token>`. Zod valida payloads y las consultas Neon usan
parámetros interpolados del cliente `sql`.

| Método y ruta | Auth/rol | Función |
|---|---|---|
| `GET /health`, `GET /api/health` | Público | Prueba conexión a Neon; devuelve `{status:"ok"}`. |
| `POST /api/auth/register` | Público, rate-limited | Registro de alumno. El handler rechaza `rol: supervisor` con 403 hasta integrar verificación institucional real. |
| `POST /api/auth/login` | Público, rate-limited | Login de alumno por DNI o de supervisor por DNI + contraseña. Devuelve access/refresh tokens y perfil. |
| `POST /api/auth/refresh` | Público con refresh token, rate-limited | Emite un nuevo access token y perfil vigente. Refresh token de 30 días; el flujo no lo rota. |
| `POST /api/auth/recuperar-password-supervisor` | Público, rate-limited | Recibe `{dni, codigo_recuperacion}`. Consume el código válido y devuelve una contraseña temporal aleatoria; activa `requiere_cambio_password` y rota `auth_user_id` para invalidar sesiones previas. |
| `POST /api/auth/codigos-recuperacion-supervisor` | Supervisor autenticado; contraseña actual | Emite/reemplaza tres códigos. Devuelve los valores claros una única vez y guarda sus hashes. |
| `GET /api/estudiantes/consultar/:dni` | Público, rate-limited | Consulta el registro universitario; comprueba el formato del DNI. |
| `POST /api/asistencias/marcar` | Alumno autenticado | Recibe `{qr_token}`; valida QR activo y vinculación activa, alterna entrada/salida por día Lima y aplica enfriamiento de una hora. HTTP 409 `already_marked` si ya marcó dentro de esa ventana. |
| `GET /api/asistencias` | Autenticado | Lista asistencias paginadas. Acepta `limit`, `offset`, `fecha` y, para supervisor, `alumno_id`; limita `limit` a 50 y valida vinculación activa al consultar un alumno. |
| `GET /api/perfiles/yo` | Autenticado | Devuelve perfil vigente, incluida la bandera `requiere_cambio_password`; bloqueado mientras la contraseña temporal no se cambie. |
| `PATCH /api/perfiles/avatar` | Autenticado | Guarda imagen Data URL JPEG/PNG/WebP validada; bloqueado con contraseña temporal. |
| `PUT /api/perfiles/editar` | Autenticado | Actualiza campos de perfil permitidos por rol. Para cambiar contraseña envía `{current_password, password}`; mínimo 8 caracteres. Esta ruta es la única ruta de perfil accesible para completar el cambio forzado. |
| `POST /api/perfiles/actualizar-telefono` | Alumno autenticado | Valida DNI y teléfono, solicita actualización a UNHEVAL y guarda el número. |
| `POST /api/vinculaciones/solicitar` | Supervisor | Recibe `{dni_alumno}` y crea solicitud pendiente por DNI. |
| `POST /api/vinculaciones/por-qr` | Supervisor | Recibe `{token}` QR de alumno y crea/activa vinculación por QR. |
| `GET /api/vinculaciones/pendientes` | Alumno | Lista solicitudes de supervisores recibidas. |
| `POST /api/vinculaciones/aceptar` | Alumno | Recibe `{vinculacion_id}` y acepta una solicitud propia pendiente. |
| `GET /api/vinculaciones/activas` | Alumno o supervisor | Lista perfiles vinculados según el rol autenticado. |
| `DELETE /api/vinculaciones/:id` | Parte de la vinculación autenticada | Elimina la relación si quien llama es su alumno o supervisor. |
| `POST /api/qr/generar` | Supervisor | Crea o reutiliza el QR activo. |
| `POST /api/qr/regenerar` | Supervisor | Desactiva QR anterior y genera otro. |
| `GET /api/qr/mi-qr` | Supervisor | Devuelve el QR activo; 404 si no existe. |
| `GET /api/qr/mi-qr-alumno` | Alumno | Crea o devuelve el QR persistente del alumno. |

`authenticate` recarga rol y bandera de cambio desde `perfiles` al validar el token.
Las rutas de asistencias, QR supervisor, vinculaciones y la mayoría de perfil usan
`requirePasswordChangeComplete`. `/api/auth/refresh` no requiere contraseña cambiada,
pero las operaciones protegidas permanecen bloqueadas. El acceso a `PUT /editar` está
permitido para que el supervisor temporal pueda completar el cambio.

## 4. Flujo de autenticación de alumnos

1. En login el usuario selecciona el rol Alumno e ingresa su DNI de 8 dígitos; la app
   no solicita contraseña para este rol.
2. `POST /api/auth/login` busca DNI en `perfiles`.
3. Si existe un perfil de rol `alumno`, el backend devuelve una sesión sin verificar una
   contraseña. Si el DNI pertenece a un supervisor, devuelve 401.
4. Si el perfil no existe, el servidor consulta UNHEVAL mediante
   `UNHEVAL_API_URL` y `UNHEVAL_API_KEY`; sin URL configurada devuelve el perfil mock de
   desarrollo. La integración usa un timeout de 8 segundos, valida la forma de respuesta,
   comprueba que sea estudiante y que el DNI coincida; resuelve nombre de facultad y
   mapea nombre, carrera, correo y teléfono.
5. Si UNHEVAL devuelve alumno, se crea perfil `origen_datos='api'`, con DNI hasheado en
   `password_hash`, y se devuelve una sesión. Si no está, el endpoint responde 404 y la
   app puede navegar a registro manual.
6. El refresh token se guarda en SecureStore en iOS/Android y en `localStorage` en Web.
   El access token vive en memoria; `AuthContext` renueva al recibir 401.
7. El Home muestra `PhoneConfirmationModal` para alumno de origen API. Si el teléfono
   universitario no parece vigente, el alumno puede ingresar uno nuevo; el backend
   actualiza UNHEVAL y luego Neon.

**Nota de estado:** el login alumno actual funciona como acceso por DNI, sin password
para perfiles existentes. El DNI también se usa como contraseña inicial al crear el
perfil de origen API; el flujo de login por rol alumno no valida ese hash.

## 5. Flujo de autenticación de supervisores y recuperación

### Login y alta

- Login supervisor requiere DNI + contraseña. El backend comprueba rol, `password_hash`
  y contraseña Argon2id; devuelve access JWT de una hora y refresh JWT de 30 días.
- Los intentos están limitados por IP hash a 10 por 15 minutos. La interfaz cuenta
  fallos 401 y, tras tres, ofrece recuperación mediante código.
- **Alta de supervisor está actualmente bloqueada** tanto en la interfaz como en el
  handler de registro. `registerSchema` aún reconoce el shape de supervisor, pero el
  handler devuelve 403 antes de insertar. El UI informa que se requiere verificación
  institucional. No existe en este estado un mecanismo de alta automática y emisión de
  códigos al registrarse.
- Supervisores existentes deben aprovisionarse por proceso institucional vigente; tras
  iniciar sesión pueden emitir sus códigos desde Editar Perfil.

### Emisión y uso de códigos

1. Desde Editar Perfil, el supervisor vuelve a introducir contraseña actual y pide
   generar tres códigos.
2. `POST /api/auth/codigos-recuperacion-supervisor` valida rol, JWT, bandera de cambio y
   Argon2id de contraseña actual; genera tres códigos `UNH-<24 hex>`.
3. La API reemplaza el conjunto previo y almacena SHA-256 de cada código en
   `codigos_recuperacion_supervisor`. Devuelve códigos claros una sola vez; la UI los
   muestra en modal, permite copiarlos y advierte que deben guardarse. La operación de
   reemplazo invalida los códigos anteriores.
4. Tras tres fallos de login supervisor aparece el modal de recuperación. El usuario
   proporciona DNI y un código. `POST /api/auth/recuperar-password-supervisor` borra el
   código coincidente en la misma operación que actualiza la cuenta, por lo que un código
   solo puede utilizarse una vez.
5. El servidor genera contraseña temporal aleatoria (24 bytes codificados base64url,
   32 caracteres), la hashea con Argon2id y guarda `requiere_cambio_password=true`.
   Cambia también `auth_user_id`, invalidando los refresh tokens previos asociados al
   UUID anterior. Devuelve la contraseña temporal en la respuesta para que la app la
   muestre y permita copiarla.
6. Tras iniciar sesión con ella, Home muestra el aviso obligatorio y lleva a Editar
   Perfil enfocando “Nueva contraseña”. `PUT /api/perfiles/editar` verifica la contraseña
   temporal actual y escribe el nuevo hash, limpiando la bandera. El backend impide
   continuar en endpoints protegidos mientras la bandera siga activa.

### Archivos principales del flujo

- Backend: `api/routes/auth.js`, `api/routes/perfiles.js`,
  `api/middleware/authenticate.js`, `api/utils/recovery-codes.js`,
  `api/migrations/007-supervisor-password-recovery.sql`.
- Base: `db/schema.sql` contiene `requiere_cambio_password` y la tabla de hashes.
- Cliente: `src/app/(auth)/login.tsx`, `src/app/(auth)/register.tsx`,
  `src/app/(app)/home.tsx`, `src/app/(app)/editar-perfil.tsx`,
  `src/context/AuthContext.tsx`, `src/services/auth-api.ts`,
  `src/services/profile-api.ts`, `src/schemas/auth.schema.ts`,
  `src/types/index.ts`.
- La pantalla antigua de recuperación por correo `src/app/(auth)/forgot-password.tsx`
  fue eliminada. No quedan implementaciones de SMTP/Nodemailer o simulación de código
  de correo en `src/` y `api/`.

## 6. Módulos adicionales

### Modal de teléfono

`src/components/PhoneConfirmationModal.tsx` se muestra desde Home para alumno con
`origen_datos='api'`. Si hay teléfono de UNHEVAL, pide confirmación; si no hay, pide uno.
Permite guardar un teléfono con formato `^[+()\d\s-]{7,20}$`. El `AuthContext` llama
`POST /api/perfiles/actualizar-telefono`, que valida DNI de sesión, actualiza el sistema
universitario mediante UNHEVAL y persiste el teléfono en Neon. La UI presenta errores
y estados de carga.

### QR y exportación

- `src/app/(app)/qr.tsx` obtiene el QR del usuario por rol desde `src/services/link-api.ts`.
- El token persistente se renderiza con `react-native-qrcode-svg`; backend usa tokens
  aleatorios para QR nuevos.
- **Web:** el componente SVG produce un PNG Base64 y crea un enlace de descarga
  `mi_qr_asistencia.png`.
- **iOS/Android:** `ViewShot` captura la tarjeta como PNG; `expo-media-library` guarda
  en galería con permiso explícito, y `expo-sharing` abre el diálogo nativo para compartir.
- **Supervisor:** puede regenerar el QR. El anterior se desactiva y las copias impresas
  deben sustituirse.
- **Alumno:** muestra QR para vincularse con un supervisor.

### Contacto WhatsApp/correo

En `src/app/(app)/linked.tsx`, las tarjetas de perfiles vinculados muestran botones si
existe teléfono o correo disponible:

- WhatsApp: normaliza el teléfono a prefijo `51`; Web abre `web.whatsapp.com/send` y
  móvil usa `whatsapp://send`.
- Correo: abre `mailto:` con `Linking.openURL`.
- Para un alumno, el correo ofrecido es el correo personal del supervisor. Para un
  supervisor, utiliza la preferencia del correo del alumno (`correo_preferido`).
- Errores de apertura muestran una alerta indicando revisar que exista una app
  compatible.

## 7. Puesta en marcha y validación

```powershell
# Raíz
cd C:\ASIX
npm run start:server
npx expo start

# Tests de API
npm --prefix api test

# Cliente
npx tsc --noEmit
npx expo lint
```

El servidor lee `DATABASE_URL` y `JWT_SECRET` del entorno o del `.env` raíz mediante
`api/start.js`; `JWT_SECRET` debe tener al menos 32 caracteres. `UNHEVAL_API_URL` y
`UNHEVAL_API_KEY` son necesarias para integrar con el servicio real. No copiar `.env`
al documento ni al repositorio de traspaso.

Para acceso USB en Android, `fix-usb.ps1` ejecuta `adb reverse tcp:3000 tcp:3000`.
Debe activarse `EXPO_PUBLIC_USE_ADB_REVERSE=true` en el entorno de Expo para que la app
apunte a localhost del dispositivo y aproveche ese túnel.

## 8. Pendientes conocidos para el equipo receptor

1. Confirmar migraciones instaladas en Neon, especialmente 007 para recuperación.
2. Resolver la diferencia entre `db/schema.sql` y migraciones incrementales; en especial
   revisar `ciclo` de migración 005 y columnas de contacto de migración 006.
3. Definir e integrar el método institucional de alta/verificación de supervisores;
   hasta entonces la UI y backend rechazan ese rol en `POST /register`.
4. Revisar y documentar formalmente el flujo de alumnos por DNI, que actualmente no
   requiere contraseña cuando el perfil ya existe.
5. Correr las pruebas, typecheck y lint tras cambios de backend/cliente y probar el flujo
   con una cuenta supervisora aprovisionada y una base de pruebas.

