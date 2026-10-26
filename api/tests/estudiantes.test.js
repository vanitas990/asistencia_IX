import assert from 'node:assert/strict';
import test from 'node:test';

import { lookupUniversityStudent } from '../utils/estudiantes.js';

test('returns the configured mock student when the university API URL is absent', async () => {
  const originalUrl = process.env.UNHEVAL_API_URL;
  delete process.env.UNHEVAL_API_URL;

  try {
    assert.deepEqual(await lookupUniversityStudent('12345678'), {
      nombres: 'Nestor',
      apellidos: 'Armas',
      facultad: 'Ingeniería de Sistemas',
      carrera: 'Ingeniería de Software',
      ciclo: 'V',
    });
  } finally {
    if (originalUrl === undefined) {
      delete process.env.UNHEVAL_API_URL;
    } else {
      process.env.UNHEVAL_API_URL = originalUrl;
    }
  }
});
