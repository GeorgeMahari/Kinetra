/** Level, weekly objectives + check-in, personal bests and achievements on the Progress tab. */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import Achievements from '../(app)/achievements';
import ProgressTab from '../(app)/(tabs)/progress';
import Today from '../(app)/(tabs)/today';

const routes = { progress: ProgressTab, achievements: Achievements, today: Today, assess: () => null };

beforeEach(() => i18n.changeLanguage('en'));

it('shows level, points to next level and the point rules', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/progress', wrapper: providers(backend.request) });
  expect(await screen.findByText('Level 1')).toBeTruthy();
  expect(screen.getByTestId('level-points')).toHaveTextContent('10 points · 20 to level 2');
  expect(screen.getByText(/never from comparison with other people/)).toBeTruthy();
});

it('logs the week and updates objectives with exactly what was entered', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/progress', wrapper: providers(backend.request) });
  await screen.findByTestId('week-card');
  expect(screen.getByTestId('objective-active_sessions')).toHaveTextContent(/0 of 3/);
  expect(screen.getByTestId('checkin-save')).toBeDisabled(); // nothing entered yet: no silent zero

  for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByTestId('checkin-sessions-inc'));
  await fireEvent.press(screen.getByTestId('checkin-strength-inc'));
  await fireEvent.press(screen.getByTestId('checkin-save'));

  await waitFor(() => expect(screen.getByText('Week saved.')).toBeTruthy());
  const put = backend.calls.find((c) => c.method === 'PUT');
  expect(put?.body).toEqual({ sessions: 3, strength_sessions: 1, active_minutes: null });
  await waitFor(() => expect(screen.getByTestId('objective-active_sessions')).toHaveTextContent(/Done/));
});

it('lists personal bests and achievements, earned first', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  backend.seedResult(20);
  backend.seedResult(26);
  await renderRouter(routes, { initialUrl: '/progress', wrapper: providers(backend.request) });
  expect(await screen.findByTestId('pb-pushup_reps')).toHaveTextContent(/26 reps/);
  expect(screen.getByTestId('pb-pushup_reps')).toHaveTextContent(/On toes/);

  await fireEvent.press(screen.getByRole('button', { name: 'All achievements' }));
  await waitFor(() => expect(screen).toHavePathname('/achievements'));
  const order = screen.getAllByTestId(/^achievement-/).map((n) => n.props.testID);
  expect(order).toEqual(['achievement-first_assessment', 'achievement-profile_set_up', 'achievement-full_spectrum']);
  expect(screen.getByTestId('achievement-full_spectrum')).toHaveTextContent(/Not yet/);
});

it('Today shows this week’s objectives and links to Progress', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/today', wrapper: providers(backend.request) });
  await fireEvent.press(await screen.findByTestId('today-week'));
  await waitFor(() => expect(screen).toHavePathname('/progress'));
});
