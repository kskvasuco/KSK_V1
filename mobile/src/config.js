import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

/**
 * API base URL resolution — 3-tier priority:
 * 1. EXPO_PUBLIC_API_URL  — set in .env (dev) or via EAS env (build)
 * 2. app.json extra.apiUrl — hardcoded production fallback baked into the APK
 * 3. Device-type fallback — emulator loopback / localhost
 */

// Tier 1: build-time env var (works in Expo Go and EAS builds with env configured)
const envUrl = process.env.EXPO_PUBLIC_API_URL;

// Tier 2: app.json extra.apiUrl (always present in the APK, no env needed)
const extraUrl = Constants.expoConfig?.extra?.apiUrl;

function getPortFromUrl(url) {
  try {
    return new URL(url).port || '5500';
  } catch {
    const m = url.match(/:(\d+)/);
    return m ? m[1] : '5500';
  }
}

function getDefaultBase() {
  // Prefer explicit env var (development or EAS-configured build)
  if (envUrl) return envUrl.replace(/\/$/, '');

  // Use baked-in production URL from app.json (standalone APK / production build)
  if (extraUrl) return extraUrl.replace(/\/$/, '');

  const port = '5500';

  // Android emulator: host machine is always 10.0.2.2
  if (Platform.OS === 'android' && Device.isDevice === false) {
    return `http://10.0.2.2:${port}`;
  }

  if (Platform.OS === 'android') return `http://10.0.2.2:${port}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `http://localhost:${port}`;
  }

  return `http://localhost:${port}`;
}

export const API_BASE = getDefaultBase();
