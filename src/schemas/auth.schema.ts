import { z } from 'zod';

export const registerSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
  nombre: z.string().trim().min(1, 'Ingresa tu nombre.').max(100, 'El nombre es demasiado largo.'),
  apellido: z.string().trim().min(1, 'Ingresa tu apellido.').max(100, 'El apellido es demasiado largo.'),
  facultad: z
    .string()
    .trim()
    .min(1, 'Ingresa tu facultad.')
    .max(150, 'El nombre de la facultad es demasiado largo.'),
  carrera: z
    .string()
    .trim()
    .min(1, 'Ingresa tu carrera.')
    .max(150, 'El nombre de la carrera es demasiado largo.'),
  ciclo: z.string().trim().min(1, 'Ingresa tu ciclo.').max(30, 'El ciclo es demasiado largo.'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
  rol: z.enum(['supervisor', 'alumno']),
});

export const loginSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
});

export const perfilSchema = z.object({
  id: z.number().int().positive(),
  auth_user_id: z.string().uuid(),
  dni: z.string().regex(/^\d{8}$/),
  rol: z.enum(['supervisor', 'alumno']),
  nombre: z.string(),
  apellido: z.string(),
  facultad: z.string(),
  carrera: z.string(),
  ciclo: z.string(),
  created_at: z.string(),
  avatar_url: z.string().nullable().default(null),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
