import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { loadDeviceLanguage, saveDeviceLanguage } from '@/theme/preferences';

import en from './locales/en';
import ro from './locales/ro';
import ru from './locales/ru';

export const SUPPORTED_LANGUAGES = ['en', 'ro', 'ru'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ro: 'Română',
  ru: 'Русский',
};

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** First device language we support, otherwise English (the product default). */
export function detectDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isSupportedLanguage(locale.languageCode)) return locale.languageCode;
  }
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ro: { translation: ro }, ru: { translation: ru } },
  lng: detectDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/**
 * Remember the last language used on this device, so the signed-out screens open in it.
 * After sign-in the account's preferred_locale takes over (AuthProvider applies it).
 */
let persisting = false;

export async function restoreDeviceLanguage(): Promise<void> {
  const saved = await loadDeviceLanguage();
  if (isSupportedLanguage(saved) && saved !== i18n.resolvedLanguage) await i18n.changeLanguage(saved);
  if (!persisting) {
    persisting = true;
    i18n.on('languageChanged', (lng) => void saveDeviceLanguage(lng));
  }
}

export default i18n;
