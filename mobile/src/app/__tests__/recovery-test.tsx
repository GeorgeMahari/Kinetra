/** Forgot-password and verify-email flows, on the real route tree with a mocked API. */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { tokenStorage } from '@/auth/tokenStorage';
import i18n from '@/i18n';

jest.mock('@/auth/tokenStorage', () => {
  let value: string | null = null;
  return {
    tokenStorage: {
      get: async () => value,
      set: async (v: string) => {
        value = v;
      },
      clear: async () => {
        value = null;
      },
    },
  };
});

const APP_DIR = './src/app';
let verified = false;
const calls: { method: string; path: string; body?: unknown }[] = [];

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response);
}

function api(url: string, init?: RequestInit): Promise<Response> {
  const path = url.replace(/^.*\/api\/v1/, '');
  const method = init?.method ?? 'GET';
  calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (path === '/health/ready') return json({ status: 'ok', database: 'ok', version: '0.1.0' });
  if (path === '/auth/password/forgot') return json(null, 202);
  if (path === '/auth/password/reset') {
    const b = JSON.parse(String(init?.body));
    return b.code === '123456' ? json(null, 204) : json({ error: { code: 'invalid_code' } }, 400);
  }
  if (path === '/auth/refresh') return json({ access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 });
  if (path === '/auth/email/verify/confirm') {
    verified = true;
    return json(null, 204);
  }
  if (path === '/me') {
    return json({
      id: 'u1', email: 'ana@example.com', email_verified: verified, preferred_locale: 'en',
      created_at: '2026-11-12T10:00:00Z',
      profile: { display_name: 'Ana', date_of_birth: '1995-06-15', age: 31, sex_for_norms: 'not_specified', height_cm: 170 },
    });
  }
  if (path === '/onboarding') return json({ status: 'completed', step: 0, draft: {}, completed_at: '2026-11-12T10:00:00Z' });
  return json({ error: { code: 'not_found' } }, 404);
}

beforeEach(async () => {
  calls.length = 0;
  verified = false;
  globalThis.fetch = jest.fn(api) as unknown as typeof fetch;
  await tokenStorage.clear();
  return i18n.changeLanguage('en');
});

it('resets a forgotten password with the emailed code', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/sign-in' });
  await fireEvent.press(await screen.findByTestId('forgot-link'));
  await waitFor(() => expect(screen).toHavePathname('/forgot-password'));

  await fireEvent.changeText(screen.getByTestId('forgot-email'), 'ana@example.com');
  await fireEvent.press(screen.getByTestId('forgot-send'));
  expect(await screen.findByText(/If ana@example.com has an account, a code is on its way/)).toBeTruthy();

  // Client-side checks before calling the server.
  await fireEvent.changeText(screen.getByTestId('forgot-code'), '12a');
  await fireEvent.changeText(screen.getByTestId('forgot-password'), 'short');
  await fireEvent.press(screen.getByTestId('forgot-reset'));
  expect(screen.getByText('Enter the 6 digits from the email.')).toBeTruthy();
  expect(calls.some((c) => c.path === '/auth/password/reset')).toBe(false);

  // A wrong code shows the localized server error.
  await fireEvent.changeText(screen.getByTestId('forgot-code'), '999999');
  await fireEvent.changeText(screen.getByTestId('forgot-password'), 'green kite above the hill');
  await fireEvent.press(screen.getByTestId('forgot-reset'));
  expect(await screen.findByText(/That code is wrong or has expired/)).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('forgot-code'), '123456');
  await fireEvent.press(screen.getByTestId('forgot-reset'));
  expect(await screen.findByTestId('forgot-done')).toBeTruthy();

  const reset = calls.filter((c) => c.path === '/auth/password/reset').pop();
  expect(reset?.body).toEqual({ email: 'ana@example.com', code: '123456', new_password: 'green kite above the hill' });
});

it('verifies the email from Account & data', async () => {
  await tokenStorage.set('r');
  await renderRouter(APP_DIR, { initialUrl: '/settings' });
  expect(await screen.findByText('Email not verified')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('verify-open'));
  await waitFor(() => expect(screen).toHavePathname('/verify-email'));

  expect(screen.getByTestId('verify-submit')).toBeDisabled();
  await fireEvent.changeText(screen.getByTestId('verify-code'), '12 34-56');
  await fireEvent.press(screen.getByTestId('verify-submit'));

  await waitFor(() => expect(screen).toHavePathname('/settings'));
  expect(await screen.findByText(/ana@example.com · Verified/)).toBeTruthy();
  expect(screen.queryByText('Email not verified')).toBeNull();
  expect(calls.find((c) => c.path === '/auth/email/verify/confirm')?.body).toEqual({ code: '123456' });
});
