# Reporte técnico — ASISTENCIA IX

## 1. Resumen

ASISTENCIA IX es una aplicación móvil para que alumnos registren entradas y salidas con códigos QR y para que supervisores administren sus vinculaciones y revisen las asistencias. La solución separa la aplicación del servidor: el cliente móvil consume una API Node.js/Express y la API consulta PostgreSQL alojado en Neon. La API también puede consultar el servicio universitario de UNHEVAL para validar y obtener datos de estudiantes a partir del DNI.

```text
Aplicación Expo (Android / iOS / web)
                │ HTTPS, API REST y JWT
                ▼
        API Node.js + Express
          │              │
          ▼              ▼
 PostgreSQL/Neon   API universitaria
                   UNHEVAL (DNI)
```

La app móvil no se conecta directamente a Neon. Las reglas de autenticación, permisos por rol, validación de datos y operaciones sobre la base de datos se aplican en el backend.

## 2. Tecnologías utilizadas

| Área | Tecnología | Uso |
| --- | --- | --- |
| Aplicación | React Native 0.88, React 19 y TypeScript | Interfaz móvil multiplataforma. |
| Framework móvil | Expo SDK 58 | Acceso a funciones nativas y configuración del proyecto. |
| Navegación | Expo Router | Rutas y navegación con archivos dentro de `src/app/`. |
| Cámara y QR | `expo-camera`, `react-native-qrcode-svg`, `qrcode` | Escanear códigos y mostrar códigos QR. |
| Almacenamiento móvil | `expo-secure-store` | Almacenar el refresh token y datos mínimos de sesión en dispositivos nativos. |
| Medios y archivos | `expo-image-picker`, `expo-media-library`, `expo-file-system`, `expo-sharing`, `react-native-view-shot` | Elegir avatar, capturar y compartir la tarjeta QR. |
| Validación | Zod | Validar formularios, solicitudes y respuestas de API. |
| Backend | Node.js 20+ y Express 5 | API REST, autenticación y lógica de negocio. |
| Base de datos | PostgreSQL en Neon, `@neondatabase/serverless` | Perfiles, vinculaciones, QR, asistencias y límites de intentos. |
| Contraseñas y sesión | Argon2id y JSON Web Token | Hash de contraseñas y tokens de acceso/renovación. |
| Compilación y distribución | EAS Build | APK interno de prueba y AAB para Google Play. |
| Calidad | ESLint, TypeScript y `node:test` | Lint, chequeo de tipos y pruebas del backend. |

El backend está escrito en JavaScript con módulos ES; el cliente está escrito en TypeScript.

## 3. Organización del código

- `src/app/`: pantallas y layouts de Expo Router.
  - `(auth)/`: bienvenida, inicio de sesión, registro y política de privacidad.
  - `(app)/`: inicio, perfil, QR, escaneo, asistencias, solicitudes y vinculaciones.
- `src/context/AuthContext.tsx`: estado de sesión y acceso autenticado compartido.
- `src/services/`: clientes para autenticación, estudiantes, perfiles, vinculaciones y asistencias.
- `src/schemas/`: esquemas de entrada y perfil usados por la app.
- `api/index.js`: configuración de Express, rutas, health check y manejo de errores.
- `api/routes/`: endpoints organizados por dominio.
- `api/middleware/`: autenticación, roles y límites de intentos.
- `api/utils/`: JWT, contraseñas, integración UNHEVAL y validación de avatares.
- `api/migrations/`: cambios aditivos a aplicar manualmente cuando la base existente los requiera.
- `db/schema.sql`: esquema completo para instalación inicial; es destructivo y elimina las tablas indicadas antes de recrearlas.

## 4. Cómo funciona la aplicación

### 4.1 Inicio y navegación

Al abrirse, `AuthProvider` intenta restaurar la sesión. Si el usuario está autenticado, la ruta inicial lo dirige al inicio de la app; de lo contrario, puede iniciar sesión o registrarse. Las pantallas principales están bajo un menú lateral. La navegación y las pantallas se definen en `src/app/`.

Los roles principales son `alumno` y `supervisor`. La interfaz muestra opciones apropiadas al rol, pero la autorización efectiva también se vuelve a comprobar en el backend.

### 4.2 Registro y consulta por DNI

1. La app valida el formulario y exige un DNI de ocho dígitos.
2. Para un alumno, consulta `GET /api/estudiantes/consultar/:dni` para cargar nombre, facultad y carrera.
3. La API valida el DNI y consulta el servicio de UNHEVAL usando las variables de servidor `UNHEVAL_API_URL` y `UNHEVAL_API_KEY`.
4. El backend valida la estructura de la respuesta, confirma que el DNI corresponda a un estudiante y devuelve los datos normalizados.
5. El registro vuelve a validar el payload, genera un UUID de autenticación, hashea la contraseña con Argon2id e inserta el perfil. El DNI es único.

