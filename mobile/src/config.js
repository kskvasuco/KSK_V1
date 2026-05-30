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

  // Fallback to production Render server instead of local server
  return "https://ksk-v1.onrender.com";
}

export const API_BASE = getDefaultBase();
