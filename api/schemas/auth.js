import { z } from 'zod';

const normalizedRegisterSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  nombre: z.string().trim().min(1).max(150),
  facultad: z.string().trim().min(1).max(150).nullable().optional(),
  carrera: z.string().trim().min(1).max(150).nullable().optional(),
  rol: z.enum(['supervisor', 'alumno']),
  password: z.string().min(6).max(128),
  correo_institucional: z.string().trim().email().max(254).nullable().optional(),
  correo_personal: z.string().trim().email().max(254).nullable().optional(),
  correo_preferido: z.enum(['institucional', 'personal']).default('institucional'),
  origen_datos: z.enum(['api', 'manual']).default('manual'),
  telefono: z.string().trim().min(7).max(20).nullable().optional(),
}).strict();

export const registerSchema = normalizedRegisterSchema.superRefine((data, context) => {
  if (data.rol === 'supervisor' && data.origen_datos !== 'manual') {
    context.addIssue({ code: 'custom', path: ['origen_datos'], message: 'El supervisor debe registrarse manualmente.' });
  }
  if (data.rol === 'alumno' && data.origen_datos === 'manual') {
    if (!data.facultad?.trim()) {
      context.addIssue({ code: 'custom', path: ['facultad'], message: 'Ingresa la facultad.' });
    }
    if (!data.correo_institucional && !data.correo_personal) {
      context.addIssue({
        code: 'custom',
        path: ['correo_personal'],
        message: 'Ingresa al menos un correo electrónico.',
      });
    }
    if (data.correo_preferido === 'institucional' && !data.correo_institucional) {
      context.addIssue({
        code: 'custom',
        path: ['correo_preferido'],
        message: 'El correo institucional preferido es requerido.',
      });
    }
    if (data.correo_preferido === 'personal' && !data.correo_personal) {
      context.addIssue({
        code: 'custom',
        path: ['correo_preferido'],
        message: 'El correo personal preferido es requerido.',
      });
    }
  }
  if (data.rol === 'supervisor' && !data.correo_personal) {
    context.addIssue({
      code: 'custom',
      path: ['correo_personal'],
      message: 'Ingresa un correo de contacto.',
    });
  }
});