El alumno debe aceptar las políticas de privacidad en el flujo de registro. La ruta de política abre `https://vanitas990.github.io/asistencia_IX/index.html` usando `Linking`.

### 4.3 Inicio de sesión y sesión persistente

El usuario inicia sesión con DNI y contraseña. El backend compara la contraseña con su hash Argon2id y devuelve:

- Un access token JWT válido por una hora.
- Un refresh token JWT válido por treinta días.
- Los datos del perfil.

En Android/iOS, el refresh token y datos mínimos del usuario se guardan mediante `expo-secure-store`; el access token permanece en memoria. En web, el almacenamiento usa `localStorage`. Cuando una solicitud autenticada recibe HTTP 401, el cliente intenta renovar la sesión y repetir la solicitud. Si la renovación también es rechazada, limpia la sesión.

La API valida el JWT y vuelve a leer el perfil desde la base de datos en cada solicitud protegida. Los endpoints específicos de rol comprueban `alumno` o `supervisor` en el servidor.

### 4.4 Vinculaciones

Las vinculaciones asocian un supervisor con un alumno:

- Un supervisor puede solicitar una vinculación usando el DNI del alumno. Se crea con estado `pendiente` y método `id`.
- El alumno revisa y acepta las solicitudes pendientes.
- Un supervisor también puede escanear el QR personal del alumno para activar la vinculación directamente con método `qr`.
- Ambos roles pueden consultar sus vinculaciones activas y eliminar una vinculación en la que participan.

El backend comprueba que las acciones se realicen sobre perfiles relacionados y aplica autorización por rol.

### 4.5 QR y marcación de asistencia

- El supervisor genera un QR asociado a su perfil. Puede regenerarlo; el token anterior queda inactivo.
- El alumno obtiene un QR personal para que un supervisor pueda vincularlo escaneándolo.
- La pantalla de escaneo usa `expo-camera`, lee un único QR a la vez y acepta el token en texto plano o en los formatos JSON previstos.
- En modo asistencia, el alumno escanea el QR del supervisor. El servidor comprueba que el QR esté activo y que la vinculación alumno-supervisor esté activa.
- El servidor alterna `entrada` y `salida` según la última marcación del alumno en el día, calculado con zona horaria de Perú.
- Se aplica un periodo de espera de una hora entre marcaciones del mismo día. Un intento repetido responde con HTTP 409 y el código `already_marked`.
- En modo vinculación, el supervisor escanea el QR del alumno para establecer la relación.

La pantalla del QR dibuja el código y una tarjeta lista para capturar, guardar en galería o compartir en dispositivos nativos.

### 4.6 Historial y perfiles

- El alumno consulta su historial de asistencias.
- El supervisor consulta las asistencias de hoy; la pantalla actualiza la lista automáticamente cada quince segundos y puede filtrar el historial de un alumno vinculado.
- Los perfiles permiten editar datos autorizados y actualizar el avatar. La imagen se envía como Data URL y el backend valida el tipo y limita el tamaño decodificado a 1 MiB.

## 5. API disponible

Todas las rutas de negocio se montan bajo `/api`; las respuestas exitosas normalmente usan el campo `data`.

| Método y ruta | Función y acceso principal |
| --- | --- |
| `GET /health`, `GET /api/health` | Comprueban conectividad con la base de datos. |
| `POST /api/auth/register` | Registro de alumno o supervisor. |
| `POST /api/auth/login` | Inicio de sesión con DNI y contraseña. |
| `POST /api/auth/refresh` | Renovación del access token. |
| `GET /api/estudiantes/consultar/:dni` | Consulta de datos universitarios; valida DNI y limita intentos. |
| `GET /api/perfiles/yo` | Obtiene el perfil autenticado. |
| `PATCH /api/perfiles/avatar`, `PUT /api/perfiles/editar` | Actualizan avatar o datos permitidos del perfil. |
| `POST /api/vinculaciones/solicitar` | Supervisor solicita vincular a un alumno por DNI. |
| `POST /api/vinculaciones/por-qr` | Supervisor activa una vinculación escaneando el QR del alumno. |
| `GET /api/vinculaciones/pendientes`, `POST /api/vinculaciones/aceptar` | Alumno consulta y acepta solicitudes. |
| `GET /api/vinculaciones/activas`, `DELETE /api/vinculaciones/:id` | Consulta o elimina una vinculación permitida. |
| `POST /api/qr/generar`, `POST /api/qr/regenerar`, `GET /api/qr/mi-qr` | Generación, regeneración y consulta del QR de supervisor. |
| `GET /api/qr/mi-qr-alumno` | Obtiene o crea el QR del alumno. |
| `POST /api/asistencias/marcar` | Registra entrada o salida desde un QR de supervisor válido. |
| `GET /api/asistencias` | Consulta historial paginado, según rol y vinculaciones. |

