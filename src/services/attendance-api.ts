import { z } from 'zod';

import { ApiRequestError } from '@/services/auth-api';

const integerSchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
]);

const attendanceSchema = z.object({
  id: integerSchema,
  alumno_id: integerSchema,
  supervisor_id: integerSchema,
  tipo: z.enum(['entrada', 'salida']),
  timestamp: z.string(),
  alumno_nombre: z.string().optional(),
  alumno_apellido: z.string().optional(),
  alumno_dni: z.string().optional(),
  supervisor_nombre: z.string().optional(),
  supervisor_apellido: z.string().optional(),
});

const markResponseSchema = z.object({
  id: integerSchema,
  alumno_id: integerSchema,
  supervisor_id: integerSchema,
  qr_token: z.string(),
  tipo: z.enum(['entrada', 'salida']),
  timestamp: z.string(),
});

export type AttendanceRecord = z.infer<typeof attendanceSchema>;
export type MarkAttendanceResult = z.infer<typeof markResponseSchema>;

async function parseApiResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    console.error('La API de asistencia devolvió JSON no válido.', error);
    throw new Error(`La API devolvió una respuesta no válida (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const parsedError = z.object({
      error: z.string(),
      message: z.string().optional(),
      timestamp: z.string().optional(),
    }).safeParse(body);
    throw new ApiRequestError(
      parsedError.success
        ? parsedError.data.message ?? parsedError.data.error
        : 'La API rechazó la solicitud.',
      response.status,
      parsedError.success ? parsedError.data.error : undefined,
      parsedError.success ? parsedError.data.timestamp : undefined,
    );
  }
  const payload = body
    && typeof body === 'object'
    && !('pagination' in body)
    && 'data' in body
    ? body.data
    : body;
  const result = schema.safeParse(payload);
  if (!result.success) {
    console.error('La respuesta de asistencia no coincide con el esquema esperado.', {
      issues: result.error.issues.map(({ path, code, message }) => ({ path, code, message })),
    });
    throw new Error('La API devolvió datos de asistencia no válidos.');
  }
  return result.data;
}

export async function markAttendance(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  qrToken: string,
) {
  const response = await apiFetch('/api/asistencias/marcar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr_token: qrToken }),
  });
  return parseApiResponse(response, markResponseSchema);
}

export async function linkByQr(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  token: string,
) {
  const response = await apiFetch('/api/vinculaciones/por-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseApiResponse(
    response,
    z.object({
      id: integerSchema,
      supervisor_id: integerSchema,
      alumno_id: integerSchema,
      estado: z.literal('activo'),
      metodo: z.literal('qr'),
      created_at: z.string().nullable().optional(),
    }),
  );
}

export async function getAttendanceHistory(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  limit = 50,
  alumnoId?: number,
) {
  const params = new URLSearchParams({ limit: String(limit), offset: '0' });
  if (alumnoId !== undefined) params.set('alumno_id', String(alumnoId));
  const response = await apiFetch(`/api/asistencias?${params.toString()}`);
  return parseApiResponse(response, z.object({
    data: z.array(attendanceSchema),
    pagination: z.object({
      limit: z.number().int(),
      offset: z.number().int(),
      hasMore: z.boolean(),
    }),
  }));
}
