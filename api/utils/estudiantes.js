import { z } from 'zod';

const mockStudent = {
  nombre: 'Nestor Armas',
  facultad: 'Ingeniería de Sistemas',
  carrera: 'Ingeniería de Software',
  correo_institucional: null,
  telefono: null,
};

const universityStudentSchema = z.object({
  nombres: z.string().trim().min(1),
  nro_doc: z.string().regex(/^\d{8}$/),
  escuela_priorizada: z.string().trim().min(1),
  correo_institucional: z.string().trim().email().nullable().optional(),
  email_institucional: z.string().trim().email().nullable().optional(),
  correo: z.string().trim().email().nullable().optional(),
  telefono: z.string().trim().min(7).max(20).nullable().optional(),
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

function studentLookupUrl(baseUrl, dni) {
  const url = endpointUrl(baseUrl, 'personas');
  url.searchParams.set('dni', dni);
  return url;
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
    const dni = new URL(url).searchParams.get('dni');
    const message = typeof error?.message === 'string' && dni
      ? error.message.replaceAll(dni, '[REDACTED_DNI]')
      : error?.message;
    console.error('Error real de conexión a UNHEVAL:', message);
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
      studentLookupUrl(externalApiUrl, dni),
      apiKey,
      controller.signal,
    );
    if (studentResult.response.status === 404) {
      throw new StudentLookupError('Alumno no encontrado.', 404);
    }
    if (!studentResult.response.ok) {
      const message = studentResult.response.status === 401 || studentResult.response.status === 403
        ? 'La API de UNHEVAL rechazó la clave configurada.'
        : 'No se pudo consultar el registro universitario.';
      throw new StudentLookupError(message, 502);
    }

    const studentRows = z.object({
      ok: z.boolean(),
      data: z.array(z.unknown()),
    }).passthrough().safeParse(studentResult.body);
    if (!studentRows.success) {
      throw new StudentLookupError('La API universitaria devolvió datos no válidos.', 502);
    }
    if (!studentRows.data.ok) {
      throw new StudentLookupError('La API universitaria no pudo completar la consulta.', 502);
    }
    const firstRecord = studentRows.data.data[0];
    if (!firstRecord) {
      throw new StudentLookupError('Alumno no encontrado.', 404);
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
      correo_institucional: parsedStudent.data.correo_institucional
        ?? parsedStudent.data.email_institucional
        ?? parsedStudent.data.correo
        ?? null,
      telefono: parsedStudent.data.telefono ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function updateUniversityStudentPhone({ dni, nombre, correo, telefono }) {
  const externalApiUrl = process.env.UNHEVAL_API_URL?.trim();
  if (!externalApiUrl) {
    throw new StudentLookupError('Falta configurar la URL de la API universitaria.', 500);
  }

  const apiKey = process.env.UNHEVAL_API_KEY?.trim();
  if (!apiKey) {
    throw new StudentLookupError('Falta configurar UNHEVAL_API_KEY en el entorno del servidor.', 500);
  }

  const url = endpointUrl(externalApiUrl, 'personas');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ nro_doc: dni, nombres: nombre, correo, telefono }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new StudentLookupError('La actualización universitaria excedió el tiempo de espera.', 504);
      }
      throw new StudentLookupError('No se pudo conectar con la API universitaria.', 502);
    }

    if (!response.ok) {
      console.error('UNHEVAL rechazó la actualización del teléfono.', { status: response.status });
      throw new StudentLookupError('No se pudo actualizar el teléfono en la API universitaria.', 502);
    }

    const responseText = await response.text();
    if (responseText) {
      try {
        const body = JSON.parse(responseText);
        if (body && typeof body === 'object' && 'ok' in body && body.ok === false) {
          throw new StudentLookupError('UNHEVAL no pudo actualizar el teléfono.', 502);
        }
      } catch (error) {
        if (error instanceof StudentLookupError) throw error;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
