import cors from 'cors';
import express from 'express';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from './db.js';
import asistenciasRouter from './routes/asistencias.js';
import authRouter from './routes/auth.js';
import studentsRouter from './routes/estudiantes.js';
import profileRouter from './routes/perfiles.js';
import qrRouter from './routes/qr.js';
import vinculacionesRouter from './routes/vinculaciones.js';

const PORT = process.env.PORT || 3000;
const numericPort = Number(PORT);
if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

const app = express();
app.disable('x-powered-by');
app.use(cors());
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
app.use('/api/estudiantes', studentsRouter);
app.use('/api/asistencias', asistenciasRouter);
app.use('/api/perfiles', profileRouter);
app.use('/api/vinculaciones', vinculacionesRouter);
app.use('/api/qr', qrRouter);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let webIndexPath;
for (const directoryName of ['dist', 'public']) {
  const directoryPath = resolve(projectRoot, directoryName);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) continue;

  app.use(express.static(directoryPath));
  const candidateIndexPath = resolve(directoryPath, 'index.html');
  if (existsSync(candidateIndexPath)) {
    webIndexPath = candidateIndexPath;
    break;
  }
}

if (webIndexPath) {
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(webIndexPath);
  });
}

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

app.listen(numericPort, '0.0.0.0', () => {
  console.info(`Asistencia IX API listening on port ${PORT}`);
});
