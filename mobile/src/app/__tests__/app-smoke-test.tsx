/**
 * Loads the real route tree (src/app) with the real root layout and providers.
 * Catches route-configuration errors (conflicting URLs, wrong group names, broken guards)
 * that only show up at runtime.
 */
import '@/i18n';

import { screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import i18n from '@/i18n';

// Resolved by Jest relative to the project root (mobile/).
const APP_DIR = './src/app';

beforeEach(() => {
  // No stored session and an unreachable server.
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  return i18n.changeLanguage('en');
});

it('boots signed out on the welcome screen, with sign-up disabled while the server is unreachable', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/' });
  expect(await screen.findByText('Understand what your body can do')).toBeTruthy();
  // The readiness check retries once (~1 s) before reporting offline.
  await waitFor(() => expect(screen.getByText('Can’t reach the Kinetra server')).toBeTruthy(), { timeout: 5000 });
  expect(screen.getByTestId('get-started')).toBeDisabled();
});

it('keeps signed-in screens unreachable without a session', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/today' });
  expect(await screen.findByText('Understand what your body can do')).toBeTruthy();
  expect(screen.queryByText('Your physical profile')).toBeNull();
});
