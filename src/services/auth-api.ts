import { z } from 'zod';

import type { LoginFormData, RegisterFormData } from '@/schemas/auth.schema';
import { perfilSchema } from '@/schemas/auth.schema';

const apiResponseSchema = z.object({
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    user: perfilSchema,
    dni: z.string().regex(/^\d{8}$/),
  }),
});

const refreshResponseSchema = z.object({
  data: z.object({
    access_token: z.string().min(1),
    user: perfilSchema,
  }),
});

const apiErrorSchema = z.object({
  error: z.string().min(1),
});

export interface AuthApiResult {
  accessToken: string;
  refreshToken: string;
  user: z.infer<typeof perfilSchema>;
}

export interface RefreshedSession {
  accessToken: string;
  user: z.infer<typeof perfilSchema>;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly timestamp?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
let accessToken: string | null = null;
let refreshInProgress: Promise<RefreshedSession> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function postJson(path: string, payload: unknown): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con la API. Comprueba que el servidor esté activo y que EXPO_PUBLIC_API_URL sea accesible desde el dispositivo.',
    );
  }
}

async function throwApiError(response: Response): Promise<never> {
  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new ApiRequestError('La API devolvió una respuesta no válida.', response.status);
  }

  const errorResult = apiErrorSchema.safeParse(responseBody);
  throw new ApiRequestError(
    errorResult.success ? errorResult.data.error : 'La API rechazó la solicitud.',
    response.status,
  );
}

async function postAuthRequest(
  path: string,
  payload: LoginFormData | RegisterFormData,
): Promise<AuthApiResult> {
  const response = await postJson(path, payload);
  if (!response.ok) {
    await throwApiError(response);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error('La API devolvió una respuesta no válida.');
  }
  const result = apiResponseSchema.safeParse(responseBody);
  if (!result.success) {
    throw new Error('La API devolvió datos de autenticación no válidos.');
  }

  const data = result.data.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  };
}

export function loginWithApi(credentials: LoginFormData) {
  return postAuthRequest('login', credentials);
}

export function registerWithApi(data: RegisterFormData) {
  return postAuthRequest('register', data);
}

export async function refreshWithApi(refreshToken: string): Promise<RefreshedSession> {
  const response = await postJson('refresh', { refresh_token: refreshToken });
  if (!response.ok) {
    await throwApiError(response);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error('La API devolvió una respuesta no válida.');
  }
  const result = refreshResponseSchema.safeParse(responseBody);
  if (!result.success) {
    throw new Error('La API devolvió datos de sesión renovada no válidos.');
  }

  return {
    accessToken: result.data.data.access_token,
    user: result.data.data.user,
  };
}

export async function authenticatedFetch(
  path: string,
  init: RequestInit,
  refreshToken: string,
  onSessionRefreshed?: (session: RefreshedSession) => Promise<void>,
  onSessionExpired?: () => Promise<void>,
) {
  const requestUrl = new URL(path, `${apiBaseUrl}/`);
  if (requestUrl.origin !== new URL(apiBaseUrl).origin) {
    throw new Error('Las solicitudes autenticadas solo pueden enviarse a la API configurada.');
  }

  const sendRequest = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(requestUrl.toString(), { ...init, headers });
  };

  const response = await sendRequest(accessToken);
  if (response.status !== 401) {
    return response;
  }

  if (!refreshInProgress) {
    refreshInProgress = refreshWithApi(refreshToken)
      .then(async (session) => {
        setAccessToken(session.accessToken);
        await onSessionRefreshed?.(session);
        return session;
      })
      .finally(() => {
        refreshInProgress = null;
      });
  }

  let session: RefreshedSession;
  try {
    session = await refreshInProgress;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      setAccessToken(null);
      await onSessionExpired?.();
    }
    throw error;
  }
  return sendRequest(session.accessToken);
}
