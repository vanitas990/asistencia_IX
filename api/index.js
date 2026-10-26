import cors from 'cors';
import express from 'express';

import { sql } from './db.js';
import asistenciasRouter from './routes/asistencias.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/perfiles.js';
import qrRouter from './routes/qr.js';
import vinculacionesRouter from './routes/vinculaciones.js';

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? 'http://localhost:8081,http://localhost:8082')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1.5mb' }));

async function checkDatabase(_request, response, next) {
  try {
    await sql`SELECT 1`;
    response.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
}

app.get('/health', checkDatabase);
app.get('/api/health', checkDatabase);

app.use('/api/auth', authRouter);
app.use('/api/asistencias', asistenciasRouter);
app.use('/api/perfiles', profileRouter);
app.use('/api/vinculaciones', vinculacionesRouter);
app.use('/api/qr', qrRouter);

function logDatabaseError(error, context) {
  const details = {
    name: error?.name ?? 'UnknownError',
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack,
  };

  if (error?.name === 'NeonDbError') {
    console.error('ERROR REAL DE NEON:', error);
    console.error('Detalles del error de Neon:', details);
    return;
  }

  console.error(context, details);
}

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'El cuerpo JSON no es válido.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    response.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
    return;
  }

  logDatabaseError(error, 'API request failed:');
  response.status(500).json({ error: 'Ocurrió un error interno. Inténtalo de nuevo más tarde.' });
});

async function logDatabaseCapabilities() {
  try {
    const [rows] = await sql`
      SELECT
        role.rolsuper AS is_superuser,
        role.rolbypassrls AS bypasses_rls,
        relation.relrowsecurity AS profiles_rls_enabled,
        relation.relforcerowsecurity AS profiles_force_rls,
        (relation.relowner = role.oid) AS owns_profiles,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'perfiles'
            AND column_name = 'password_hash'
        ) AS profiles_has_password_hash
      FROM pg_roles AS role
      LEFT JOIN pg_class AS relation
        ON relation.oid = to_regclass('public.perfiles')
      WHERE role.rolname = current_user
    `;

    console.log('Database role/RLS/schema diagnostics:', rows ?? { status: 'role metadata unavailable' });
  } catch (error) {
    logDatabaseError(error, 'Database diagnostics failed:');
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Asistencia IX API listening on port ${PORT}`);
  void logDatabaseCapabilities();
});
