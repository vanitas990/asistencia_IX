import { z } from 'zod';

export const registerSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresa tu nombre.').max(100, 'El nombre es demasiado largo.'),
  apellido: z.string().trim().min(1, 'Ingresa tu apellido.').max(100, 'El apellido es demasiado largo.'),
  curso_carrera: z
    .string()
    .trim()
    .min(1, 'Ingresa tu curso o carrera.')
    .max(150, 'El curso o carrera es demasiado largo.'),
  institucion: z
    .string()
    .trim()
    .min(1, 'Ingresa tu institución.')
    .max(150, 'La institución es demasiado larga.'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
  rol: z.enum(['supervisor', 'practicante']),
});

export const loginSchema = z.object({
  codigo_6: z.string().regex(/^\d{6}$/, 'El código debe tener exactamente 6 dígitos.'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
});

export const perfilSchema = z.object({
  id: z.number().int().positive(),
  auth_user_id: z.string().uuid(),
  codigo_6: z.string().regex(/^\d{6}$/),
  rol: z.enum(['supervisor', 'practicante']),
  nombre: z.string(),
  apellido: z.string(),
  curso_carrera: z.string(),
  institucion: z.string(),
  created_at: z.string(),
  avatar_url: z.string().nullable().default(null),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
