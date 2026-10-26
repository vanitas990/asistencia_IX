import { createHash } from 'node:crypto';

import { sql } from '../db.js';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

export function authRateLimit(action) {
  return async (request, response, next) => {
    try {
      console.log(`Rate limit: checking ${action} request...`);
      const ipHash = createHash('sha256').update(request.ip ?? 'unknown').digest('hex');
      const rateLimitKey = `auth:${action}:${ipHash}`;
      const rows = await sql`
        INSERT INTO rate_limits (clave, contador, ventana_inicio)
        VALUES (${rateLimitKey}, 1, now())
        ON CONFLICT (clave) DO UPDATE SET
          contador = CASE
            WHEN rate_limits.ventana_inicio <= now() - interval '15 minutes' THEN 1
            ELSE rate_limits.contador + 1
          END,
          ventana_inicio = CASE
            WHEN rate_limits.ventana_inicio <= now() - interval '15 minutes' THEN now()
            ELSE rate_limits.ventana_inicio
          END
        RETURNING contador
      `;

      if (!rows[0] || !Number.isInteger(rows[0].contador)) {
        throw new Error('Rate limit query did not return a valid counter.');
      }

      if (rows[0].contador > MAX_ATTEMPTS) {
        console.log(`Rate limit: rejecting ${action} request.`);
        return response.status(429).json({
          error: `Demasiados intentos. Vuelve a intentarlo en ${WINDOW_MINUTES} minutos.`,
        });
      }

      console.log(`Rate limit: ${action} request allowed.`);
      return next();
    } catch (error) {
      console.error('Rate limit check failed:', {
        action,
        name: error?.name ?? 'UnknownError',
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        detail: error?.detail,
      });
      return next(error);
    }
  };
}
