import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3000;

function isLoopbackUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return /(?:localhost|127\.0\.0\.1|\[::1\])/i.test(value);
  }
}

function getMetroHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    throw new Error('No se pudo determinar la dirección del equipo desde Expo (hostUri).');
  }

  try {
    const url = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    return hostname.includes(':') ? `[${hostname}]` : hostname;
  } catch {
    throw new Error(`La dirección del equipo proporcionada por Expo no es válida: ${hostUri}`);
  }
}

export function getApiUrl() {
  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}/api`;
  }

  if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_USE_ADB_REVERSE === 'true') {
    return `http://localhost:${API_PORT}/api`;
  }

  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!__DEV__ && configuredApiUrl && !isLoopbackUrl(configuredApiUrl)) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  return `http://${getMetroHost()}:${API_PORT}/api`;
}
