import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import { authRateLimit } from '../middleware/auth-rate-limit.js';
import {
  createAccessToken,
  createRefreshToken,
  generateAuthUserId,
  generateCodigo6,
  hashPassword,
  verifyPassword,
  verifyRefreshToken,
} from '../utils/auth.js';

const router = Router();

const registerSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  curso_carrera: z.string().trim().min(1).max(150),
  institucion: z.string().trim().min(1).max(150),
  rol: z.enum(['supervisor', 'practicante']),
  password: z.string().min(6).max(128),
}).strict();

const loginSchema = z.object({
  codigo_6: z.string().regex(/^\d{6}$/),
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
    codigo_6: profile.codigo_6,
  };
}

router.post('/register', authRateLimit('register'), async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Los datos enviados no son válidos.' });
    return;
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const authUserId = generateAuthUserId();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const codigo6 = generateCodigo6();
      try {
        const rows = await sql`
          INSERT INTO perfiles (
            auth_user_id,
            codigo_6,
            rol,
            nombre,
            apellido,
            curso_carrera,
            institucion,
            password_hash
          )
          VALUES (
            ${authUserId}::uuid,
            ${codigo6},
            ${parsed.data.rol},
            ${parsed.data.nombre},
            ${parsed.data.apellido},
            ${parsed.data.curso_carrera},
            ${parsed.data.institucion},
            ${passwordHash}
          )
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

        const profile = rows[0];
        response.status(201).json({
          data: createAuthResponse(profile),
        });
        return;
      } catch (error) {
        if (error?.code === '23505' && attempt < 4) {
          continue;
        }
        if (error?.code === '23505') {
          console.error('ERROR REAL DE NEON:', error);
          console.error('Detalles del error de Neon:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
          });
          response.status(503).json({ error: 'No se pudo generar un código único. Inténtalo de nuevo.' });
          return;
        }
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

router.post('/login', authRateLimit('login'), async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'El código o la contraseña no tienen un formato válido.' });
  }

  try {
    console.log('1. Buscando usuario...');
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
        avatar_url,
        password_hash
      FROM perfiles
      WHERE codigo_6 = ${parsed.data.codigo_6}
      LIMIT 1
    `;
    const profile = rows[0];
    if (!profile) {
      return response.status(401).json({ error: 'Código o contraseña incorrectos.' });
    }
    if (!profile.password_hash) {
      console.error('Login rejected: password_hash is missing for the requested profile.');
      return response.status(500).json({ error: 'La cuenta no tiene una contraseña configurada.' });
    }

    console.log('2. Verificando contraseña...');
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
      return response.status(401).json({ error: 'Código o contraseña incorrectos.' });
    }

    console.log('3. Generando tokens...');
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
        codigo_6,
        rol,
        nombre,
        apellido,
        curso_carrera,
        institucion,
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
