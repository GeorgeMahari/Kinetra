import type { TFunction } from 'i18next';

import en from '@/i18n/locales/en';
import ro from '@/i18n/locales/ro';
import ru from '@/i18n/locales/ru';

import { ApiError } from '../client';
import { errorMessage } from '../errorMessage';

const t = ((key: string) => key) as unknown as TFunction;

it('names the email outage instead of a generic error', () => {
  const err = new ApiError('email_unavailable', 'Email is not available right now.', 503);
  expect(errorMessage(t, err)).toBe('errors.email_unavailable');
});

it('has the email outage message in every language', () => {
  for (const locale of [en, ro, ru]) {
    expect(locale.errors.email_unavailable.length).toBeGreaterThan(20);
  }
});
