import assert from 'node:assert/strict';
import test from 'node:test';

import { lookupUniversityStudent, StudentLookupError } from '../utils/estudiantes.js';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.UNHEVAL_API_URL;
const originalApiKey = process.env.UNHEVAL_API_KEY;
const apiBaseUrl = 'https://university.example/api/estudiantes';

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
      tipo_persona: { tipo: 'Estudiante' },
      estudiante: { escuela: { id_facultad: 4 } },
      ...overrides,
    }],
  };
}

test('returns the configured mock student when the university API URL is absent', async () => {
  delete process.env.UNHEVAL_API_URL;

  try {
    assert.deepEqual(await lookupUniversityStudent('12345678'), {
      nombres: 'Nestor',
      apellidos: 'Armas',
      facultad: 'Ingeniería de Sistemas',
      carrera: 'Ingeniería de Software',
    });
  } finally {
    restoreEnvironment();
  }
});

test('maps the university student and resolves the faculty using the API key', async () => {
  setApiEnvironment();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url) === `${apiBaseUrl}/76683028`) {
      return new Response(JSON.stringify(studentResponse()), { status: 200 });
    }
    return new Response(JSON.stringify({
      ok: true,
      data: [{ id_facultad: 4, nombre: 'Facultad de Ciencias Agrarias' }],
    }), { status: 200 });
  };

  try {
    assert.deepEqual(await lookupUniversityStudent('76683028'), {
      nombres: 'ACOSTA JIMENEZ RUSBEL OSCAR',
      apellidos: '',
      dni: '76683028',
      carrera: 'Ingeniería Agronómica',
      facultad: 'Facultad de Ciencias Agrarias',
    });
    assert.deepEqual(requests.map(({ url }) => url), [
      `${apiBaseUrl}/76683028`,
      `${apiBaseUrl}/facultades`,
    ]);
    assert.ok(requests.every(({ options }) => options.headers['X-API-Key'] === 'test-api-key'));
  } finally {
    restoreEnvironment();
  }
});

test('returns 404 when the university API has no matching student', async () => {
  setApiEnvironment();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, data: [] }), { status: 200 });

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
