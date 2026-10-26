import { z } from 'zod';

import { ApiRequestError } from '@/services/auth-api';

const positiveIntegerSchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
]);

const linkedProfileSchema = z.object({
  vinculacion_id: positiveIntegerSchema,
  id: positiveIntegerSchema,
  nombre: z.string(),
  apellido: z.string(),
  dni: z.string().regex(/^\d{8}$/),
  facultad: z.string().nullable(),
  carrera: z.string(),
  ciclo: z.string().nullable(),
});

const pendingRequestSchema = z.object({
  id: positiveIntegerSchema,
  supervisor_id: positiveIntegerSchema,
  alumno_id: positiveIntegerSchema,
  estado: z.literal('pendiente'),
  metodo: z.enum(['id', 'qr']),
  created_at: z.string().nullable().optional(),
  supervisor_nombre: z.string(),
  supervisor_apellido: z.string(),
  supervisor_facultad: z.string().nullable(),
});

const qrSchema = z.object({
  token: z.string().min(1),
  activo: z.boolean(),
});

export type LinkedProfile = z.infer<typeof linkedProfileSchema>;
export type PendingRequest = z.infer<typeof pendingRequestSchema>;

async function requestData<T>(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch (parseError) {
    console.error('La API de vinculaciones no devolvió JSON válido.', {
      path,
      status: response.status,
      contentType: response.headers.get('content-type'),
      error: parseError,
    });
    throw new Error(`La API devolvió una respuesta no válida (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const errorResult = z.object({ error: z.string() }).safeParse(body);
    throw new ApiRequestError(
      errorResult.success ? errorResult.data.error : 'La API rechazó la solicitud.',
      response.status,
    );
  }

  const payload = body && typeof body === 'object' && !Array.isArray(body) && 'data' in body
    ? body.data
    : body;
  const result = schema.safeParse(payload);
  if (!result.success) {
    console.error('La respuesta de la API no coincide con el esquema esperado.', {
      path,
      issues: result.error.issues.map(({ path: issuePath, code, message }) => ({
        path: issuePath,
        code,
        message,
      })),
      responseKeys: body && typeof body === 'object' && !Array.isArray(body)
        ? Object.keys(body)
        : Array.isArray(body) ? ['array'] : [typeof body],
    });
    throw new Error(`La API devolvió datos no válidos para ${path}.`);
  }
  return result.data;
}

export function getActiveLinks(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/vinculaciones/activas', z.array(linkedProfileSchema));
}

export function getPendingRequests(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/vinculaciones/pendientes', z.array(pendingRequestSchema));
}

export function requestLink(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  dni: string,
) {
  return requestData(
    apiFetch,
    '/api/vinculaciones/solicitar',
    z.object({
      id: positiveIntegerSchema,
      supervisor_id: positiveIntegerSchema,
      alumno_id: positiveIntegerSchema,
      estado: z.literal('pendiente'),
      metodo: z.literal('id'),
      created_at: z.string(),
    }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni_alumno: dni }),
    },
  );
}

export function acceptLink(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  vinculationId: number,
) {
  return requestData(
    apiFetch,
    '/api/vinculaciones/aceptar',
    z.object({
      id: positiveIntegerSchema,
      supervisor_id: positiveIntegerSchema,
      alumno_id: positiveIntegerSchema,
      estado: z.literal('activo'),
      metodo: z.enum(['id', 'qr']),
      created_at: z.string(),
    }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vinculacion_id: vinculationId }),
    },
  );
}

export function unlinkProfile(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  vinculationId: number,
) {
  return requestData(
    apiFetch,
    `/api/vinculaciones/${vinculationId}`,
    z.object({
      id: positiveIntegerSchema,
      deleted: z.literal(true),
    }),
    { method: 'DELETE' },
  );
}

export function generateQr(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/qr/generar', qrSchema, { method: 'POST' });
}

export function regenerateQr(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/qr/regenerar', qrSchema, { method: 'POST' });
}

export function getOwnQr(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/qr/mi-qr', qrSchema);
}

export function getAlumnoQr(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return requestData(apiFetch, '/api/qr/mi-qr-alumno', qrSchema);
}
