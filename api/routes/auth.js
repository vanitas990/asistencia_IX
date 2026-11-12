import { Router } from 'express';
import { z } from 'zod';

import { sql } from '../db.js';
import {
  authenticate,
  requirePasswordChangeComplete,
  requireRole,
} from '../middleware/authenticate.js';
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
import {
  generateRecoveryCodes,
  generateTemporaryPassword,
  hashRecoveryCode,
} from '../utils/recovery-codes.js';

const router = Router();

const loginSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  password: z.string().nullable().optional(),
  rol: z.enum(['alumno', 'supervisor']).optional().default('supervisor'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1).max(4096),
}).strict();
const passwordRecoverySchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  codigo_recuperacion: z.string().regex(/^UNH-[A-F0-9]{24}$/i),
}).strict();
const recoveryCodesSchema = z.object({
  current_password: z.string().min(1).max(128),
}).strict();

function createAuthResponse(profile) {
  return {
    access_token: createAccessToken(profile),
    refresh_token: createRefreshToken(profile),
    user: profile,
    dni: profile.dni,
  };
}

function redactRegistrationValue(value, registrationData) {
  if (typeof value !== 'string') return value;
  const sensitiveValues = [
    registrationData?.dni,
    registrationData?.nombre,
    registrationData?.facultad,
    registrationData?.carrera,
    registrationData?.correo_institucional,
    registrationData?.correo_personal,
    registrationData?.telefono,
    registrationData?.password,
  ].filter((item) => typeof item === 'string' && item.length > 0);

  return sensitiveValues.reduce(
    (message, sensitiveValue) => message.replaceAll(sensitiveValue, '[REDACTED]'),
    value.replace(/\b\d{8}\b/g, '[REDACTED_DNI]'),
  );
}

