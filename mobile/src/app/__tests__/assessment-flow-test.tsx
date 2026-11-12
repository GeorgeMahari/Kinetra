/** Assess tab → test detail → record → result, against the in-memory backend. */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import Assess from '../(app)/(tabs)/assess';
import RecordResult from '../(app)/record/[code]';
import ResultScreen from '../(app)/result/[id]';
import TestDetail from '../(app)/test/[code]';

const routes = {
  assess: Assess,
  'test/[code]': TestDetail,
  'record/[code]': RecordResult,
  'result/[id]': ResultScreen,
};

beforeEach(() => i18n.changeLanguage('en'));

it('lists tests by dimension, with locked tests explained', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/assess', wrapper: providers(backend.request) });
  expect(await screen.findByText('Assessments')).toBeTruthy();
  expect(screen.getByTestId('test-cooper_12min')).toHaveTextContent(/Not suggested after your safety check/);
  expect(screen.getByTestId('test-pushups')).toHaveTextContent(/Suggested/);
});

it('records a result and shows it with provenance and no invented rating', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/assess', wrapper: providers(backend.request) });
  await fireEvent.press(await screen.findByTestId('test-pushups'));

  expect(await screen.findByText('How to do it')).toBeTruthy();
  expect(screen.getByTestId('safety-text')).toHaveTextContent(/don’t hold your breath/);
  expect(await screen.findByText('No results yet for this test.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('enter-result'));

  // Validation before sending.
  await fireEvent.press(await screen.findByTestId('save-result'));
  expect(screen.getAllByText('Required.').length).toBeGreaterThanOrEqual(1);
  expect(backend.calls.some((c) => c.method === 'POST')).toBe(false);

  await fireEvent.press(screen.getByRole('radio', { name: 'On toes' }));
  await fireEvent.changeText(screen.getByTestId('field-reps'), '27');
  await fireEvent.press(screen.getByTestId('save-result'));

  await waitFor(() => expect(screen).toHavePathname('/result/r1'));
  expect(await screen.findByTestId('value-pushup_reps')).toHaveTextContent('27 reps');
  expect(screen.getByTestId('provenance-measured')).toBeTruthy();
  expect(screen.getByTestId('no-comparison')).toBeTruthy();

  const post = backend.calls.find((c) => c.method === 'POST' && c.path === '/assessments/results');
  expect(post?.body).toEqual({ test_code: 'pushups', inputs: { variant: 'toes', reps: 27 }, stopped_early: false });
});

it('locked tests offer no way to record a result', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/test/cooper_12min', wrapper: providers(backend.request) });
  expect(await screen.findByText('How to do it')).toBeTruthy();
  expect(screen.queryByTestId('enter-result')).toBeNull();
  expect(screen.getByText('Not suggested after your safety check')).toBeTruthy();
});
