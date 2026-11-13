/** Full onboarding journey against the in-memory backend: answers, saves, adaptive questions, completion. */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { READINESS_QUESTIONS } from '@/api/onboarding';
import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import Onboarding from '../(app)/onboarding';

const routes = { index: () => null, '(tabs)/today': () => <Text>Today stub</Text>, onboarding: Onboarding };

beforeEach(() => i18n.changeLanguage('en'));

async function next() {
  await fireEvent.press(screen.getByTestId('onboarding-next'));
}

it('walks through every step and sends a complete, honest payload', async () => {
  const backend = createFakeBackend();
  await renderRouter(routes, { initialUrl: '/onboarding', wrapper: providers(backend.request) });

  expect(await screen.findByText('Let’s get to know you')).toBeTruthy();
  await next();

  // Goals: continue is disabled until one is chosen.
  expect(await screen.findByText('What would you like to focus on?')).toBeTruthy();
  expect(screen.getByTestId('onboarding-next')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('goal-get_stronger'));
  await next();

  // Activity.
  expect(await screen.findByText('Your activity today')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('level-moderate'));
  await fireEvent.press(screen.getByTestId('sessions-inc'));
  await fireEvent.press(screen.getByTestId('sessions-inc'));
  await fireEvent.press(screen.getByTestId('experience-one_to_three_years'));
  expect(screen.getByTestId('sessions-value')).toHaveTextContent('2');
  await next();

  // Sports: choose cycling.
  expect(await screen.findByText('Sports and activities')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('sport-cycling'));
  await next();

  // Adaptive follow-ups come from the server, with the reason shown.
  expect(await screen.findByText(/Your sports say little about strength/)).toBeTruthy();
  // An explicit zero: + then −.
  await fireEvent.press(screen.getByTestId('fu-strength_sessions_per_week-inc'));
  await fireEvent.press(screen.getByTestId('fu-strength_sessions_per_week-dec'));
  // Sleep left unanswered on purpose.
  await next();

  // Readiness: must answer all seven.
  expect(await screen.findByText('Safety check')).toBeTruthy();
  expect(screen.getByTestId('onboarding-next')).toBeDisabled();
  for (const q of READINESS_QUESTIONS) await fireEvent.press(screen.getByTestId(`ready-${q}-no`));
  await next();

  expect(await screen.findByText('Your starting point')).toBeTruthy();
  expect(screen.getByTestId('readiness-title')).toHaveTextContent('Maximal-effort tests can be suggested');

  // Each step was saved for resuming.
  const saves = backend.calls.filter((c) => c.path === '/onboarding/draft').map((c) => (c.body as { step: number }).step);
  expect(saves).toEqual([1, 2, 3, 4, 5]);

  const followUpCall = backend.calls.find((c) => c.path === '/onboarding/follow-up-questions');
  expect(followUpCall?.body).toEqual({
    activity: {
      activity_level: 'moderate',
      exercise_sessions_per_week: 2,
      typical_session_minutes: null,
      training_experience: 'one_to_three_years',
      sports: [{ code: 'cycling', sessions_per_week: 1 }],
    },
  });

  const complete = backend.calls.find((c) => c.path === '/onboarding/complete');
  expect(complete?.body).toEqual({
    goals: ['get_stronger'],
    activity: {
      activity_level: 'moderate',
      exercise_sessions_per_week: 2,
      typical_session_minutes: null,
      training_experience: 'one_to_three_years',
      sports: [{ code: 'cycling', sessions_per_week: 1 }],
    },
    // Only what was answered: unanswered sleep is absent, not zero.
    follow_ups: { strength_sessions_per_week: 0 },
    readiness: Object.fromEntries(READINESS_QUESTIONS.map((q) => [q, false])),
  });

  // Done lands on the main page, wherever onboarding was opened from.
  await fireEvent.press(screen.getByTestId('onboarding-done'));
  await waitFor(() => expect(screen).toHavePathname('/today'));
});

it('resumes saved progress at the right step', async () => {
  const backend = createFakeBackend({
    status: 'in_progress',
    step: 3,
    draft: {
      goals: ['improve_balance'],
      activity: { activity_level: 'light', exercise_sessions_per_week: 1, training_experience: 'none' },
    },
  });
  await renderRouter(routes, { initialUrl: '/onboarding', wrapper: providers(backend.request) });
  expect(await screen.findByText('Sports and activities')).toBeTruthy();
});

it('save-and-exit stores progress and leaves', async () => {
  const backend = createFakeBackend();
  await renderRouter(routes, { initialUrl: '/onboarding', wrapper: providers(backend.request) });
  await screen.findByText('Let’s get to know you');
  await next();
  await screen.findByText('What would you like to focus on?');
  await fireEvent.press(screen.getByTestId('goal-improve_mobility'));
  await fireEvent.press(screen.getByTestId('onboarding-save-exit'));
  await waitFor(() => expect(backend.getStatus().draft).toEqual({ goals: ['improve_mobility'] }));
  expect(backend.getStatus().step).toBe(1);
});