router.post('/register', authRateLimit('register'), async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Los datos enviados no son válidos.' });
    return;
  }

  const registrationData = parsed.data;
  const sensitiveRegistrationData = { ...registrationData };
  try {
    const studentRecord = parsed.data.rol === 'alumno' && parsed.data.origen_datos === 'api'
      ? await lookupUniversityStudent(parsed.data.dni)
      : null;
    Object.assign(sensitiveRegistrationData, studentRecord);
    const passwordHash = await hashPassword(parsed.data.password);
    const authUserId = generateAuthUserId();

    try {
      const rows = await sql`
        INSERT INTO perfiles (
          auth_user_id,
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
          password_hash
        )
        VALUES (
          ${authUserId}::uuid,
          ${parsed.data.dni},
          ${parsed.data.rol},
          ${studentRecord?.nombre ?? parsed.data.nombre},
          ${parsed.data.rol === 'supervisor' ? null : studentRecord?.facultad ?? parsed.data.facultad ?? null},
          ${studentRecord?.carrera ?? parsed.data.carrera},
          ${studentRecord?.telefono ?? parsed.data.telefono ?? null},
          ${studentRecord
            ? studentRecord.correo_institucional
            : parsed.data.correo_institucional ?? null},
          ${parsed.data.correo_personal ?? null},
          ${parsed.data.correo_preferido},
          ${parsed.data.origen_datos},
          ${passwordHash}
        )
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

      response.status(201).json({
        data: createAuthResponse(rows[0]),
      });
    } catch (error) {
      if (error?.code === '23505' && /dni/i.test(error?.constraint ?? '')) {
        response.status(409).json({ error: 'Ya existe una cuenta registrada con ese DNI.' });
        return;
      }
      console.error('Error exacto de Neon:', {
        message: redactRegistrationValue(error?.message, sensitiveRegistrationData),
        detail: redactRegistrationValue(error?.detail, sensitiveRegistrationData),
        hint: redactRegistrationValue(error?.hint, sensitiveRegistrationData),
        code: error?.code,
        constraint: error?.constraint,
      });
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
      detail: redactRegistrationValue(error?.detail, sensitiveRegistrationData),
      hint: redactRegistrationValue(error?.hint, sensitiveRegistrationData),
      constraint: error?.constraint,
      stack: redactRegistrationValue(error?.stack, sensitiveRegistrationData),
    });
    next(error);
  }
});

router.post('/login', authRateLimit('login'), async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'El DNI o la contraseña no tienen un formato válido.' });
  }

  const { dni, password, rol } = parsed.data;

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
        telefono_confirmado,
        password_hash
      FROM perfiles
      WHERE dni = ${dni}
      LIMIT 1
    `;
    let profile = rows[0];

    // ==========================================
    // FLUJO 1: ALUMNOS (Auto-registro vía UNHEVAL)
    // ==========================================
    if (rol === 'alumno') {
      // No permitir que el rol alumno autentique una cuenta de supervisor.
      if (profile) {
        if (profile.rol !== 'alumno') {
          return response.status(401).json({ error: 'DNI o contraseña incorrectos.' });
        }
        const { password_hash: _passwordHash, ...user } = profile;
        return response.status(200).json({ data: createAuthResponse(user) });
      }

      // Si NO existe, consultamos UNHEVAL y lo creamos
      try {
        const studentRecord = await lookupUniversityStudent(dni);
        const tempPasswordHash = await hashPassword(dni); // DNI como contraseña temporal
        const authUserId = generateAuthUserId();

        const newUserRows = await sql`
          INSERT INTO perfiles (
            auth_user_id, dni, rol, nombre, facultad, carrera, telefono,
            correo_institucional, correo_preferido, origen_datos, password_hash
          )
          VALUES (
            ${authUserId}::uuid, ${dni}, 'alumno', ${studentRecord.nombre},
            ${studentRecord.facultad}, ${studentRecord.carrera}, ${studentRecord.telefono || null},
            ${studentRecord.correo_institucional}, 'institucional', 'api', ${tempPasswordHash}
          )
          RETURNING
            id, auth_user_id::text AS auth_user_id, dni, rol, nombre, facultad, carrera,
            telefono, correo_institucional, correo_personal, correo_preferido, origen_datos,
            created_at::text AS created_at, avatar_url, requiere_cambio_password, telefono_confirmado
        `;

        const newUser = newUserRows[0];
        return response.status(200).json({ data: createAuthResponse(newUser) });

      } catch (error) {
        if (error instanceof StudentLookupError) {
          const message = error.status === 404
            ? 'Alumno no encontrado en la UNHEVAL. Regístrate manualmente.'
            : error.message;
          return response.status(error.status).json({ error: message });
        }
        throw error;
      }
    }

    // ==========================================
    // FLUJO 2: SUPERVISORES (Login normal)
    // ==========================================
    if (!profile || profile.rol !== 'supervisor') {
      return response.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }
    if (!profile.password_hash) {
      console.error('Login rejected: password_hash is missing for the requested profile.');
      return response.status(500).json({ error: 'La cuenta no tiene una contraseña configurada.' });
    }

    let passwordMatches;
    try {
      passwordMatches = await verifyPassword(password ?? '', profile.password_hash);
    } catch (error) {
      console.error('Password verification failed:', error);
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

router.post('/recuperar-password-supervisor', authRateLimit('recover-supervisor-password'), async (request, response, next) => {
  const parsed = passwordRecoverySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'El DNI o el código de recuperación no tienen un formato válido.' });
    return;
  }

  try {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const authUserId = generateAuthUserId();
    const rows = await sql`
      WITH consumed AS (
        DELETE FROM public.codigos_recuperacion_supervisor AS recovery
        USING public.perfiles AS profile
        WHERE recovery.perfil_id = profile.id
          AND profile.dni = ${parsed.data.dni}
          AND profile.rol = 'supervisor'
          AND recovery.codigo_hash = ${hashRecoveryCode(parsed.data.codigo_recuperacion)}
        RETURNING recovery.perfil_id
      )
      UPDATE public.perfiles AS profile
      SET
        password_hash = ${passwordHash},
        requiere_cambio_password = true,
        auth_user_id = ${authUserId}::uuid
      FROM consumed
      WHERE profile.id = consumed.perfil_id
        AND profile.rol = 'supervisor'
      RETURNING profile.id
    `;

    if (!rows[0]) {
      response.status(400).json({ error: 'El DNI o el código de recuperación no son válidos o el código ya fue utilizado.' });
      return;
    }

    response.json({ data: { temporary_password: temporaryPassword } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/codigos-recuperacion-supervisor',
  authenticate,
  requireRole('supervisor'),
  requirePasswordChangeComplete,
  authRateLimit('issue-supervisor-recovery-codes'),
  async (request, response, next) => {
    const parsed = recoveryCodesSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Ingresa tu contraseña actual.' });
      return;
    }

    try {
      const profiles = await sql`
        SELECT password_hash
        FROM public.perfiles
        WHERE id = ${request.auth.id}
          AND rol = 'supervisor'
        LIMIT 1
      `;
      const profile = profiles[0];
      if (!profile?.password_hash || !(await verifyPassword(parsed.data.current_password, profile.password_hash))) {
        response.status(401).json({ error: 'La contraseña actual no es válida.' });
        return;
      }

      const recoveryCodes = generateRecoveryCodes();
      const recoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
      const rows = await sql`
        WITH supervisor AS (
          SELECT id
          FROM public.perfiles
          WHERE id = ${request.auth.id}
            AND rol = 'supervisor'
        ),
        cleared AS (
          DELETE FROM public.codigos_recuperacion_supervisor
          WHERE perfil_id IN (SELECT id FROM supervisor)
          RETURNING perfil_id
        ),
        cleared_count AS (
          SELECT COUNT(*) AS count FROM cleared
        ),
        inserted AS (
          INSERT INTO public.codigos_recuperacion_supervisor (perfil_id, codigo_hash)
          SELECT supervisor.id, candidate.codigo_hash
          FROM supervisor
          CROSS JOIN cleared_count
          CROSS JOIN unnest(${recoveryCodeHashes}::text[]) AS candidate(codigo_hash)
          RETURNING id
        )
        SELECT COUNT(*)::integer AS code_count FROM inserted
      `;

      if (rows[0]?.code_count !== recoveryCodes.length) {
        throw new Error('Recovery code storage did not save all generated codes.');
      }
      response.json({ data: { recovery_codes: recoveryCodes } });
    } catch (error) {
      next(error);
    }
  },
);

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
