import { z } from 'zod';

export const registerSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
  nombre: z.string().trim().min(1, 'Ingresa tu nombre completo.').max(150, 'El nombre es demasiado largo.'),
  facultad: z.string().trim().max(150, 'El nombre de la facultad es demasiado largo.').nullable().optional(),
  carrera: z
    .string()
    .trim()
    .min(1, 'Ingresa tu carrera o especialidad.')
    .max(150, 'El nombre de la carrera es demasiado largo.'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
  rol: z.enum(['supervisor', 'alumno']),
  correo_institucional: z.union([
    z.literal(''),
    z.string().trim().email('Ingresa un correo institucional válido.').max(254),
  ]).transform((value) => value === '' ? null : value).nullable().optional(),
  correo_personal: z.union([
    z.literal(''),
    z.string().trim().email('Ingresa un correo personal válido.').max(254),
  ]).transform((value) => value === '' ? null : value).nullable().optional(),
  correo_preferido: z.enum(['institucional', 'personal']).default('institucional'),
  origen_datos: z.enum(['api', 'manual']).default('manual'),
  telefono: z.string().trim().min(7).max(20).nullable().optional(),
}).superRefine((data, context) => {
  if (data.rol === 'alumno') {
    if (data.origen_datos === 'manual' && !data.facultad?.trim()) {
      context.addIssue({ code: 'custom', path: ['facultad'], message: 'Ingresa tu facultad.' });
    }
    if (
      data.origen_datos === 'manual'
      && !data.correo_institucional
      && !data.correo_personal
    ) {
      context.addIssue({ code: 'custom', path: ['correo_personal'], message: 'Ingresa al menos un correo.' });
    }
    const preferredEmail = data.correo_preferido === 'institucional'
      ? data.correo_institucional
      : data.correo_personal;
    if (data.origen_datos === 'manual' && !preferredEmail) {
      context.addIssue({ code: 'custom', path: ['correo_preferido'], message: 'Elige un correo que hayas ingresado.' });
    }
  } else {
    if (data.origen_datos !== 'manual') {
      context.addIssue({ code: 'custom', path: ['origen_datos'], message: 'El supervisor debe registrarse manualmente.' });
    }
    if (!data.correo_personal) {
      context.addIssue({ code: 'custom', path: ['correo_personal'], message: 'Ingresa un correo de contacto.' });
    }
  }
});

export const loginSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
  password: z.string().max(128, 'La contraseña no puede superar 128 caracteres.').optional(),
  rol: z.enum(['alumno', 'supervisor']),
}).superRefine((data, context) => {
  if (data.rol === 'supervisor' && !data.password) {
    context.addIssue({
      code: 'custom',
      path: ['password'],
      message: 'Ingresa tu contraseña.',
    });
  }
});

export const perfilSchema = z.object({
  id: z.number().int().positive(),
  auth_user_id: z.string().uuid(),
  dni: z.string().regex(/^\d{8}$/),
  rol: z.enum(['supervisor', 'alumno']),
  nombre: z.string(),
  facultad: z.string().nullable(),
  carrera: z.string(),
  telefono: z.string().nullable().default(null),
  correo_institucional: z.string().nullable().default(null),
  correo_personal: z.string().nullable().default(null),
  correo_preferido: z.enum(['institucional', 'personal']).default('institucional'),
  origen_datos: z.enum(['api', 'manual']).default('manual'),
  created_at: z.string(),
  avatar_url: z.string().nullable().default(null),
  telefono_confirmado: z.boolean().default(false),
  requiere_cambio_password: z.boolean().default(false),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
