# ASISTENCIA IX

Aplicación móvil de la Universidad Nacional Hermilio Valdizán (UNHEVAL) para registrar y consultar asistencias mediante códigos QR. La API valida las operaciones de la aplicación y se integra con los servicios universitarios de consulta por DNI.

## Stack

- **Aplicación móvil:** React Native, Expo SDK 58 y Expo Router.
- **API:** Node.js 20 o superior y Express.
- **Base de datos:** PostgreSQL en Neon.
- **Compilaciones móviles:** EAS Build.

La aplicación móvil se comunica con la API; no se conecta directamente a Neon.

## Requisitos

- Node.js 20 o superior y npm.
- Una base de datos Neon con el esquema del proyecto aplicado.
- Una cuenta de Expo con acceso al proyecto EAS para compilar.

## Configuración del entorno

Desde la raíz del repositorio, crea el archivo local de variables a partir de la plantilla:

```bash
cp .env.example .env
```

Completa `.env` con los valores del entorno:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de Neon con SSL habilitado. |
| `JWT_SECRET` | Secreto privado de al menos 32 caracteres para firmar tokens. |
| `UNHEVAL_API_URL` | URL base del servicio universitario de consulta. |
| `UNHEVAL_API_KEY` | Credencial del servicio universitario, si este la requiere. |
| `EXPO_PUBLIC_API_URL` | URL HTTPS pública de la API para compilaciones de producción. |

No agregues secretos a Git ni a variables `EXPO_PUBLIC_*`. La URL pública de la API no es un secreto. En producción, configura las variables sensibles en el servidor; para compilaciones EAS en la nube, define `EXPO_PUBLIC_API_URL` en **EAS > Project settings > Environment variables**, en el entorno que corresponda (`preview` o `production`).

## Backend en un VPS

1. Instala Node.js 20 o superior y PM2 en el VPS:

   ```bash
   npm install --global pm2
   ```

2. Clona el repositorio y configura las variables del backend en `.env` en la raíz del proyecto. El proceso `api/start.js` carga ese archivo y valida `DATABASE_URL` y `JWT_SECRET` antes de iniciar.
3. Instala las dependencias y arranca la API con PM2 desde la raíz:

```bash
npm ci --prefix api
pm2 start api/start.js --name asistencia-ix-api
pm2 startup
```

Ejecuta el comando que imprime `pm2 startup` y luego guarda la lista de procesos para habilitar el inicio automático después de reiniciar el VPS:

```bash
pm2 save
```

Para desplegar una actualización:

```bash
git pull
npm ci --prefix api
pm2 restart asistencia-ix-api --update-env
```

El servidor escucha en `process.env.PORT` y usa el puerto `3000` como valor local predeterminado. En el VPS, permite que el proxy inverso (por ejemplo, Nginx) gestione HTTPS y reenvíe las solicitudes al puerto asignado a la API. Comprueba el servicio en `https://<subdominio>/health`.

No expongas `DATABASE_URL`, `JWT_SECRET` ni `UNHEVAL_API_KEY` al cliente móvil. Si usas un archivo `.env` en producción, mantenlo fuera del control de versiones y limita sus permisos.

## Compilación Android con EAS

Inicia sesión con la cuenta de Expo que tiene acceso al proyecto:

```bash
npx eas-cli@latest login
```

Para generar un **APK de prueba** para instalación directa, configura primero `EXPO_PUBLIC_API_URL` en el entorno `preview` de EAS y ejecuta:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Para generar el **Android App Bundle (`.aab`)** que se entrega a Google Play, configura la URL en el entorno `production` de EAS y ejecuta:

```bash
npx eas-cli@latest build --platform android --profile production
```

El perfil `production` incrementa automáticamente el código de versión Android. EAS puede solicitar configurar las credenciales de firma la primera vez.

## Entrega al ingeniero de iHUB

1. Proveer el subdominio HTTPS definitivo de la API.
2. Configurar ese valor como `EXPO_PUBLIC_API_URL` en los entornos `preview` y `production` de EAS.
3. Generar un APK nuevo con el perfil `preview` para pruebas en dispositivos. Cuando se apruebe, generar el `.aab` con el perfil `production` para Google Play.
4. Confirmar que la API responda correctamente en `/health` y que las variables del backend estén configuradas en el VPS.

La política de privacidad publicada está disponible en [vanitas990.github.io/asistencia-ix-web](https://vanitas990.github.io/asistencia-ix-web/).

## Desarrollo local

La app y la API se ejecutan por separado. Desde la raíz del proyecto, abre dos terminales:

```bash
npm run start:server
```

```bash
npm start
```

La API local usa el puerto `3000` y requiere `DATABASE_URL` y `JWT_SECRET` en `.env`. En modo desarrollo, la app usa automáticamente `http://localhost:3000/api` en web y la dirección del host de Metro en Android/iOS; no hace falta cambiar `EXPO_PUBLIC_API_URL`. Para probar en un dispositivo físico, inicia Expo en modo LAN y conecta el móvil y el equipo a la misma red Wi-Fi. Las compilaciones de producción usan `EXPO_PUBLIC_API_URL`.

## Comprobaciones locales

```bash
npm run lint
npx tsc --noEmit
npm --prefix api test
```
