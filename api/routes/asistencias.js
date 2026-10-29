import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();
const markSchema = z.object({
  qr_token: z.string().min(1).max(256),
}).strict();
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  alumno_id: z.coerce.number().int().positive().optional(),
});

router.use(authenticate);

router.post('/marcar', async (request, response, next) => {
  if (request.auth.role !== 'alumno') {
    response.status(403).json({ error: 'Solo un alumno puede marcar su asistencia.' });
    return;
  }
  const parsed = markSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El token QR enviado no es válido.' });
    return;
  }

  try {
    const activeQrs = await sql`
      SELECT qr.supervisor_id
      FROM qr_supervisor AS qr
      INNER JOIN vinculaciones AS link ON link.supervisor_id = qr.supervisor_id
      WHERE qr.token = ${parsed.data.qr_token}
        AND qr.activo = true
        AND link.alumno_id = ${request.auth.id}
        AND link.estado = 'activo'
      LIMIT 1
    `;
    if (!activeQrs[0]) {
      const validQrs = await sql`
        SELECT id
        FROM qr_supervisor
        WHERE token = ${parsed.data.qr_token}
          AND activo = true
        LIMIT 1
      `;
      response.status(validQrs[0] ? 403 : 404).json({
        error: validQrs[0]
          ? 'Debes estar vinculado activamente con ese supervisor para marcar asistencia.'
          : 'El código QR no existe o está inactivo.',
      });
      return;
    }

    const [profiles, lastAttendance, rows] = await sql.transaction((transactionSql) => [
      transactionSql`
        SELECT id
        FROM perfiles
        WHERE id = ${request.auth.id}
        FOR UPDATE
      `,
      transactionSql`
        WITH today_window AS (
          SELECT
            date_trunc('day', statement_timestamp() AT TIME ZONE 'America/Lima')
              AT TIME ZONE 'America/Lima' AS starts_at
        )
        SELECT
          to_char(
            attendance.timestamp AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) AS timestamp,
          attendance.timestamp > statement_timestamp() - interval '1 hour' AS cooldown_active
        FROM asistencias AS attendance
        CROSS JOIN today_window
        WHERE attendance.alumno_id = ${request.auth.id}
          AND attendance.timestamp >= today_window.starts_at
          AND attendance.timestamp < today_window.starts_at + interval '1 day'
        ORDER BY attendance.timestamp DESC, attendance.id DESC
        LIMIT 1
      `,
      transactionSql`
        WITH today_window AS (
          SELECT
            date_trunc('day', statement_timestamp() AT TIME ZONE 'America/Lima')
              AT TIME ZONE 'America/Lima' AS starts_at
        ),
        supervisor_qr AS (
          SELECT supervisor_id
          FROM qr_supervisor
          WHERE token = ${parsed.data.qr_token}
            AND activo = true
          LIMIT 1
        ),
        active_link AS (
          SELECT link.supervisor_id
          FROM vinculaciones AS link
          INNER JOIN supervisor_qr AS qr ON qr.supervisor_id = link.supervisor_id
          WHERE link.alumno_id = ${request.auth.id}
            AND link.estado = 'activo'
          LIMIT 1
        ),
        last_check AS (
          SELECT attendance.tipo
          FROM asistencias AS attendance
          CROSS JOIN today_window
          WHERE attendance.alumno_id = ${request.auth.id}
            AND attendance.timestamp >= today_window.starts_at
            AND attendance.timestamp < today_window.starts_at + interval '1 day'
          ORDER BY attendance.timestamp DESC, attendance.id DESC
          LIMIT 1
        ),
        next_check AS (
          SELECT
            active_link.supervisor_id,
            CASE WHEN last_check.tipo = 'entrada' THEN 'salida' ELSE 'entrada' END AS tipo
          FROM active_link
          LEFT JOIN last_check ON true
          WHERE NOT EXISTS (
            SELECT 1
            FROM asistencias AS recent_attendance
            CROSS JOIN today_window
            WHERE recent_attendance.alumno_id = ${request.auth.id}
              AND recent_attendance.timestamp >= today_window.starts_at
              AND recent_attendance.timestamp < today_window.starts_at + interval '1 day'
              AND recent_attendance.timestamp >= statement_timestamp() - interval '1 hour'
          )
        )
        INSERT INTO asistencias (
          alumno_id,
          supervisor_id,
          qr_token,
          tipo,
          timestamp,
          sincronizado
        )
        SELECT
          ${request.auth.id},
          next_check.supervisor_id,
          ${parsed.data.qr_token},
          next_check.tipo,
          statement_timestamp(),
          true
        FROM next_check
        RETURNING id, alumno_id, supervisor_id, qr_token, tipo, timestamp::text AS timestamp
      `,
    ]);

    if (!profiles[0]) {
      response.status(404).json({ error: 'No se encontró el perfil del alumno.' });
      return;
    }

    if (rows[0]) {
      response.status(201).json({ data: rows[0] });
      return;
    }

    const lastRecord = lastAttendance[0];
    if (lastRecord?.cooldown_active) {
      response.status(409).json({
        error: 'already_marked',
        timestamp: lastRecord.timestamp,
      });
      return;
    }

    response.status(409).json({ error: 'No se pudo registrar la asistencia. Inténtalo nuevamente.' });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (request, response, next) => {
  const parsed = paginationSchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: 'Los parámetros de paginación no son válidos.' });
    return;
  }
  const { limit, offset, alumno_id: alumnoId } = parsed.data;

  try {
    if (request.auth.role === 'supervisor' && alumnoId !== undefined) {
      const activeLink = await sql`
        SELECT link.id
        FROM vinculaciones AS link
        INNER JOIN perfiles AS alumno ON alumno.id = link.alumno_id
        WHERE link.supervisor_id = ${request.auth.id}
          AND link.alumno_id = ${alumnoId}
          AND link.estado = 'activo'
          AND alumno.rol = 'alumno'
        LIMIT 1
      `;
      if (!activeLink[0]) {
        response.status(403).json({ error: 'No tienes una vinculación activa con ese alumno.' });
        return;
      }
    } else if (request.auth.role !== 'supervisor' && alumnoId !== undefined) {
      response.status(403).json({ error: 'Solo un supervisor puede consultar asistencias por alumno.' });
      return;
    }

    const rows = request.auth.role === 'supervisor'
      ? alumnoId !== undefined
        ? await sql`
        SELECT
          attendance.id,
          attendance.alumno_id,
          attendance.supervisor_id,
          attendance.tipo,
          attendance.timestamp::text AS timestamp,
          profile.nombre AS alumno_nombre,
          profile.dni AS alumno_dni
        FROM asistencias AS attendance
        INNER JOIN vinculaciones AS link
          ON link.supervisor_id = attendance.supervisor_id
          AND link.alumno_id = attendance.alumno_id
          AND link.estado = 'activo'
        INNER JOIN perfiles AS profile ON profile.id = attendance.alumno_id
        WHERE attendance.supervisor_id = ${request.auth.id}
          AND attendance.alumno_id = ${alumnoId}
        ORDER BY attendance.timestamp DESC, attendance.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `
        : await sql`
        SELECT
          attendance.id,
          attendance.alumno_id,
          attendance.supervisor_id,
          attendance.tipo,
          attendance.timestamp::text AS timestamp,
          profile.nombre AS alumno_nombre,
          profile.dni AS alumno_dni
        FROM asistencias AS attendance
        INNER JOIN vinculaciones AS link
          ON link.supervisor_id = attendance.supervisor_id
          AND link.alumno_id = attendance.alumno_id
          AND link.estado = 'activo'
        INNER JOIN perfiles AS profile ON profile.id = attendance.alumno_id
        WHERE attendance.supervisor_id = ${request.auth.id}
        ORDER BY attendance.timestamp DESC, attendance.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      : await sql`
        SELECT
          attendance.id,
          attendance.alumno_id,
          attendance.supervisor_id,
          attendance.tipo,
          attendance.timestamp::text AS timestamp,
          profile.nombre AS supervisor_nombre
        FROM asistencias AS attendance
        INNER JOIN perfiles AS profile ON profile.id = attendance.supervisor_id
        WHERE attendance.alumno_id = ${request.auth.id}
        ORDER BY attendance.timestamp DESC, attendance.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    response.json({
      data: rows,
      pagination: { limit, offset, hasMore: rows.length === limit },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
