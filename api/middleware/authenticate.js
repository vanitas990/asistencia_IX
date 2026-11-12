import { sql } from '../db.js';
import { verifyAccessToken } from '../utils/auth.js';

export async function authenticate(request, response, next) {
  const authorization = request.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    response.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
    return;
  }

  try {
    const claims = verifyAccessToken(match[1]);
    if (!claims || typeof claims.sub !== 'string') {
      response.status(401).json({ error: 'La sesión no es válida. Inicia sesión nuevamente.' });
      return;
    }

    const profiles = await sql`
      SELECT id, auth_user_id::text AS auth_user_id, rol, requiere_cambio_password
      FROM perfiles
      WHERE auth_user_id = ${claims.sub}::uuid
      LIMIT 1
    `;
    const profile = profiles[0];
    if (!profile) {
      response.status(401).json({ error: 'La cuenta ya no está disponible.' });
      return;
    }

    request.auth = {
      id: profile.id,
      authUserId: profile.auth_user_id,
      role: profile.rol,
      requiresPasswordChange: profile.requiere_cambio_password,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePasswordChangeComplete(request, response, next) {
  if (request.auth?.requiresPasswordChange) {
    response.status(403).json({
      error: 'Debes cambiar tu contraseña temporal antes de continuar.',
      code: 'password_change_required',
    });
    return;
  }
  next();
}

export function requireRole(role) {
  return (request, response, next) => {
    if (request.auth?.role !== role) {
      response.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
      return;
    }
    next();
  };
}
