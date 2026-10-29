import { z } from 'zod';

const mockStudent = {
  nombre: 'Nestor Armas',
  facultad: 'Ingeniería de Sistemas',
  carrera: 'Ingeniería de Software',
};

const universityStudentSchema = z.object({
  nombres: z.string().trim().min(1),
  nro_doc: z.string().regex(/^\d{8}$/),
  escuela_priorizada: z.string().trim().min(1),
  tipo_persona: z.object({
    tipo: z.string().trim().min(1),
  }).passthrough(),
  estudiante: z.object({
    escuela: z.object({
      id_facultad: z.coerce.number().int().positive(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

const facultySchema = z.object({
  id_facultad: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(1),
}).passthrough();

export class StudentLookupError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'StudentLookupError';
    this.status = status;
  }
}

function endpointUrl(baseUrl, path = '') {
  let url;
  try {
    url = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  } catch {
    throw new StudentLookupError('La URL de consulta universitaria no es válida.', 500);
  }

  return new URL(path, url);
}

async function fetchJson(url, apiKey, signal) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new StudentLookupError('La consulta universitaria excedió el tiempo de espera.', 504);
    }
    throw error;
  }

  if (response.status === 404) {
    return { response, body: null };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new StudentLookupError('La API universitaria devolvió una respuesta no válida.', 502);
    }
  }

  return { response, body };
}

async function lookupFacultyName(baseUrl, apiKey, facultyId, signal) {
  const fallbackName = `Facultad ${facultyId}`;
  let result;
  try {
    result = await fetchJson(endpointUrl(baseUrl, 'facultades'), apiKey, signal);
  } catch (error) {
    if (error instanceof StudentLookupError && error.status === 504) throw error;
    console.warn('No se pudo consultar el catálogo de facultades; se usará el identificador de facultad.');
    return fallbackName;
  }

  if (!result.response.ok || !result.body) {
    console.warn('La API de facultades no está disponible; se usará el identificador de facultad.', {
      status: result.response.status,
    });
    return fallbackName;
  }

  const facultyRows = z.object({
    data: z.array(facultySchema),
  }).passthrough().safeParse(result.body);
  if (!facultyRows.success) {
    console.warn('La respuesta de facultades no tiene el formato esperado; se usará el identificador de facultad.');
    return fallbackName;
  }

  const faculty = facultyRows.data.data.find((row) => row.id_facultad === facultyId);
  if (!faculty) {
    console.warn('La facultad solicitada no aparece en el catálogo universitario.', { facultyId });
    return fallbackName;
  }
  return faculty.nombre;
}

export async function lookupUniversityStudent(dni) {
  const externalApiUrl = process.env.UNHEVAL_API_URL?.trim();
  if (!externalApiUrl) {
    return mockStudent;
  }

  const apiKey = process.env.UNHEVAL_API_KEY?.trim();
  if (!apiKey) {
    throw new StudentLookupError('Falta configurar UNHEVAL_API_KEY en el entorno del servidor.', 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const studentResult = await fetchJson(
      endpointUrl(externalApiUrl, encodeURIComponent(dni)),
      apiKey,
      controller.signal,
    );
    if (studentResult.response.status === 404) {
      throw new StudentLookupError('Alumno no encontrado.', 404);
    }
    if (!studentResult.response.ok) {
      throw new StudentLookupError('No se pudo consultar el registro universitario.', 502);
    }

    const studentRows = z.object({
      ok: z.boolean(),
      data: z.array(z.unknown()),
    }).passthrough().safeParse(studentResult.body);
    if (!studentRows.success) {
      throw new StudentLookupError('La API universitaria devolvió datos no válidos.', 502);
    }

    const firstRecord = studentRows.data.data[0];
    if (!firstRecord) {
      throw new StudentLookupError('Alumno no encontrado.', 404);
    }
    if (!studentRows.data.ok) {
      throw new StudentLookupError('La API universitaria no pudo completar la consulta.', 502);
    }

    const personType = firstRecord
      && typeof firstRecord === 'object'
      && 'tipo_persona' in firstRecord
      && firstRecord.tipo_persona
      && typeof firstRecord.tipo_persona === 'object'
      && 'tipo' in firstRecord.tipo_persona
      ? firstRecord.tipo_persona.tipo
      : null;
    if (typeof personType !== 'string' || personType.trim().toLocaleLowerCase('es') !== 'estudiante') {
      throw new StudentLookupError('El DNI ingresado pertenece a un docente, no a un alumno.', 400);
    }

    const parsedStudent = universityStudentSchema.safeParse(firstRecord);
    if (!parsedStudent.success) {
      throw new StudentLookupError('La API universitaria devolvió datos no válidos.', 502);
    }
    if (parsedStudent.data.nro_doc !== dni) {
      throw new StudentLookupError('La API universitaria devolvió un DNI distinto al consultado.', 502);
    }

    const facultyId = parsedStudent.data.estudiante.escuela.id_facultad;
    const facultyName = await lookupFacultyName(
      externalApiUrl,
      apiKey,
      facultyId,
      controller.signal,
    );

    return {
      nombre: parsedStudent.data.nombres,
      dni: parsedStudent.data.nro_doc,
      carrera: parsedStudent.data.escuela_priorizada,
      facultad: facultyName,
    };
  } finally {
    clearTimeout(timeout);
  }
}
