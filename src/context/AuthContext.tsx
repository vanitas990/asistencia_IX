import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { perfilSchema } from '@/schemas/auth.schema';
import {
  ApiRequestError,
  authenticatedFetch,
  loginWithApi,
  refreshWithApi,
  registerWithApi,
  setAccessToken,
} from '@/services/auth-api';
import { updateProfile as updateProfileData, updateProfileAvatar, type EditableProfile } from '@/services/profile-api';
import type { LoginFormData, RegisterFormData } from '@/schemas/auth.schema';
import type { User } from '@/types';

const REFRESH_TOKEN_KEY = 'asistencia_refresh_token';
const USER_KEY = 'asistencia_auth_user';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  login: (credentials: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  updateProfile: (profile: EditableProfile) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readStoredValue(key: string) {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function writeStoredValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeStoredValue(key: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function userForSecureStore(user: User): User {
  return { ...user, avatar_url: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        await Promise.all([
          removeStoredValue('asistencia_mock_token'),
          removeStoredValue('asistencia_mock_user'),
          removeStoredValue('asistencia_auth_token'),
        ]);
        const [refreshToken, storedUser] = await Promise.all([
          readStoredValue(REFRESH_TOKEN_KEY),
          readStoredValue(USER_KEY),
        ]);

        if (refreshToken && storedUser) {
          let parsedValue: unknown;
          try {
            parsedValue = JSON.parse(storedUser);
          } catch {
            throw new Error('No se pudo restaurar la sesión guardada. Inicia sesión nuevamente.');
          }

          const result = perfilSchema.safeParse(parsedValue);
          if (!result.success) {
            throw new Error('La sesión guardada no es válida. Inicia sesión nuevamente.');
          }
          try {
            const refreshed = await refreshWithApi(refreshToken);
            if (isMounted) {
              setAccessToken(refreshed.accessToken);
              setUser(refreshed.user);
            }
            await writeStoredValue(USER_KEY, JSON.stringify(userForSecureStore(refreshed.user)));
          } catch (error) {
            if (error instanceof ApiRequestError && error.status === 401) {
              await Promise.allSettled([
                removeStoredValue(REFRESH_TOKEN_KEY),
                removeStoredValue(USER_KEY),
              ]);
            } else if (isMounted) {
              setUser(result.data);
            }
            throw error;
          }
        } else if (refreshToken || storedUser) {
          throw new Error('La sesión guardada está incompleta. Inicia sesión nuevamente.');
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const saveSession = useCallback(async (refreshToken: string, accessToken: string, nextUser: User) => {
    try {
      await writeStoredValue(REFRESH_TOKEN_KEY, refreshToken);
      await writeStoredValue(USER_KEY, JSON.stringify(userForSecureStore(nextUser)));
      setAccessToken(accessToken);
      setUser(nextUser);
    } catch (error) {
      await Promise.allSettled([
        removeStoredValue(REFRESH_TOKEN_KEY),
        removeStoredValue(USER_KEY),
      ]);
      setAccessToken(null);
      throw error;
    }
  }, []);

  const login = useCallback(async (credentials: LoginFormData) => {
    setAuthError(null);
    try {
      const result = await loginWithApi(credentials);
      await saveSession(result.refreshToken, result.accessToken, result.user);
    } catch (error) {
      setAuthError(getErrorMessage(error));
      throw error;
    }
  }, [saveSession]);

  const register = useCallback(async (data: RegisterFormData) => {
    setAuthError(null);
    try {
      const result = await registerWithApi(data);
      await saveSession(result.refreshToken, result.accessToken, result.user);
    } catch (error) {
      setAuthError(getErrorMessage(error));
      throw error;
    }
  }, [saveSession]);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      setAccessToken(null);
      await removeStoredValue(REFRESH_TOKEN_KEY);
      await removeStoredValue(USER_KEY);
      setUser(null);
    } catch (error) {
      setAuthError(getErrorMessage(error));
      throw error;
    }
  }, []);

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const refreshToken = await readStoredValue(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No hay un refresh token guardado. Inicia sesión nuevamente.');
    }

    return authenticatedFetch(
      path,
      init,
      refreshToken,
      async (session) => {
        await writeStoredValue(USER_KEY, JSON.stringify(userForSecureStore(session.user)));
        setUser(session.user);
      },
      async () => {
        await Promise.all([
          removeStoredValue(REFRESH_TOKEN_KEY),
          removeStoredValue(USER_KEY),
        ]);
        setUser(null);
      },
    );
  }, []);

  const updateAvatar = useCallback(async (avatarUrl: string) => {
    const updatedUser = await updateProfileAvatar(apiFetch, avatarUrl);
    await writeStoredValue(USER_KEY, JSON.stringify(userForSecureStore(updatedUser)));
    setUser(updatedUser);
  }, [apiFetch]);

  const updateProfile = useCallback(async (profile: EditableProfile) => {
    const updatedUser = await updateProfileData(apiFetch, profile);
    await writeStoredValue(USER_KEY, JSON.stringify(userForSecureStore(updatedUser)));
    setUser(updatedUser);
  }, [apiFetch]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      authError,
      login,
      logout,
      register,
      apiFetch,
      updateAvatar,
      updateProfile,
      clearAuthError,
    }),
    [user, isLoading, authError, login, logout, register, apiFetch, updateAvatar, updateProfile, clearAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider.');
  }
  return context;
}
