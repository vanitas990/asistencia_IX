import { z } from 'zod';

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
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 500);
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
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
    }
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
  }

  if (response.status === 404) {
    return { response, body: null };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
    }
  }

  return { response, body };
}

async function lookupFacultyName(baseUrl, apiKey, facultyId, signal) {
  const result = await fetchJson(endpointUrl(baseUrl, 'facultades'), apiKey, signal);

  if (!result.response.ok || !result.body) {
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
  }

  const facultyRows = z.object({
    data: z.array(facultySchema),
  }).passthrough().safeParse(result.body);
  if (!facultyRows.success) {
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
  }

  const faculty = facultyRows.data.data.find((row) => row.id_facultad === facultyId);
  if (!faculty) {
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
  }
  return faculty.nombre;
}

export async function lookupUniversityStudent(dni) {
  const externalApiUrl = process.env.UNHEVAL_API_URL?.trim();
  if (!externalApiUrl) {
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
  }

  const apiKey = process.env.UNHEVAL_API_KEY?.trim();
  if (!apiKey) {
    throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 500);
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
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
    }

    const studentRows = z.object({
      ok: z.boolean(),
      data: z.array(z.unknown()),
    }).passthrough().safeParse(studentResult.body);
    if (!studentRows.success) {
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
    }
    if (!studentRows.data.ok) {
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
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
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
    }
    if (parsedStudent.data.nro_doc !== dni) {
      throw new StudentLookupError('El servicio de UNHEVAL no está disponible.', 503);
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
