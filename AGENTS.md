This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

# AGENTS.md - Contexto y Reglas del Proyecto "Asistencia_IX"

## 1. Visión General
App móvil de asistencia mediante códigos QR para instituciones educativas. Los supervisores generan un QR estático (impreso) y los alumnos lo escanean para registrar entrada/salida en tiempo real.

## 2. Stack Tecnológico
- **Frontend:** React Native + Expo (Expo Router).
- **Librerías Clave:** `expo-camera`, `expo-print`, `expo-sharing`, `expo-secure-store`, `zod`.
- **Backend/API:** Edge Functions (Vercel/Cloudflare) o Node.js ligero.
- **Base de Datos:** Neon (PostgreSQL Serverless) usando el pooler (PgBouncer).
- **Autenticación:** JWT propio + Refresh Tokens (sin correo, usando el DNI de 8 dígitos).

## 3. Arquitectura y Regla de Oro
- **REGLA DE ORO:** La app móvil NUNCA se conecta directamente a Neon. Todo el tráfico pasa por la capa de API.
- La API es la encargada de validar identidad, aplicar rate limiting, hashear contraseñas (Argon2/Bcrypt) y ejecutar consultas parametrizadas.

## 4. Esquema de Base de Datos (Neon PostgreSQL)
El agente debe asumir la existencia de estas 5 tablas:
1. **`perfiles`**: id (integer), auth_user_id (UUID), dni (CHAR 8, UNIQUE, NOT NULL), rol ('supervisor' | 'alumno'), nombre, apellido, facultad, carrera, ciclo, created_at.
2. **`vinculaciones`**: id, supervisor_id, alumno_id, estado ('pendiente' | 'activo'), metodo ('id' | 'qr'), created_at.
3. **`qr_supervisor`**: id, supervisor_id, token (UNIQUE), activo (BOOLEAN), created_at.
4. **`qr_alumno`**: id, alumno_id, token (UNIQUE), activo (BOOLEAN), created_at.
5. **`asistencias`**: id, alumno_id, supervisor_id, qr_token, tipo ('entrada' | 'salida'), timestamp, sincronizado (BOOLEAN).
6. **`rate_limits`**: clave (PK), contador, ventana_inicio.

*Nota: Se debe implementar RLS (Row Level Security) en todas las tablas sensibles.*

## 5. Reglas de Seguridad Estrictas
- **Anti-Inyección SQL:** PROHIBIDO concatenar strings en SQL. Usar siempre consultas parametrizadas (ej. `sql\`SELECT * FROM perfiles WHERE dni = ${dni}\``).
- **Validación:** Usar `zod` para validar todos los payloads antes de tocar la base de datos. El DNI debe cumplir con el regex `/^\d{8}$/`.
- **Sesión en App:** El Refresh Token se guarda en `expo-secure-store`. El JWT viaja en los headers.

## 6. Estándares de Código
- **Lenguaje:** TypeScript estricto.
- **Nomenclatura:** 
  - Código (variables, funciones, componentes) en **inglés** y **camelCase**.
  - Rutas de la API y nombres de columnas de DB en **español**.
- **UI:** Componentes funcionales, manejo de estados de carga y error.

## 7. Tareas Actuales (Fase 1)
- Generar el archivo `db/schema.sql` local para luego ejecutarlo en Neon.
- Crear validaciones con Zod (`src/schemas/`).
- Crear el `AuthContext.tsx` para el manejo de sesión en React Native.