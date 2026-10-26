import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authRateLimit } from '../middleware/auth-rate-limit.js';
import { registerSchema } from '../schemas/auth.js';
import { lookupUniversityStudent, StudentLookupError } from '../utils/estudiantes.js';
import {
  createAccessToken,
  createRefreshToken,
  generateAuthUserId,
  hashPassword,
  verifyPassword,
  verifyRefreshToken,
} from '../utils/auth.js';

const router = Router();

const loginSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  password: z.string().min(1).max(128),
}).strict();

const refreshSchema = z.object({
  refresh_token: z.string().min(1).max(4096),
}).strict();

function createAuthResponse(profile) {
  return {
    access_token: createAccessToken(profile),
    refresh_token: createRefreshToken(profile),
    user: profile,
    dni: profile.dni,
  };
}

router.post('/register', authRateLimit('register'), async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Los datos enviados no son válidos.' });
    return;
  }

  try {
    const studentRecord = parsed.data.rol === 'alumno'
      ? await lookupUniversityStudent(parsed.data.dni)
      : null;
    const passwordHash = await hashPassword(parsed.data.password);
    const authUserId = generateAuthUserId();

    try {
      const rows = await sql`
        INSERT INTO perfiles (
          auth_user_id,
          dni,
          rol,
          nombre,
          apellido,
          facultad,
          carrera,
          ciclo,
          password_hash
        )
        VALUES (
          ${authUserId}::uuid,
          ${parsed.data.dni},
          ${parsed.data.rol},
          ${studentRecord?.nombres ?? parsed.data.nombre},
          ${studentRecord?.apellidos ?? parsed.data.apellido},
          ${parsed.data.rol === 'supervisor' ? null : studentRecord.facultad},
          ${studentRecord?.carrera ?? parsed.data.carrera},
          ${parsed.data.rol === 'supervisor' ? null : studentRecord.ciclo},
          ${passwordHash}
        )
        RETURNING
          id,
          auth_user_id::text AS auth_user_id,
          dni,
          rol,
          nombre,
          apellido,
          facultad,
          carrera,
          ciclo,
          created_at::text AS created_at,
          avatar_url
      `;

      response.status(201).json({
        data: createAuthResponse(rows[0]),
      });
    } catch (error) {
      if (error?.code === '23505') {
        response.status(409).json({ error: 'Ya existe una cuenta registrada con ese DNI.' });
        return;
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof StudentLookupError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Registration request failed:', {
      name: error?.name ?? 'UnknownError',
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      constraint: error?.constraint,
      stack: error?.stack,
    });
    next(error);
  }
});

router.post('/login', authRateLimit('login'), async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'El DNI o la contraseña no tienen un formato válido.' });
  }

  try {
    const rows = await sql`
      SELECT
        id,
        auth_user_id::text AS auth_user_id,
        dni,
        rol,
        nombre,
        apellido,
        facultad,
        carrera,
        ciclo,
        created_at::text AS created_at,
        avatar_url,
        password_hash
      FROM perfiles
      WHERE dni = ${parsed.data.dni}
      LIMIT 1
    `;
    const profile = rows[0];
    if (!profile) {
      return response.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }
    if (!profile.password_hash) {
      console.error('Login rejected: password_hash is missing for the requested profile.');
      return response.status(500).json({ error: 'La cuenta no tiene una contraseña configurada.' });
    }

    let passwordMatches;
    try {
      passwordMatches = await verifyPassword(parsed.data.password, profile.password_hash);
    } catch (error) {
      console.error('Password verification failed:', {
        name: error?.name ?? 'UnknownError',
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
      });
      return next(error);
    }

    if (!passwordMatches) {
      return response.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }

    const { password_hash: _passwordHash, ...user } = profile;
    return response.status(200).json({
      data: createAuthResponse(user),
    });
  } catch (error) {
    console.error('Login request failed:', {
      name: error?.name ?? 'UnknownError',
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      detail: error?.detail,
    });
    return next(error);
  }
});

router.post('/refresh', authRateLimit('refresh'), async (request, response, next) => {
  const parsed = refreshSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El refresh token enviado no es válido.' });
    return;
  }

  try {
    const claims = verifyRefreshToken(parsed.data.refresh_token);
    if (!claims || typeof claims.sub !== 'string') {
      response.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
      return;
    }

    const rows = await sql`
      SELECT
        id,
        auth_user_id::text AS auth_user_id,
        dni,
        rol,
        nombre,
        apellido,
        facultad,
        carrera,
        ciclo,
        created_at::text AS created_at,
        avatar_url
      FROM perfiles
      WHERE auth_user_id = ${claims.sub}::uuid
      LIMIT 1
    `;
    const profile = rows[0];
    if (!profile) {
      response.status(401).json({ error: 'La cuenta ya no está disponible. Inicia sesión nuevamente.' });
      return;
    }

    response.json({
      data: {
        access_token: createAccessToken(profile),
        user: profile,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
