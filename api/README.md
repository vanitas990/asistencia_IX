# Despliegue en Render

1. Crea un **Web Service** desde el repositorio y establece `api` como **Root Directory**.
2. Usa Node.js 20 o superior y estos comandos:
   - Build: `npm ci`
   - Start: `npm start`
3. Configura estas variables en Render:
   - `DATABASE_URL`: cadena de conexión de Neon.
   - `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
   - `CORS_ORIGINS`: orígenes web permitidos, separados por comas (por ejemplo, `https://mi-app.example.com`). Usa solo los dominios reales, sin rutas y sin `*`.
   - `UNHEVAL_API_URL` (opcional): URL base del servicio universitario. Si no se configura, la consulta devuelve un alumno mock para pruebas.

Render asigna `PORT` automáticamente; la API lo lee al iniciar. Configura la URL pública de la API como `EXPO_PUBLIC_API_URL` en el entorno de compilación de Expo. El health check está en `/health`.

# API local

En desarrollo local, la API lee `DATABASE_URL` y `JWT_SECRET` del entorno o del archivo `.env` en la raíz del proyecto.
El secreto JWT debe tener al menos 32 caracteres. El `.env` local no debe subirse al
control de versiones.

```sh
cd api
npm install
npm start
```

El servidor usa `PORT` del entorno (por defecto `3000`) y ofrece `GET /api/health` (y su alias `GET /health`),
`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` y las rutas de
vinculación y QR indicadas abajo. Las rutas de autenticación limitan los intentos por IP
usando la tabla `rate_limits`.

Para habilitar fotos de perfil, ejecuta manualmente en Neon:

```sql
ALTER TABLE public.perfiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

También puedes ejecutar `api/migrations/002-add-avatar-url.sql`. Registro, login,
renovación de sesión y `GET /api/perfiles/yo` devuelven `avatar_url`. El endpoint
autenticado `PATCH /api/perfiles/avatar` recibe una imagen JPEG/PNG/WebP como Data URL
Base64 y limita el contenido decodificado a 1 MiB. La app comprime la imagen al
seleccionarla y no guarda el Base64 en SecureStore; el perfil actualizado se recarga
al renovar la sesión.

Registro y login devuelven un JWT de acceso (1 hora) y un refresh token (30 días). El
refresh token no rota en este flujo; guárdalo en SecureStore y no lo envíes en solicitudes
a otros endpoints.

El DNI (8 dígitos) es el identificador de inicio de sesión y vinculación. Las cuentas
existentes deben tener su DNI único cargado para iniciar sesión con el esquema actual.
`GET /api/estudiantes/consultar/:dni` consulta los datos universitarios del alumno. Si
`UNHEVAL_API_URL` no está configurada, la API devuelve los datos mock documentados para
probar el flujo directamente como JSON. En Render, `UNHEVAL_API_URL` debe ser la URL base
externa; el backend añade el DNI como segmento final.

Las operaciones de vinculación y QR requieren `Authorization: Bearer <access_token>`.
Cada solicitud valida el token, vuelve a cargar el perfil vigente y autoriza según su rol:

- `POST /api/vinculaciones/solicitar` (supervisor): recibe
  `{"dni_alumno":"12345678"}` y crea una solicitud pendiente con método `id`.
- `GET /api/vinculaciones/pendientes` (alumno): lista las solicitudes recibidas,
  incluyendo nombre, apellido y facultad del supervisor.
- `POST /api/vinculaciones/aceptar` (alumno): recibe `{"vinculacion_id":1}` y acepta
  únicamente una solicitud pendiente dirigida a ese perfil.
- `GET /api/vinculaciones/activas`: lista los alumnos vinculados si el usuario es
  supervisor, o los supervisores vinculados si es alumno.
- `DELETE /api/vinculaciones/:id`: elimina una vinculación si quien llama es el
  supervisor o alumno que pertenece a esa relación.
- `POST /api/qr/generar` (supervisor): crea un token QR aleatorio seguro o devuelve el QR
  existente del perfil.
- `POST /api/qr/regenerar` (supervisor): desactiva su QR actual y genera uno nuevo.
  Requiere ejecutar `api/migrations/004-allow-qr-regeneration.sql` en Neon.
- `GET /api/qr/mi-qr` (supervisor): consulta su token existente; devuelve 404 si aún no
  se ha generado.
- `GET /api/qr/mi-qr-alumno` (alumno): crea o devuelve el token QR estático del
  alumno. El esquema actualizado usa la tabla `qr_alumno`.
- `POST /api/vinculaciones/por-qr` (supervisor): recibe `{"token":"..."}` y activa la
  vinculación con el alumno dueño del QR.
- `POST /api/asistencias/marcar` (alumno): recibe `{"qr_token":"..."}`, valida que el
  QR del supervisor esté activo y que exista una vinculación activa, e inserta entrada o
  salida alternando según la última marcación del día. Rechaza otro registro dentro de la
  hora siguiente con HTTP 409 y el código `already_marked`.
- `GET /api/asistencias?limit=50&offset=0`: devuelve hasta 50 registros recientes; el
  supervisor ve los de sus vinculaciones activas y el alumno su propio historial.
- `GET /api/asistencias?alumno_id=123&limit=50&offset=0`: permite a un supervisor
  consultar el historial de un alumno específico únicamente si mantienen una
  vinculación activa.
- `PUT /api/perfiles/editar`: actualiza nombre, apellido, facultad, carrera y ciclo
  del perfil autenticado; el DNI y rol no se aceptan en el payload.

Las respuestas exitosas de estos endpoints envuelven el resultado en `data`. Los errores
de validación, autorización y conflictos usan respuestas JSON con `error`.

En la app, el supervisor puede enviar solicitudes a alumnos, consultar sus
vinculaciones activas y mostrar/exportar su QR. El alumno puede revisar y aceptar
solicitudes pendientes y consultar sus vinculaciones activas. La exportación abre el
diálogo de impresión en web y comparte un PDF en Android/iOS.

Los IDs de perfil y de las tablas relacionadas son `integer` identity; `auth_user_id`
permanece UUID y sigue siendo el subject de los JWT. `db/schema.sql` es un script
destructivo: elimina y vuelve a crear las seis tablas, reinicia los IDs y borra todos
sus datos. Revísalo y ejecútalo manualmente en Neon solo después de confirmar un respaldo
y que se pueden perder esos datos. La API requiere un rol de base de datos con `BYPASSRLS`
para operar sin establecer el contexto `app.user_id`; este proyecto de desarrollo usa
un rol así.

La autenticación necesita la columna `perfiles.password_hash` para guardar los hashes
Argon2id. Si todavía no existe, ejecuta `api/migrations/001-add-password-hash.sql` en
Neon. La migración es aditiva y la columna queda nullable para no invalidar los perfiles
existentes; estos perfiles deberán restablecer su contraseña para iniciar sesión.
Ninguna contraseña en texto plano se guarda en la base de datos.

Al iniciar, la API registra únicamente indicadores booleanos sobre el rol de conexión,
RLS de `perfiles` y la existencia de `password_hash`. Los errores de base de datos se
registran en la terminal con mensaje, código, detalle, sugerencia y stack; no se devuelve
esa información al cliente.

La app usa `EXPO_PUBLIC_API_URL` (por defecto `http://localhost:3000`). Para probar desde
un dispositivo físico, cambia ese valor en el `.env` raíz por `http://<IP-LAN-del-PC>:3000`,
reinicia Expo y permite el puerto 3000 en el firewall de desarrollo. No uses `localhost`
en el teléfono: apuntaría al propio dispositivo.
