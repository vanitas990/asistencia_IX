import { z } from 'zod';

const normalizedRegisterSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  nombre: z.string().trim().min(1).max(150),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150),
  rol: z.enum(['supervisor', 'alumno']),
  password: z.string().min(6).max(128),
}).strict();

export const registerSchema = normalizedRegisterSchema;
