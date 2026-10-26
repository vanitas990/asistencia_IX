import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { avatarDataUrlSchema, validateAvatarImage } from '../utils/avatar.js';

const router = Router();
const avatarSchema = z.object({
  avatar_url: avatarDataUrlSchema,
}).strict();
const editProfileSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  curso_carrera: z.string().trim().min(1).max(150),
  institucion: z.string().trim().min(1).max(150),
}).strict();

router.use(authenticate);

router.get('/yo', async (request, response, next) => {
  try {
    const rows = await sql`
      SELECT
        id,
        auth_user_id::text AS auth_user_id,
        codigo_6,
        rol,
        nombre,
        apellido,
        curso_carrera,
        institucion,
        created_at::text AS created_at,
        avatar_url
      FROM perfiles
      WHERE auth_user_id = ${request.auth.authUserId}::uuid
      LIMIT 1
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/avatar', async (request, response, next) => {
  const parsed = avatarSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'La imagen debe ser JPEG, PNG o WebP en formato Base64.' });
    return;
  }

  const imageError = validateAvatarImage(parsed.data.avatar_url);
  if (imageError) {
    response.status(imageError.status).json({ error: imageError.error });
    return;
  }

  try {
    const rows = await sql`
      UPDATE perfiles
      SET avatar_url = ${parsed.data.avatar_url}
      WHERE auth_user_id = ${request.auth.authUserId}::uuid
      RETURNING
        id,
        auth_user_id::text AS auth_user_id,
        codigo_6,
        rol,
        nombre,
        apellido,
        curso_carrera,
        institucion,
        created_at::text AS created_at,
        avatar_url
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/editar', async (request, response, next) => {
  const parsed = editProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Completa correctamente todos los campos del perfil.' });
    return;
  }

  try {
    const rows = await sql`
      UPDATE perfiles
      SET
        nombre = ${parsed.data.nombre},
        apellido = ${parsed.data.apellido},
        curso_carrera = ${parsed.data.curso_carrera},
        institucion = ${parsed.data.institucion}
      WHERE id = ${request.auth.id}
      RETURNING
        id,
        auth_user_id::text AS auth_user_id,
        codigo_6,
        rol,
        nombre,
        apellido,
        curso_carrera,
        institucion,
        created_at::text AS created_at,
        avatar_url
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
