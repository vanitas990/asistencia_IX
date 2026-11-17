import assert from 'node:assert/strict';
import test from 'node:test';

import {
  lookupUniversityStudent,
  StudentLookupError,
  updateUniversityStudentPhone,
} from '../utils/estudiantes.js';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.UNHEVAL_API_URL;
const originalApiKey = process.env.UNHEVAL_API_KEY;
const apiBaseUrl = 'https://university.example/api/datos/';

function setApiEnvironment() {
  process.env.UNHEVAL_API_URL = apiBaseUrl;
  process.env.UNHEVAL_API_KEY = 'test-api-key';
}

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.UNHEVAL_API_URL;
  else process.env.UNHEVAL_API_URL = originalUrl;
  if (originalApiKey === undefined) delete process.env.UNHEVAL_API_KEY;
  else process.env.UNHEVAL_API_KEY = originalApiKey;
}

function studentResponse(overrides = {}) {
  return {
    ok: true,
    data: [{
      nombres: 'ACOSTA JIMENEZ RUSBEL OSCAR',
      nro_doc: '76683028',
      escuela_priorizada: 'Ingeniería Agronómica',
      correo_institucional: '76683028@unheval.edu.pe',
      telefono: null,
      tipo_persona: { tipo: 'Estudiante' },
      estudiante: { escuela: { id_facultad: 4 } },
      ...overrides,
    }],
  };
}

test('fails with 503 when the university API URL is absent', async () => {
  delete process.env.UNHEVAL_API_URL;

  try {
    await assert.rejects(
      () => lookupUniversityStudent('12345678'),
      (error) => {
        assert.equal(error instanceof StudentLookupError, true);
        assert.equal(error.status, 503);
        assert.equal(error.message, 'El servicio de UNHEVAL no está disponible.');
        return true;
      },
    );
  } finally {
    restoreEnvironment();
  }
});

test('maps the university student and resolves the faculty using the API key', async () => {
  setApiEnvironment();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url) === `${apiBaseUrl}personas?dni=76683028`) {
      return new Response(JSON.stringify(studentResponse()), { status: 200 });
    }
    return new Response(JSON.stringify({
      ok: true,
      data: [{ id_facultad: 4, nombre: 'Facultad de Ciencias Agrarias' }],
    }), { status: 200 });
  };

  try {
    assert.deepEqual(await lookupUniversityStudent('76683028'), {
      nombre: 'ACOSTA JIMENEZ RUSBEL OSCAR',
      dni: '76683028',
      carrera: 'Ingeniería Agronómica',
      facultad: 'Facultad de Ciencias Agrarias',
      correo_institucional: '76683028@unheval.edu.pe',
      telefono: null,
    });
    assert.deepEqual(requests.map(({ url }) => url), [
      `${apiBaseUrl}personas?dni=76683028`,
      'https://university.example/api/datos/facultades',
    ]);
    assert.ok(requests.every(({ options }) => options.headers['X-API-Key'] === 'test-api-key'));
  } finally {
    restoreEnvironment();
  }
});

test('maps institutional email aliases and phone returned by the university API', async () => {
  setApiEnvironment();
  globalThis.fetch = async (url) => {
    if (String(url).includes('/personas?')) {
      return new Response(JSON.stringify(studentResponse({
        correo_institucional: undefined,
        email_institucional: 'alumno@unheval.edu.pe',
        telefono: '987654321',
      })), { status: 200 });
    }
    return new Response(JSON.stringify({
      ok: true,
      data: [{ id_facultad: 4, nombre: 'Facultad de Ciencias Agrarias' }],
    }), { status: 200 });
  };

  try {
    const result = await lookupUniversityStudent('76683028');
    assert.equal(result.correo_institucional, 'alumno@unheval.edu.pe');
    assert.equal(result.telefono, '987654321');
  } finally {
    restoreEnvironment();
  }
});

