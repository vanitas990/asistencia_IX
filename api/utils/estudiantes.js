import { z } from 'zod';

const studentSchema = z.object({
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
  facultad: z.string().trim().min(1),
  carrera: z.string().trim().min(1),
  ciclo: z.string().trim().min(1),
});

const mockStudent = {
  nombres: 'Nestor',
  apellidos: 'Armas',
  facultad: 'Ingeniería de Sistemas',
  carrera: 'Ingeniería de Software',
  ciclo: 'V',
};

export class StudentLookupError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'StudentLookupError';
    this.status = status;
  }
}

export async function lookupUniversityStudent(dni) {
  const externalApiUrl = process.env.UNHEVAL_API_URL?.trim();
  if (!externalApiUrl) {
    return mockStudent;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    let studentUrl;
    try {
      const baseUrl = new URL(externalApiUrl.endsWith('/') ? externalApiUrl : `${externalApiUrl}/`);
      studentUrl = new URL(encodeURIComponent(dni), baseUrl);
    } catch {
      throw new StudentLookupError('La URL de consulta universitaria no es válida.', 500);
    }

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(studentUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new StudentLookupError('La consulta universitaria excedió el tiempo de espera.', 504);
      }
      throw new StudentLookupError('No se pudo conectar con la API universitaria.', 502);
    }

    if (!upstreamResponse.ok) {
      throw new StudentLookupError('No se pudo consultar el registro universitario.', 502);
    }

    let responseBody;
    try {
      responseBody = await upstreamResponse.json();
    } catch {
      throw new StudentLookupError('La API universitaria devolvió una respuesta no válida.', 502);
    }

    const payload = responseBody && typeof responseBody === 'object' && 'data' in responseBody
      ? responseBody.data
      : responseBody;
    const student = studentSchema.safeParse(payload);
    if (!student.success) {
      throw new StudentLookupError('La API universitaria devolvió datos no válidos.', 502);
    }
    return student.data;
  } finally {
    clearTimeout(timeout);
  }
}
