/**
 * Regression: after signing in (or launching with a saved session) the app landed on "/" — a
 * signed-out-only route — and showed "Unmatched Route". Uses the real route tree and providers.
 */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { tokenStorage } from '@/auth/tokenStorage';
import i18n from '@/i18n';

// jest-expo's SecureStore mock doesn't persist values; use an in-memory store with the same API.
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

const ME = {
  id: 'u1',
  email: 'ana@example.com',
  preferred_locale: 'en',
  created_at: '2026-11-12T10:00:00Z',
  profile: { display_name: 'Ana', date_of_birth: '1995-06-15', age: 31, sex_for_norms: 'not_specified', height_cm: null },
};
const TOKENS = { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 };

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response);
}

/** Minimal API: enough for sign-in and for the signed-in home screen to render. */
function api(url: string, init?: RequestInit): Promise<Response> {
  const path = url.replace(/^.*\/api\/v1/, '');
  const method = init?.method ?? 'GET';
  if (path === '/health/ready') return json({ status: 'ok', database: 'ok', version: '0.1.0' });
  if (method === 'POST' && (path === '/auth/login' || path === '/auth/refresh')) return json(TOKENS);
  if (path === '/me') return json(ME);
  if (path === '/onboarding') return json({ status: 'completed', step: 0, draft: {}, completed_at: '2026-11-12T10:00:00Z' });
  if (path === '/onboarding/summary') return json({ completed_at: null, goals: [], readiness: null, priorities: [], rules_version: 'x' });
  if (path === '/dashboard' || path === '/progression') return json({ error: { code: 'internal_error' } }, 500);
  return json({ error: { code: 'not_found' } }, 404);
}

beforeEach(async () => {
  globalThis.fetch = jest.fn(api) as unknown as typeof fetch;
  await tokenStorage.clear().catch(() => undefined);
  return i18n.changeLanguage('en');
});

it('signing in lands on Today, not on an unmatched route', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/sign-in' });
  await fireEvent.changeText(await screen.findByTestId('email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByTestId('password'), 'blue tram over the river');
  await fireEvent.press(screen.getByTestId('submit'));

  await waitFor(() => expect(screen).toHavePathname('/today'));
  expect(screen.queryByText(/Unmatched Route/i)).toBeNull();
  expect(await screen.findByTestId('greeting')).toHaveTextContent('Hello, Ana');
});

it('launching at "/" with a saved session opens Today', async () => {
  await tokenStorage.set('r');
  await renderRouter(APP_DIR, { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/today'));
  expect(screen.queryByText(/Unmatched Route/i)).toBeNull();
});

it('launching at "/" without a session opens the welcome screen', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/' });
  expect(await screen.findByText('Understand what your body can do')).toBeTruthy();
  expect(screen).toHavePathname('/welcome');
});

it('signing out lands on the welcome screen, not on an unmatched route', async () => {
  await tokenStorage.set('r');
  await renderRouter(APP_DIR, { initialUrl: '/settings' });
  await fireEvent.press(await screen.findByTestId('sign-out'));
  await waitFor(() => expect(screen).toHavePathname('/welcome'));
  expect(screen.queryByText(/Unmatched Route/i)).toBeNull();
  expect(await tokenStorage.get()).toBeNull();
});
