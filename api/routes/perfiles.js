import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import {
  authenticate,
  requirePasswordChangeComplete,
  requireRole,
} from '../middleware/authenticate.js';
import { avatarDataUrlSchema, validateAvatarImage } from '../utils/avatar.js';
import { hashPassword, verifyPassword } from '../utils/auth.js';
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
  current_password: z.string().min(1).max(128).optional(),
  password: z.string().min(8).max(128).optional(),
}).strict()
  .refine((data) => Object.keys(data).length > 0)
  .refine((data) => (data.password === undefined) === (data.current_password === undefined), {
    message: 'La contraseña actual y la nueva contraseña son obligatorias para cambiarla.',
  });
const updatePhoneSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  telefono: z.string().trim().regex(/^[+()\d\s-]{7,20}$/),
}).strict();

router.use(authenticate);

router.get('/yo', requirePasswordChangeComplete, async (request, response, next) => {
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
        avatar_url,
        requiere_cambio_password,
        telefono_confirmado
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

router.patch('/avatar', requirePasswordChangeComplete, async (request, response, next) => {
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
        avatar_url,
        requiere_cambio_password,
        telefono_confirmado
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
      SELECT
        rol,
        origen_datos,
        correo_institucional,
        correo_personal,
        correo_preferido,
        password_hash,
        requiere_cambio_password
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
      ? ['nombre', 'carrera', 'telefono', 'correo_personal', 'current_password', 'password']
      : current.origen_datos === 'api'
        ? ['telefono', 'correo_personal', 'correo_preferido']
        : ['nombre', 'facultad', 'telefono', 'correo_institucional', 'correo_personal', 'correo_preferido'];
    const disallowedField = Object.keys(parsed.data).find((field) => !allowedFields.includes(field));
    if (disallowedField) {
      response.status(400).json({ error: 'No tienes permiso para modificar ese campo del perfil.' });
      return;
    }

    if (current.requiere_cambio_password && parsed.data.password === undefined) {
      response.status(403).json({
        error: 'Debes cambiar tu contraseña temporal antes de continuar.',
        code: 'password_change_required',
      });
      return;
    }

    if (parsed.data.password !== undefined
      && (!current.password_hash
        || !(await verifyPassword(parsed.data.current_password ?? '', current.password_hash)))) {
      response.status(401).json({ error: 'La contraseña actual no es válida.' });
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

    const newPasswordHash = parsed.data.password === undefined
      ? null
      : await hashPassword(parsed.data.password);
    const nextCarrera = parsed.data.carrera === undefined
      ? undefined
      : current.rol === 'supervisor'
        ? (parsed.data.carrera?.trim() || 'No aplica')
        : parsed.data.carrera;
    const rows = await sql`
      UPDATE perfiles
      SET
        nombre = CASE WHEN ${parsed.data.nombre !== undefined} THEN ${parsed.data.nombre ?? null} ELSE nombre END,
        facultad = CASE WHEN ${parsed.data.facultad !== undefined} THEN ${parsed.data.facultad ?? null} ELSE facultad END,
        carrera = CASE WHEN ${nextCarrera !== undefined} THEN ${nextCarrera ?? null} ELSE carrera END,
        telefono = CASE WHEN ${parsed.data.telefono !== undefined} THEN ${parsed.data.telefono ?? null} ELSE telefono END,
        correo_institucional = CASE WHEN ${parsed.data.correo_institucional !== undefined} THEN ${parsed.data.correo_institucional ?? null} ELSE correo_institucional END,
        correo_personal = CASE WHEN ${parsed.data.correo_personal !== undefined} THEN ${parsed.data.correo_personal ?? null} ELSE correo_personal END,
        correo_preferido = CASE WHEN ${parsed.data.correo_preferido !== undefined} THEN ${parsed.data.correo_preferido ?? 'institucional'} ELSE correo_preferido END,
        password_hash = CASE WHEN ${parsed.data.password !== undefined} THEN ${newPasswordHash} ELSE password_hash END,
        requiere_cambio_password = CASE WHEN ${parsed.data.password !== undefined} THEN false ELSE requiere_cambio_password END
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
        avatar_url,
        requiere_cambio_password,
        telefono_confirmado
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

router.post(
  '/actualizar-telefono',
  requirePasswordChangeComplete,
  requireRole('alumno'),
  async (request, response, next) => {
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
      },
    );

    const rows = await sql`
      UPDATE perfiles
      SET
        telefono = ${parsed.data.telefono},
        telefono_confirmado = true
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
        avatar_url,
        requiere_cambio_password,
        telefono_confirmado
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

router.post(
  '/confirmar-telefono',
  requirePasswordChangeComplete,
  requireRole('alumno'),
  async (request, response, next) => {
    try {
      const rows = await sql`
        UPDATE perfiles
        SET telefono_confirmado = true
        WHERE id = ${request.auth.id}
          AND rol = 'alumno'
          AND origen_datos = 'api'
          AND telefono IS NOT NULL
          AND btrim(telefono) <> ''
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
          avatar_url,
          requiere_cambio_password,
          telefono_confirmado
      `;
      if (!rows[0]) {
        response.status(404).json({ error: 'No se encontró un teléfono para confirmar.' });
        return;
      }
      response.json({ data: rows[0] });
    } catch (error) {
      console.error('Error en POST /api/perfiles/confirmar-telefono:', error?.message);
      next(error);
    }
  },
);

export default router;
