import { z } from 'zod';

import { perfilSchema } from '@/schemas/auth.schema';
import { ApiRequestError } from '@/services/auth-api';
import type { User } from '@/types';

export type EditableProfile = Pick<User, 'nombre' | 'apellido' | 'carrera'>
  & Partial<Pick<User, 'facultad' | 'ciclo'>>;

async function parseProfileResponse(response: Response, fallbackMessage: string): Promise<User> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    console.error('La respuesta de actualización de perfil no es JSON válido.', error);
    throw new Error('La API devolvió una respuesta no válida.');
  }

  if (!response.ok) {
    const errorResult = z.object({ error: z.string() }).safeParse(body);
    throw new ApiRequestError(
      errorResult.success ? errorResult.data.error : fallbackMessage,
      response.status,
    );
  }

  const result = z.object({ data: perfilSchema }).safeParse(body);
  if (!result.success) {
    console.error('La respuesta del perfil actualizado no coincide con el esquema.', {
      issues: result.error.issues.map(({ path, code, message }) => ({ path, code, message })),
    });
    throw new Error('La API devolvió datos de perfil no válidos.');
  }
  return result.data.data;
}

export async function updateProfileAvatar(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  avatarUrl: string,
): Promise<User> {
  const response = await apiFetch('/api/perfiles/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar_url: avatarUrl }),
  });

  return parseProfileResponse(response, 'No se pudo actualizar la foto de perfil.');
}

export async function updateProfile(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  profile: EditableProfile,
): Promise<User> {
  const response = await apiFetch('/api/perfiles/editar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return parseProfileResponse(response, 'No se pudo actualizar el perfil.');
}
