import { z } from 'zod';

const normalizedRegisterSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().max(100),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150),
  rol: z.enum(['supervisor', 'alumno']),
  password: z.string().min(6).max(128),
}).strict().superRefine((data, context) => {
  if (data.rol === 'supervisor' && !data.apellido) {
    context.addIssue({
      code: 'custom',
      path: ['apellido'],
      message: 'El apellido es obligatorio para supervisores.',
    });
  }
});

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
