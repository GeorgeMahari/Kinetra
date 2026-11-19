/** Assess tab → test detail → record → result, against the in-memory backend. */
import '@/i18n';

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import Assess from '../(app)/(tabs)/assess';
import RecordResult from '../(app)/record/[code]';
import ResultScreen from '../(app)/result/[id]';
import TestDetail from '../(app)/test/[code]';

const routes = {
  '(tabs)/today': () => <Text>Today stub</Text>,
  '(tabs)/assess': Assess,
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

it('opens on one dimension when asked (profile map key)', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/assess?dimension=muscularEndurance', wrapper: providers(backend.request) });
  expect(await screen.findByTestId('test-pushups')).toBeTruthy();
  expect(screen.getByTestId('assess-filter-muscularEndurance')).toBeChecked();
  expect(screen.queryByTestId('test-cooper_12min')).toBeNull();
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

async function enterPushups(backend: ReturnType<typeof createFakeBackend>, reps: string) {
  await renderRouter(routes, { initialUrl: '/record/pushups', wrapper: providers(backend.request) });
  await fireEvent.press(await screen.findByRole('radio', { name: 'On toes' }));
  await fireEvent.changeText(screen.getByTestId('field-reps'), reps);
}

const posts = (backend: ReturnType<typeof createFakeBackend>) =>
  backend.calls.filter((c) => c.method === 'POST' && c.path === '/assessments/results');

it('a save that reached the server but timed out is not saved twice when retried', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  backend.timeoutNextSaves(1);
  await enterPushups(backend, '27');
  await fireEvent.press(screen.getByTestId('save-result'));
  // The answer never arrived: the screen says so and stays on the form.
  await waitFor(() => expect(posts(backend)).toHaveLength(1));
  expect(screen).toHavePathname('/record/pushups');

  await fireEvent.press(screen.getByTestId('save-result'));
  await waitFor(() => expect(screen).toHavePathname('/result/r1'));
  expect(backend.resultCount()).toBe(1);
  const [first, retry] = posts(backend);
  expect(first?.headers?.['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  expect(retry?.headers?.['Idempotency-Key']).toBe(first?.headers?.['Idempotency-Key']);
});

it('changed values after a failed save are a new measurement, with a new key', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  backend.timeoutNextSaves(1);
  await enterPushups(backend, '27');
  await fireEvent.press(screen.getByTestId('save-result'));
  await waitFor(() => expect(posts(backend)).toHaveLength(1));
  await fireEvent.changeText(screen.getByTestId('field-reps'), '28');
  await fireEvent.press(screen.getByTestId('save-result'));
  await waitFor(() => expect(screen).toHavePathname('/result/r2'));
  const [first, second] = posts(backend);
  expect(second?.headers?.['Idempotency-Key']).not.toBe(first?.headers?.['Idempotency-Key']);
});

it('locked tests offer no way to record a result', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/test/cooper_12min', wrapper: providers(backend.request) });
  expect(await screen.findByText('How to do it')).toBeTruthy();
  expect(screen.queryByTestId('enter-result')).toBeNull();
  expect(screen.getByText('Not suggested after your safety check')).toBeTruthy();
});

async function recordPushups(backend: ReturnType<typeof createFakeBackend>) {
  await renderRouter(routes, { initialUrl: '/test/pushups', wrapper: providers(backend.request) });
  await fireEvent.press(await screen.findByTestId('enter-result'));
  await fireEvent.press(await screen.findByRole('radio', { name: 'On toes' }));
  await fireEvent.changeText(screen.getByTestId('field-reps'), '27');
  await fireEvent.press(screen.getByTestId('save-result'));
  await waitFor(() => expect(screen).toHavePathname('/result/r1'));
  expect(await screen.findByTestId('value-pushup_reps')).toHaveTextContent('27 reps');
}

describe('after saving a result', () => {
  it('offers the next suggested test', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    await recordPushups(backend);
    expect(await screen.findByTestId('next-test')).toHaveTextContent('Next test: Single-leg stance');
    await fireEvent.press(screen.getByTestId('next-test'));
    await waitFor(() => expect(screen).toHavePathname('/test/single_leg_stance'));
    // Back from the next test goes home, not to the previous result or test.
    await act(() => router.back());
    await waitFor(() => expect(screen).toHavePathname('/today'));
  });

  it('goes back to the main page', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    await recordPushups(backend);
    await fireEvent.press(await screen.findByTestId('back-home'));
    await waitFor(() => expect(screen).toHavePathname('/today'));
    expect(screen.getByText('Today stub')).toBeTruthy();
  });

  it('offers only the way home when no other test is recommended', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setRecommendations([
      { code: 'retest_pushups', kind: 'retest', priority: 90, dimension: 'muscularEndurance', test_code: 'pushups',
        params: {}, reasons: [], reference: null, general_guidance: true },
    ]);
    await recordPushups(backend);
    expect(await screen.findByTestId('back-home')).toBeTruthy();
    await waitFor(() => expect(backend.calls.some((c) => c.path === '/dashboard')).toBe(true));
    expect(screen.queryByTestId('next-test')).toBeNull();
  });

  it('a result opened from history has no after-save buttons', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.seedResult(20);
    await renderRouter(routes, { initialUrl: '/result/r1', wrapper: providers(backend.request) });
    expect(await screen.findByTestId('value-pushup_reps')).toHaveTextContent('20 reps');
    expect(screen.queryByTestId('back-home')).toBeNull();
    expect(screen.queryByTestId('next-test')).toBeNull();
  });
});
