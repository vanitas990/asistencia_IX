import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = Router();
const requestSchema = z.object({
  dni_alumno: z.string().regex(/^\d{8}$/),
}).strict();
const acceptSchema = z.object({
  vinculacion_id: z.number().int().positive(),
}).strict();
const qrLinkSchema = z.object({
  token: z.string().min(1).max(256),
}).strict();

router.use(authenticate);

router.post('/por-qr', requireRole('supervisor'), async (request, response, next) => {
  const parsed = qrLinkSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El token QR enviado no es válido.' });
    return;
  }

  try {
    const profiles = await sql`
      SELECT profile.id
      FROM qr_alumno AS qr
      INNER JOIN perfiles AS profile ON profile.id = qr.alumno_id
      WHERE qr.token = ${parsed.data.token}
        AND qr.activo = true
        AND profile.rol = 'alumno'
      LIMIT 1
    `;
    const alumno = profiles[0];
    if (!alumno) {
      response.status(404).json({ error: 'El código QR no existe o está inactivo.' });
      return;
    }
    if (alumno.id === request.auth.id) {
      response.status(400).json({ error: 'No puedes vincular tu cuenta contigo mismo.' });
      return;
    }

    const rows = await sql`
      INSERT INTO vinculaciones (supervisor_id, alumno_id, estado, metodo)
      VALUES (${request.auth.id}, ${alumno.id}, 'activo', 'qr')
      ON CONFLICT (supervisor_id, alumno_id)
      DO UPDATE SET estado = 'activo', metodo = 'qr'
      RETURNING id, supervisor_id, alumno_id, estado, metodo, created_at::text AS created_at
    `;
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/solicitar', requireRole('supervisor'), async (request, response, next) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El DNI del alumno debe tener 8 dígitos.' });
    return;
  }

  try {
    const profiles = await sql`
      SELECT id
      FROM perfiles
      WHERE dni = ${parsed.data.dni_alumno}
        AND rol = 'alumno'
      LIMIT 1
    `;
    const alumno = profiles[0];
    if (!alumno) {
      response.status(404).json({ error: 'No se encontró un alumno con ese DNI.' });
      return;
    }
    if (alumno.id === request.auth.id) {
      response.status(400).json({ error: 'No puedes vincular tu cuenta contigo mismo.' });
      return;
    }

    const existing = await sql`
      SELECT id, estado
      FROM vinculaciones
      WHERE supervisor_id = ${request.auth.id}
        AND alumno_id = ${alumno.id}
      LIMIT 1
    `;
    if (existing[0]) {
      response.status(409).json({ error: 'Ya existe una solicitud o vinculación con ese alumno.' });
      return;
    }

    const rows = await sql`
      INSERT INTO vinculaciones (supervisor_id, alumno_id, estado, metodo)
      VALUES (${request.auth.id}, ${alumno.id}, 'pendiente', 'id')
      RETURNING id, supervisor_id, alumno_id, estado, metodo, created_at::text AS created_at
    `;
    response.status(201).json({ data: rows[0] });
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: 'Ya existe una solicitud o vinculación con ese alumno.' });
      return;
    }
    next(error);
  }
});

router.get('/pendientes', requireRole('alumno'), async (request, response, next) => {
  try {
    const rows = await sql`
      SELECT
        v.id,
        v.supervisor_id,
        v.alumno_id,
        v.estado,
        v.metodo,
        v.created_at::text AS created_at,
        p.nombre AS supervisor_nombre,
        p.facultad AS supervisor_facultad
      FROM vinculaciones AS v
      INNER JOIN perfiles AS p ON p.id = v.supervisor_id
      WHERE v.alumno_id = ${request.auth.id}
        AND v.estado = 'pendiente'
      ORDER BY v.created_at ASC
    `;
    response.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/aceptar', requireRole('alumno'), async (request, response, next) => {
  const parsed = acceptSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El identificador de la vinculación no es válido.' });
    return;
  }

  try {
    const rows = await sql`
      UPDATE vinculaciones
      SET estado = 'activo'
      WHERE id = ${parsed.data.vinculacion_id}
        AND alumno_id = ${request.auth.id}
        AND estado = 'pendiente'
      RETURNING id, supervisor_id, alumno_id, estado, metodo, created_at::text AS created_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'La solicitud no existe o ya fue procesada.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (request, response, next) => {
  const vinculationId = z.coerce.number().int().positive().safeParse(request.params.id);
  if (!vinculationId.success) {
    response.status(400).json({ error: 'El identificador de la vinculación no es válido.' });
    return;
  }

  try {
    const rows = await sql`
      DELETE FROM vinculaciones
      WHERE id = ${vinculationId.data}
        AND (supervisor_id = ${request.auth.id} OR alumno_id = ${request.auth.id})
      RETURNING id
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'La vinculación no existe o no tienes permiso para eliminarla.' });
      return;
    }
    response.json({ data: { id: rows[0].id, deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.get('/activas', async (request, response, next) => {
  try {
    const rows = request.auth.role === 'supervisor'
      ? await sql`
        SELECT
          v.id AS vinculacion_id,
          p.id,
          p.nombre,
          p.dni,
          p.facultad,
          p.carrera
        FROM vinculaciones AS v
        INNER JOIN perfiles AS p ON p.id = v.alumno_id
        WHERE v.supervisor_id = ${request.auth.id}
          AND v.estado = 'activo'
        ORDER BY p.nombre
      `
      : await sql`
        SELECT
          v.id AS vinculacion_id,
          p.id,
          p.nombre,
          p.dni,
          p.facultad,
          p.carrera
        FROM vinculaciones AS v
        INNER JOIN perfiles AS p ON p.id = v.supervisor_id
        WHERE v.alumno_id = ${request.auth.id}
          AND v.estado = 'activo'
        ORDER BY p.nombre
      `;
    response.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
