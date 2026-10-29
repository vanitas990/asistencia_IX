import { z } from 'zod';

const studentSchema = z.object({
  nombres: z.string().trim().min(1),
  apellidos: z.string(),
  facultad: z.string().trim().min(1),
  carrera: z.string().trim().min(1),
});

export type StudentRecord = z.infer<typeof studentSchema>;

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export async function consultStudentByDni(dni: string): Promise<StudentRecord> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/estudiantes/consultar/${encodeURIComponent(dni)}`);
  } catch {
    throw new Error('No se pudo conectar con el servicio de consulta de estudiantes.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('El servicio de consulta devolvió una respuesta no válida.');
  }

  if (!response.ok) {
    const errorResult = z.object({ error: z.string().min(1) }).safeParse(body);
    throw new Error(errorResult.success
      ? errorResult.data.error
      : 'No se pudo consultar el registro universitario.');
  }

  const result = studentSchema.safeParse(body);
  if (!result.success) {
    throw new Error('El servicio devolvió datos de estudiante no válidos.');
  }
  return result.data;
}
