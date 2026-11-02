# ASISTENCIA IX

Aplicación móvil para el registro y consulta de asistencia mediante códigos QR, desarrollada para la Universidad Nacional Hermilio Valdizán (UNHEVAL).

## Tecnologías

- **Frontend:** React Native, Expo y Expo Router.
- **Backend:** Node.js y Express.
- **Base de datos:** PostgreSQL en Neon.
- **Compilación móvil:** EAS Build.

## Preparación del entorno

En la raíz del repositorio, instala las dependencias del frontend:

```bash
npm install
```

Copia `.env.example` a `.env` y completa los valores necesarios. No publiques `.env` ni incluyas secretos en el repositorio. La plantilla contiene variables para el backend y para la compilación del frontend.

## Backend

El backend está en `api/`. Requiere Node.js 20 o superior. Instala sus dependencias y configura las variables del archivo `.env` en la raíz del repositorio:

```bash
cd api
npm install
npm start
```

El comando de desarrollo es `npm run dev`. El servidor escucha en `process.env.PORT` y usa el puerto `3000` como valor local predeterminado. El endpoint de comprobación es `/health`.

Para producción, el proceso puede mantenerse activo con PM2:

```bash
cd api
pm2 start start.js --name asistencia-ix-api
pm2 save
```

En el servidor, configura como mínimo `DATABASE_URL` y `JWT_SECRET` (de al menos 32 caracteres). `UNHEVAL_API_URL` y `UNHEVAL_API_KEY` habilitan la consulta al servicio universitario. CORS permite solicitudes desde cualquier origen; la API utiliza autenticación por token para sus rutas protegidas.

## Frontend y publicación en Android

`EXPO_PUBLIC_API_URL` indica la URL base del backend. Expo la incorpora al bundle en el momento de compilar; cualquier cambio de URL requiere una nueva compilación. Antes de compilar, define esa variable en `.env` o en las variables de entorno de EAS.

Para generar el Android App Bundle (`.aab`) para Google Play:

```bash
npx eas-cli@latest build --platform android --profile production
```

También se puede usar `eas build --platform android --profile production` si EAS CLI está instalado. Inicia sesión en Expo/EAS y configura las credenciales de Android cuando el asistente de compilación lo solicite.

## Entrega al equipo de iHUB

- Configurar el backend para escuchar en `process.env.PORT`; el código usa `3000` como respaldo local.
- Proporcionar el subdominio HTTPS definitivo del backend (por ejemplo, `https://api-asistencia.unheval.edu.pe`).
- Con esa URL, actualizar `EXPO_PUBLIC_API_URL` en el entorno de compilación de EAS y generar un nuevo bundle.
- Proporcionar también la URL final del servicio de consulta universitaria para `UNHEVAL_API_URL` y su clave `UNHEVAL_API_KEY`, si corresponde.
- La política estática para publicación en Google Play se encuentra en [`privacidad.html`](./privacidad.html).

## Comprobaciones de desarrollo

```bash
npm run lint
npx tsc --noEmit
npm --prefix api test
```
