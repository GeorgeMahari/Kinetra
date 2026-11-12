/**
 * Device-level preferences (not account data): appearance, and the language chosen before
 * signing in. Stored with AsyncStorage. Every access is guarded: storage can be unavailable
 * (private browsing, quota), and the app must work the same without it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'kinetra.pref.theme';
const LANGUAGE_KEY = 'kinetra.pref.language';

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Preference simply isn't remembered.
  }
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const v = await read(THEME_KEY);
  return isThemePreference(v) ? v : 'system';
}

export const saveThemePreference = (p: ThemePreference) => write(THEME_KEY, p);

export const loadDeviceLanguage = () => read(LANGUAGE_KEY);
export const saveDeviceLanguage = (lang: string) => write(LANGUAGE_KEY, lang);