## 6. Modelo de datos

El esquema contiene seis tablas:

- **`perfiles`**: identidad interna, UUID de autenticación, DNI, rol, nombre, facultad, carrera, fecha de creación, hash de contraseña y avatar.
- **`vinculaciones`**: relación supervisor-alumno, estado y método de creación.
- **`qr_supervisor`**: tokens de supervisor con indicador activo.
- **`qr_alumno`**: token personal del alumno.
- **`asistencias`**: alumno, supervisor, token QR, tipo, fecha/hora y estado de sincronización.
- **`rate_limits`**: contadores de intentos por acción e IP hasheada.

Las relaciones usan `supervisor_id` y `alumno_id`. Las claves externas tienen borrado en cascada y hay índices para búsquedas de vinculaciones, asistencias y QR activos. El SQL habilita Row Level Security (RLS) y crea políticas basadas en `app.user_id`.

## 7. Validaciones y controles presentes

- Consultas SQL en la API usan plantillas parametrizadas de Neon.
- Zod valida datos de registro, login, DNI, tokens QR, paginación y otras solicitudes.
- Las contraseñas se guardan como hashes Argon2id, no en texto plano.
- Los JWT se validan por algoritmo, emisor, audiencia y tipo de token.
- Las rutas protegidas verifican identidad y rol.
- Registro, login, renovación de sesión y consulta universitaria aplican un límite de diez intentos por quince minutos por IP y acción.
- Las respuestas de API y varias respuestas de datos se validan en cliente antes de usarse.
- El middleware de Express maneja JSON inválido, payloads demasiado grandes y errores internos sin exponer los detalles de base de datos en la respuesta HTTP.

## 8. Configuración y despliegue

### Variables

- `DATABASE_URL`: conexión SSL a Neon.
- `JWT_SECRET`: secreto privado de al menos 32 caracteres.
- `UNHEVAL_API_URL`, `UNHEVAL_API_KEY`: acceso al servicio universitario.
- `PORT`: puerto del servidor, proporcionado por la plataforma; el backend usa `3000` como respaldo local.
- `EXPO_PUBLIC_API_URL`: URL base pública de la API incorporada al cliente al compilar.

Los secretos del backend deben configurarse en el entorno del servidor. `EXPO_PUBLIC_API_URL` se configura en el entorno EAS correspondiente y no se debe poner ningún secreto en variables `EXPO_PUBLIC_*`.

### Servidor

`api/start.js` carga el `.env` situado en la raíz y valida las variables obligatorias antes de importar el servidor. `api/index.js` inicia Express, monta las rutas y responde el health check únicamente si la consulta a Neon funciona. El servidor puede ejecutarse con Node o mantenerse activo con PM2 detrás de un proxy HTTPS.

### Android

La app tiene el paquete Android `com.asistenciaix.app`. En `eas.json`, el perfil `preview` genera APK para pruebas y `production` genera Android App Bundle (`.aab`) para Google Play, con incremento automático del código de versión. Las compilaciones requieren la URL pública final de la API y las credenciales de firma EAS.

## 9. Pruebas y comprobaciones

Comandos documentados para verificar el proyecto:

```bash
npm run lint
npx tsc --noEmit
npm --prefix api test
```

Las pruebas del backend usan el runner integrado `node:test` y cubren autenticación, validación de registro, consulta de estudiantes y avatares.

## 10. Consideraciones para operación

1. **Configurar UNHEVAL antes de producción.** Si `UNHEVAL_API_URL` no está definida, `lookupUniversityStudent` retorna un registro de prueba; no debe considerarse una validación de identidad real.
2. **Confirmar la política de RLS y el rol de Neon.** El esquema define políticas con `app.user_id`. La documentación del backend indica que la conexión actual necesita un rol con `BYPASSRLS` para operar sin establecer ese contexto. Confirmar que el rol y las políticas coincidan con el entorno de producción.
3. **Proteger `db/schema.sql`.** Es destructivo: elimina las seis tablas antes de crearlas. No ejecutarlo sobre datos existentes sin respaldo y autorización.
4. **Configurar la URL correcta para cada build.** La URL de la API queda compilada dentro de la app; cambiar el subdominio implica actualizar la variable en EAS y generar una nueva compilación.
5. **No asumir sincronización offline.** Aunque la tabla de asistencias tiene el campo `sincronizado`, el endpoint de marcación actualmente inserta los registros con valor `true`; no se observa una cola local de marcaciones pendientes.

---

Reporte elaborado a partir de la estructura y configuración presentes en el repositorio ASISTENCIA IX.
