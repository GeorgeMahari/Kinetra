/**
 * Ages 14-15: sign-up asks for a parent's email, the app then shows only the waiting screen, and
 * it unlocks once the parent has agreed. Uses the real route tree and providers.
 */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { tokenStorage } from '@/features/auth/tokenStorage';
import i18n from '@/i18n';

jest.mock('@/features/auth/tokenStorage', () => {
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
const TOKENS = { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 };
const year = new Date().getFullYear();

let consent: 'not_required' | 'pending' | 'granted' = 'pending';
let registered: Record<string, unknown> | null = null;

const me = () => ({
  id: 'u1',
  email: 'teen@example.com',
  email_verified: false,
  preferred_locale: 'en',
  created_at: '2026-11-13T10:00:00Z',
  parental_consent: consent,
  profile: { display_name: null, date_of_birth: `${year - 15}-01-01`, age: 15, sex_for_norms: null, height_cm: null },
});

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response);
}

function api(url: string, init?: RequestInit): Promise<Response> {
  const path = url.replace(/^.*\/api\/v1/, '');
  const method = init?.method ?? 'GET';
  if (path === '/health/ready') return json({ status: 'ok', database: 'ok', version: '0.1.0' });
  if (method === 'POST' && path === '/auth/register') {
    registered = JSON.parse(String(init?.body));
    return json(TOKENS, 201);
  }
  if (method === 'POST' && (path === '/auth/login' || path === '/auth/refresh')) return json(TOKENS);
  if (path === '/me') return json(me());
  if (path === '/me/parental-consent') {
    return json({
      status: consent,
      parent_email_masked: 'p***@example.com',
      expires_at: '2026-11-20T10:00:00Z',
      can_resend_at: '2000-01-01T00:00:00Z',
    });
  }
  // Locked account: the API refuses everything else, like the real one.
  if (consent === 'pending') return json({ error: { code: 'parental_consent_pending' } }, 403);
  if (path === '/onboarding') return json({ status: 'completed', step: 0, draft: {}, completed_at: '2026-11-13T10:00:00Z' });
  if (path === '/onboarding/summary') return json({ completed_at: null, goals: [], readiness: null, priorities: [], rules_version: 'x' });
  if (path === '/dashboard' || path === '/progression') return json({ error: { code: 'internal_error' } }, 500);
  return json({ error: { code: 'not_found' } }, 404);
}

beforeEach(async () => {
  consent = 'pending';
  registered = null;
  globalThis.fetch = jest.fn(api) as unknown as typeof fetch;
  await tokenStorage.clear().catch(() => undefined);
  return i18n.changeLanguage('en');
});

async function fillSignUp(birthYear: number) {
  await fireEvent.changeText(await screen.findByTestId('email'), 'teen@example.com');
  await fireEvent.changeText(screen.getByTestId('password'), 'blue tram over the river');
  await fireEvent.changeText(screen.getByTestId('dob-day'), '1');
  await fireEvent.changeText(screen.getByTestId('dob-month'), '1');
  await fireEvent.changeText(screen.getByTestId('dob-year'), String(birthYear));
}

it('a 15-year-old must give a parent email, then sees only the waiting screen', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/sign-up' });
  await fillSignUp(year - 15);
  expect(await screen.findByTestId('parent-email')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('consent'));

  await fireEvent.changeText(screen.getByTestId('parent-email'), 'teen@example.com');
  await fireEvent.press(screen.getByTestId('submit'));
  expect(await screen.findByText('Use your parent’s email, not your own.')).toBeTruthy();
  expect(registered).toBeNull();

  await fireEvent.changeText(screen.getByTestId('parent-email'), 'parent@example.com');
  await fireEvent.press(screen.getByTestId('submit'));
  await waitFor(() => expect(screen).toHavePathname('/parental-consent'));
  expect(registered).toMatchObject({ parent_email: 'parent@example.com' });
  expect(await screen.findByTestId('consent-body')).toHaveTextContent(/p\*\*\*@example\.com/);
  expect(screen.queryByText(/Unmatched Route/i)).toBeNull();
});

it('an adult sign-up never asks for or sends a parent email', async () => {
  consent = 'not_required';
  await renderRouter(APP_DIR, { initialUrl: '/sign-up' });
  await fillSignUp(year - 30);
  expect(screen.queryByTestId('parent-email')).toBeNull();
  await fireEvent.press(screen.getByTestId('consent'));
  await fireEvent.press(screen.getByTestId('submit'));
  await waitFor(() => expect(screen).toHavePathname('/today'));
  expect(registered && 'parent_email' in registered).toBe(false);
});

it('opens the waiting screen on launch, and unlocks the app after the parent agrees', async () => {
  await tokenStorage.set('r');
  await renderRouter(APP_DIR, { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/parental-consent'));

  await fireEvent.press(await screen.findByTestId('consent-check'));
  expect(await screen.findByTestId('consent-message')).toHaveTextContent(/hasn’t agreed/);

  consent = 'granted'; // the parent clicked "agree" in their browser
  await fireEvent.press(screen.getByTestId('consent-check'));
  await waitFor(() => expect(screen).toHavePathname('/today'));
});
