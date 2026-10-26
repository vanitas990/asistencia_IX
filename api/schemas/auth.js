import { z } from 'zod';

export const registerSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150),
  ciclo: z.string().trim().min(1).max(30).nullable().optional(),
  rol: z.enum(['supervisor', 'alumno']),
  password: z.string().min(6).max(128),
}).strict();
