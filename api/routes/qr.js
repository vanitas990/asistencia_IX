import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { sql } from '../db.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = Router();

router.get(
  '/mi-qr-practicante',
  authenticate,
  requireRole('practicante'),
  async (request, response, next) => {
    try {
      const token = randomBytes(32).toString('base64url');
      const rows = await sql`
        INSERT INTO qr_practicante (practicante_id, token, activo)
        VALUES (${request.auth.id}, ${token}, true)
        ON CONFLICT (practicante_id)
        DO UPDATE SET activo = true
        RETURNING token, activo
      `;
      response.json({ data: rows[0] });
    } catch (error) {
      next(error);
    }
  },
);

router.use(authenticate, requireRole('supervisor'));

router.post('/generar', async (request, response, next) => {
  try {
    const token = randomBytes(32).toString('base64url');
    const rows = await sql`
      INSERT INTO qr_supervisor (supervisor_id, token, activo)
      VALUES (${request.auth.id}, ${token}, true)
      ON CONFLICT (supervisor_id) WHERE activo = true
      DO UPDATE SET activo = true
      RETURNING token, activo
    `;
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/regenerar', async (request, response, next) => {
  try {
    const token = randomBytes(32).toString('base64url');
    const [profiles, , rows] = await sql.transaction((transactionSql) => [
      transactionSql`
        SELECT id
        FROM perfiles
        WHERE id = ${request.auth.id}
        FOR UPDATE
      `,
      transactionSql`
        UPDATE qr_supervisor
        SET activo = false
        WHERE supervisor_id = ${request.auth.id}
          AND activo = true
      `,
      transactionSql`
        INSERT INTO qr_supervisor (supervisor_id, token, activo)
        VALUES (${request.auth.id}, ${token}, true)
        RETURNING token, activo
      `,
    ]);
    if (!profiles[0]) {
      response.status(404).json({ error: 'No se encontró el perfil del supervisor.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/mi-qr', async (request, response, next) => {
  try {
    const rows = await sql`
      SELECT token, activo
      FROM qr_supervisor
      WHERE supervisor_id = ${request.auth.id}
        AND activo = true
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Aún no tienes un código QR. Genera uno primero.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
