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

test('accepts the exact test-api.http supervisor payload using plural name fields', () => {
  const result = registerSchema.safeParse({
    dni: '87654321',
    password: 'MiPasswordSeguro123',
    rol: 'supervisor',
    nombres: 'Ingeniero',
    apellidos: 'Prueba',
    carrera: 'Especialidad de Prueba',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.nombre, 'Ingeniero');
    assert.equal(result.data.apellido, 'Prueba');
    assert.equal('nombres' in result.data, false);
    assert.equal('apellidos' in result.data, false);
  }
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
