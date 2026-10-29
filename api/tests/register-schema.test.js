import assert from 'node:assert/strict';
import test from 'node:test';

import { registerSchema } from '../schemas/auth.js';

const validSupervisor = {
  dni: '12345678',
  nombre: 'Nestor Armas',
  carrera: 'Sistemas',
  rol: 'supervisor',
  password: 'secure-pass-123',
};

test('accepts supervisor registration without faculty', () => {
  assert.equal(registerSchema.safeParse(validSupervisor).success, true);
});

test('accepts supervisor registration with a single full-name field', () => {
  const result = registerSchema.safeParse({
    dni: '87654321',
    password: 'MiPasswordSeguro123',
    rol: 'supervisor',
    nombre: 'Ingeniero Prueba',
    carrera: 'Especialidad de Prueba',
  });

  assert.equal(result.success, true);
});

test('accepts nullable optional supervisor faculty', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    facultad: null,
  }).success, true);
});

test('rejects split name fields from the previous registration contract', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    nombres: 'Nestor',
    apellidos: 'Armas',
  }).success, false);
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
