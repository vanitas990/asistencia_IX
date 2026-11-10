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
  if (!hostUri) return 'localhost';

  try {
    const url = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`);
    return url.hostname;
  } catch {
    return hostUri.split(':')[0] || 'localhost';
  }
}

export function getApiUrl() {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!__DEV__ && configuredApiUrl && !isLoopbackUrl(configuredApiUrl)) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  const host = Platform.OS === 'web' ? 'localhost' : getMetroHost();
  return `http://${host}:${API_PORT}/api`;
}
