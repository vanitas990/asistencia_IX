import assert from 'node:assert/strict';
import test from 'node:test';

import { registerSchema } from '../schemas/auth.js';

const validSupervisor = {
  dni: '12345678',
  nombre: 'Nestor Armas',
  carrera: 'Sistemas',
  rol: 'supervisor',
  password: 'secure-pass-123',
  correo_personal: 'supervisor@example.com',
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
    correo_personal: 'ingeniero@example.com',
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

test('accepts supervisor registration without a career so the API can store No aplica', () => {
  assert.equal(registerSchema.safeParse({ ...validSupervisor, carrera: '' }).success, true);
  assert.equal(registerSchema.safeParse({ ...validSupervisor, carrera: null }).success, true);
  const { carrera: _carrera, ...withoutCarrera } = validSupervisor;
  assert.equal(registerSchema.safeParse(withoutCarrera).success, true);
});

test('rejects unknown fields from the legacy registration payload', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    institucion: 'Universidad',
  }).success, false);
});

test('requires a valid email preference for manual students', () => {
  const validStudent = {
    dni: '87654321',
    nombre: 'Estudiante de Prueba',
    facultad: 'Facultad de Prueba',
    carrera: 'Carrera de Prueba',
    rol: 'alumno',
    password: 'secure-pass-123',
    origen_datos: 'manual',
    correo_institucional: 'estudiante@unheval.edu.pe',
    correo_personal: null,
    correo_preferido: 'institucional',
  };
  assert.equal(registerSchema.safeParse(validStudent).success, true);
  assert.equal(registerSchema.safeParse({
    ...validStudent,
    correo_institucional: null,
    correo_preferido: 'personal',
  }).success, false);
});

test('requires supervisor contact email and manual data origin', () => {
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    correo_personal: null,
  }).success, false);
  assert.equal(registerSchema.safeParse({
    ...validSupervisor,
    origen_datos: 'api',
  }).success, false);
});
