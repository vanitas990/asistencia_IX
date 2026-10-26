import { z } from 'zod';

const normalizedRegisterSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150),
  ciclo: z.string().trim().min(1).max(30).nullable().optional(),
  rol: z.enum(['supervisor', 'alumno']),
  password: z.string().min(6).max(128),
}).strict();

export const registerSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

  const fields = { ...input };
  if (!Object.hasOwn(fields, 'nombre') && Object.hasOwn(fields, 'nombres')) {
    fields.nombre = fields.nombres;
    delete fields.nombres;
  }
  if (!Object.hasOwn(fields, 'apellido') && Object.hasOwn(fields, 'apellidos')) {
    fields.apellido = fields.apellidos;
    delete fields.apellidos;
  }
  return fields;
}, normalizedRegisterSchema);
