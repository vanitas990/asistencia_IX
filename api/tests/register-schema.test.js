import assert from 'node:assert/strict';
import test from 'node:test';

import { registerSchema } from '../schemas/auth.js';

const validSupervisor = {
  dni: '12345678',
  nombre: 'Nestor',
  apellido: 'Armas',
  carrera: 'Sistemas',
  rol: 'supervisor',
  password: 'secure-pass-123',
};

test('accepts supervisor registration without faculty or cycle', () => {
  assert.equal(registerSchema.safeParse(validSupervisor).success, true);
});

test('accepts nullable optional supervisor faculty and cycle', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    facultad: null,
    ciclo: null,
  }).success, true);
});

test('rejects supervisor registration without a career or specialization', () => {
  assert.equal(registerSchema.safeParse({ ...validSupervisor, carrera: '' }).success, false);
});

test('rejects unknown fields from the legacy registration payload', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    institucion: 'Universidad',
  }).success, false);
});