test('updates the student phone using the expected UNHEVAL POST payload and API key', async () => {
  setApiEnvironment();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(null, { status: 204 });
  };

  try {
    await updateUniversityStudentPhone({
      dni: '76683028',
      nombre: 'Alumno de Prueba',
      correo: 'alumno@unheval.edu.pe',
      telefono: '987654321',
    });
    assert.equal(request.url, `${apiBaseUrl}personas`);
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['X-API-Key'], 'test-api-key');
    assert.equal(request.options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(request.options.body), {
      nro_doc: '76683028',
      nombres: 'Alumno de Prueba',
      correo: 'alumno@unheval.edu.pe',
      telefono: '987654321',
    });
  } finally {
    restoreEnvironment();
  }
});

test('rejects a failed university phone update', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(null, { status: 500 });

  try {
    await assert.rejects(
      updateUniversityStudentPhone({
        dni: '76683028',
        nombre: 'Alumno de Prueba',
        correo: 'alumno@unheval.edu.pe',
        telefono: '987654321',
      }),
      (error) => error instanceof StudentLookupError && error.status === 502,
    );
  } finally {
    restoreEnvironment();
  }
});

test('rejects a university phone update marked unsuccessful in the response body', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 200 });

  try {
    await assert.rejects(
      updateUniversityStudentPhone({
        dni: '76683028',
        nombre: 'Alumno de Prueba',
        correo: 'alumno@unheval.edu.pe',
        telefono: '987654321',
      }),
      (error) => error instanceof StudentLookupError && error.status === 502,
    );
  } finally {
    restoreEnvironment();
  }
});

test('accepts the university person type Estudiante case-insensitively', async () => {
  setApiEnvironment();
  globalThis.fetch = async (url) => {
    if (String(url).includes('/personas?')) {
      return new Response(JSON.stringify(studentResponse({
        tipo_persona: { tipo: 'ESTUDIANTE' },
      })), { status: 200 });
    }
    return new Response(JSON.stringify({
      ok: true,
      data: [{ id_facultad: 4, nombre: 'Facultad de Ciencias Agrarias' }],
    }), { status: 200 });
  };

  try {
    const result = await lookupUniversityStudent('76683028');
    assert.equal(result.nombre, 'ACOSTA JIMENEZ RUSBEL OSCAR');
  } finally {
    restoreEnvironment();
  }
});

test('returns 404 when the university API has no matching student', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });

  try {
    await assert.rejects(
      lookupUniversityStudent('76683028'),
      (error) => error instanceof StudentLookupError
        && error.status === 404
        && error.message === 'Alumno no encontrado.',
    );
  } finally {
    restoreEnvironment();
  }
});

test('rejects a DNI that belongs to a non-student person', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(JSON.stringify(studentResponse({
    tipo_persona: { tipo: 'Docente' },
  })), { status: 200 });

  try {
    await assert.rejects(
      lookupUniversityStudent('76683028'),
      (error) => error instanceof StudentLookupError
        && error.status === 400
        && error.message === 'El DNI ingresado pertenece a un docente, no a un alumno.',
    );
  } finally {
    restoreEnvironment();
  }
});

test('returns 404 for an upstream not-found response', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(null, { status: 404 });

  try {
    await assert.rejects(
      lookupUniversityStudent('76683028'),
      (error) => error instanceof StudentLookupError && error.status === 404,
    );
  } finally {
    restoreEnvironment();
  }
});

test('redacts the DNI from university connection error logs', async () => {
  setApiEnvironment();
  const originalError = console.error;
  const diagnostics = [];
  console.error = (...values) => diagnostics.push(values);
  globalThis.fetch = async () => {
    throw new Error('connection failed for DNI 76683028');
  };

  try {
    await assert.rejects(
      lookupUniversityStudent('76683028'),
      (error) => error instanceof StudentLookupError
        && error.status === 503
        && error.message === 'El servicio de UNHEVAL no está disponible.',
    );
    assert.ok(diagnostics.some(([label, message]) => (
      label === 'Error real de conexión a UNHEVAL:'
      && message === 'connection failed for DNI [REDACTED_DNI]'
    )));
  } finally {
    console.error = originalError;
    restoreEnvironment();
  }
});
