import type { TFunction } from 'i18next';

import en from '@/i18n/locales/en';

import { ApiError } from './client';

type ErrorCode = keyof typeof en.errors;

function isKnownCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(en.errors, code);
}

/** Localized, user-facing message for any thrown error. Never shows raw server text. */
export function errorMessage(t: TFunction, err: unknown): string {
  const code = err instanceof ApiError && isKnownCode(err.code) ? err.code : 'unknown';
  return t(`errors.${code}`);
}
