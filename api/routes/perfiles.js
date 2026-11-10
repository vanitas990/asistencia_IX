import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { avatarDataUrlSchema, validateAvatarImage } from '../utils/avatar.js';
import { StudentLookupError, updateUniversityStudentPhone } from '../utils/estudiantes.js';

const router = Router();
const avatarSchema = z.object({
  avatar_url: avatarDataUrlSchema,
}).strict();
const editProfileSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150).optional(),
  telefono: z.string().trim().min(7).max(20).nullable().optional(),
  correo_institucional: z.string().trim().email().max(254).nullable().optional(),
  correo_personal: z.string().trim().email().max(254).nullable().optional(),
  correo_preferido: z.enum(['institucional', 'personal']).optional(),
}).strict().refine((data) => Object.keys(data).length > 0);
const updatePhoneSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  telefono: z.string().trim().regex(/^[+()\d\s-]{7,20}$/),
}).strict();

router.use(authenticate);

router.get('/yo', async (request, response, next) => {
  try {
    const rows = await sql`
      SELECT
        id,
        auth_user_id::text AS auth_user_id,
        dni,
        rol,
        nombre,
        facultad,
        carrera,
        telefono,
        correo_institucional,
        correo_personal,
        correo_preferido,
        origen_datos,
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
    console.error('Error en GET /api/perfiles/yo:', error?.message);
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
        dni,
        rol,
        nombre,
        facultad,
        carrera,
        telefono,
        correo_institucional,
        correo_personal,
        correo_preferido,
        origen_datos,
        created_at::text AS created_at,
        avatar_url
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    console.error('Error en PATCH /api/perfiles/avatar:', error?.message);
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
    const currentRows = await sql`
      SELECT rol, origen_datos, correo_institucional, correo_personal, correo_preferido
      FROM perfiles
      WHERE id = ${request.auth.id}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }

    const allowedFields = current.rol === 'supervisor'
      ? ['nombre', 'carrera', 'telefono', 'correo_personal']
      : current.origen_datos === 'api'
        ? ['telefono', 'correo_personal', 'correo_preferido']
        : ['nombre', 'facultad', 'telefono', 'correo_institucional', 'correo_personal', 'correo_preferido'];
    const disallowedField = Object.keys(parsed.data).find((field) => !allowedFields.includes(field));
    if (disallowedField) {
      response.status(400).json({ error: 'No tienes permiso para modificar ese campo del perfil.' });
      return;
    }

    if (current.rol === 'alumno') {
      const institutionalEmail = parsed.data.correo_institucional !== undefined
        ? parsed.data.correo_institucional
        : current.correo_institucional;
      const personalEmail = parsed.data.correo_personal !== undefined
        ? parsed.data.correo_personal
        : current.correo_personal;
      const preferredEmail = parsed.data.correo_preferido ?? current.correo_preferido;
      if (!institutionalEmail && !personalEmail) {
        response.status(400).json({ error: 'El perfil debe tener al menos un correo de contacto.' });
        return;
      }
      if (preferredEmail === 'institucional' && !institutionalEmail) {
        response.status(400).json({ error: 'El correo institucional preferido no está disponible.' });
        return;
      }
      if (preferredEmail === 'personal' && !personalEmail) {
        response.status(400).json({ error: 'El correo personal preferido no está disponible.' });
        return;
      }
    }

    const rows = await sql`
      UPDATE perfiles
      SET
        nombre = CASE WHEN ${parsed.data.nombre !== undefined} THEN ${parsed.data.nombre ?? null} ELSE nombre END,
        facultad = CASE WHEN ${parsed.data.facultad !== undefined} THEN ${parsed.data.facultad ?? null} ELSE facultad END,
        carrera = CASE WHEN ${parsed.data.carrera !== undefined} THEN ${parsed.data.carrera ?? null} ELSE carrera END,
        telefono = CASE WHEN ${parsed.data.telefono !== undefined} THEN ${parsed.data.telefono ?? null} ELSE telefono END,
        correo_institucional = CASE WHEN ${parsed.data.correo_institucional !== undefined} THEN ${parsed.data.correo_institucional ?? null} ELSE correo_institucional END,
        correo_personal = CASE WHEN ${parsed.data.correo_personal !== undefined} THEN ${parsed.data.correo_personal ?? null} ELSE correo_personal END,
        correo_preferido = CASE WHEN ${parsed.data.correo_preferido !== undefined} THEN ${parsed.data.correo_preferido ?? 'institucional'} ELSE correo_preferido END
      WHERE id = ${request.auth.id}
      RETURNING
        id,
        auth_user_id::text AS auth_user_id,
        dni,
        rol,
        nombre,
        facultad,
        carrera,
        telefono,
        correo_institucional,
        correo_personal,
        correo_preferido,
        origen_datos,
        created_at::text AS created_at,
        avatar_url
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    console.error('Error en PUT /api/perfiles/editar:', error?.message);
    next(error);
  }
});

router.post('/actualizar-telefono', requireRole('alumno'), async (request, response, next) => {
  const parsed = updatePhoneSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Ingresa un DNI y un teléfono válidos.' });
    return;
  }

  try {
    const profiles = await sql`
      SELECT dni, nombre, correo_institucional, correo_personal, rol, origen_datos
      FROM perfiles
      WHERE id = ${request.auth.id}
      LIMIT 1
    `;
    const profile = profiles[0];
    if (!profile) {
      response.status(404).json({ error: 'No se encontró el perfil.' });
      return;
    }
    if (profile.dni !== parsed.data.dni) {
      response.status(403).json({ error: 'El DNI no coincide con la cuenta autenticada.' });
      return;
    }
    if (profile.origen_datos !== 'api') {
      response.status(403).json({ error: 'Esta actualización solo está disponible para perfiles universitarios.' });
      return;
    }

    const correo = profile.correo_institucional ?? profile.correo_personal;
    if (!correo) {
      response.status(400).json({ error: 'El perfil no tiene un correo para actualizar en la API universitaria.' });
      return;
    }

    await updateUniversityStudentPhone({
      dni: profile.dni,
      nombre: profile.nombre,
      correo,
      telefono: parsed.data.telefono,
    });

    const rows = await sql`
      UPDATE perfiles
      SET telefono = ${parsed.data.telefono}
      WHERE id = ${request.auth.id}
        AND dni = ${parsed.data.dni}
      RETURNING
        id,
        auth_user_id::text AS auth_user_id,
        dni,
        rol,
        nombre,
        facultad,
        carrera,
        telefono,
        correo_institucional,
        correo_personal,
        correo_preferido,
        origen_datos,
        created_at::text AS created_at,
        avatar_url
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'No se encontró el perfil para guardar el teléfono.' });
      return;
    }
    response.json({ data: rows[0] });
  } catch (error) {
    if (error instanceof StudentLookupError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error en POST /api/perfiles/actualizar-telefono:', error?.message);
    next(error);
  }
});

export default router;
