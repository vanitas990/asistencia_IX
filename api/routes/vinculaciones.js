import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = Router();
const requestSchema = z.object({
  codigo_6_practicante: z.string().regex(/^\d{6}$/),
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
      FROM qr_practicante AS qr
      INNER JOIN perfiles AS profile ON profile.id = qr.practicante_id
      WHERE qr.token = ${parsed.data.token}
        AND qr.activo = true
        AND profile.rol = 'practicante'
      LIMIT 1
    `;
    const practitioner = profiles[0];
    if (!practitioner) {
      response.status(404).json({ error: 'El código QR no existe o está inactivo.' });
      return;
    }
    if (practitioner.id === request.auth.id) {
      response.status(400).json({ error: 'No puedes vincular tu cuenta contigo mismo.' });
      return;
    }

    const rows = await sql`
      INSERT INTO vinculaciones (supervisor_id, practicante_id, estado, metodo)
      VALUES (${request.auth.id}, ${practitioner.id}, 'activo', 'qr')
      ON CONFLICT (supervisor_id, practicante_id)
      DO UPDATE SET estado = 'activo', metodo = 'qr'
      RETURNING id, supervisor_id, practicante_id, estado, metodo, created_at::text AS created_at
    `;
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/solicitar', requireRole('supervisor'), async (request, response, next) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El código del practicante debe tener 6 dígitos.' });
    return;
  }

  try {
    const profiles = await sql`
      SELECT id
      FROM perfiles
      WHERE codigo_6 = ${parsed.data.codigo_6_practicante}
        AND rol = 'practicante'
      LIMIT 1
    `;
    const practitioner = profiles[0];
    if (!practitioner) {
      response.status(404).json({ error: 'No se encontró un practicante con ese código.' });
      return;
    }
    if (practitioner.id === request.auth.id) {
      response.status(400).json({ error: 'No puedes vincular tu cuenta contigo mismo.' });
      return;
    }

    const existing = await sql`
      SELECT id, estado
      FROM vinculaciones
      WHERE supervisor_id = ${request.auth.id}
        AND practicante_id = ${practitioner.id}
      LIMIT 1
    `;
    if (existing[0]) {
      response.status(409).json({ error: 'Ya existe una solicitud o vinculación con ese practicante.' });
      return;
    }

    const rows = await sql`
      INSERT INTO vinculaciones (supervisor_id, practicante_id, estado, metodo)
      VALUES (${request.auth.id}, ${practitioner.id}, 'pendiente', 'id')
      RETURNING id, supervisor_id, practicante_id, estado, metodo, created_at::text AS created_at
    `;
    response.status(201).json({ data: rows[0] });
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: 'Ya existe una solicitud o vinculación con ese practicante.' });
      return;
    }
    next(error);
  }
});

router.get('/pendientes', requireRole('practicante'), async (request, response, next) => {
  try {
    const rows = await sql`
      SELECT
        v.id,
        v.supervisor_id,
        v.practicante_id,
        v.estado,
        v.metodo,
        v.created_at::text AS created_at,
        p.nombre AS supervisor_nombre,
        p.apellido AS supervisor_apellido,
        p.institucion AS supervisor_institucion
      FROM vinculaciones AS v
      INNER JOIN perfiles AS p ON p.id = v.supervisor_id
      WHERE v.practicante_id = ${request.auth.id}
        AND v.estado = 'pendiente'
      ORDER BY v.created_at ASC
    `;
    response.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/aceptar', requireRole('practicante'), async (request, response, next) => {
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
        AND practicante_id = ${request.auth.id}
        AND estado = 'pendiente'
      RETURNING id, supervisor_id, practicante_id, estado, metodo, created_at::text AS created_at
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
        AND (supervisor_id = ${request.auth.id} OR practicante_id = ${request.auth.id})
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
          p.apellido,
          p.codigo_6,
          p.curso_carrera,
          p.institucion
        FROM vinculaciones AS v
        INNER JOIN perfiles AS p ON p.id = v.practicante_id
        WHERE v.supervisor_id = ${request.auth.id}
          AND v.estado = 'activo'
        ORDER BY p.apellido, p.nombre
      `
      : await sql`
        SELECT
          v.id AS vinculacion_id,
          p.id,
          p.nombre,
          p.apellido,
          p.codigo_6,
          p.curso_carrera,
          p.institucion
        FROM vinculaciones AS v
        INNER JOIN perfiles AS p ON p.id = v.supervisor_id
        WHERE v.practicante_id = ${request.auth.id}
          AND v.estado = 'activo'
        ORDER BY p.apellido, p.nombre
      `;
    response.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
