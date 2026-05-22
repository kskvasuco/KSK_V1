import { Platform } from 'react-native';
import * as Device from 'expo-device';

/** Override with EXPO_PUBLIC_API_URL in .env (e.g. http://192.168.1.5:5500) */
const envUrl = process.env.EXPO_PUBLIC_API_URL;

function getPortFromUrl(url) {
  try {
    return new URL(url).port || '5500';
  } catch {
    const m = url.match(/:(\d+)/);
    return m ? m[1] : '5500';
  }
}

function getDefaultBase() {
  const port = envUrl ? getPortFromUrl(envUrl) : '5500';

  // Android emulator: host machine is always 10.0.2.2 (not LAN IP)
  if (Platform.OS === 'android' && Device.isDevice === false) {
    return `http://10.0.2.2:${port}`;
  }

  if (envUrl) return envUrl.replace(/\/$/, '');

  if (Platform.OS === 'android') return `http://10.0.2.2:${port}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `http://localhost:${port}`;
  }

  return `http://localhost:${port}`;
}

export const API_BASE = getDefaultBase();
