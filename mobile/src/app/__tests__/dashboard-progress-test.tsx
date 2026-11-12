import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import ProgressTab from '../(app)/(tabs)/progress';
import Today from '../(app)/(tabs)/today';
import ProgressDetail from '../(app)/progress/[code]';
import TestDetail from '../(app)/test/[code]';

const routes = {
  today: Today,
  progress: ProgressTab,
  'progress/[code]': ProgressDetail,
  'test/[code]': TestDetail,
  assess: () => null,
};

beforeEach(() => i18n.changeLanguage('en'));

it('Today shows the coverage map, labelled guidance and recommendations in priority order', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/today', wrapper: providers(backend.request) });
  expect(await screen.findByText('How well your profile is known')).toBeTruthy();
  expect(screen.getByTestId('profile-map-count')).toHaveTextContent(/1 of 8/);
  expect(screen.getByText('General wellness guidance — not individual medical advice.')).toBeTruthy();
  const recs = screen.getAllByTestId(/^rec-/).map((n) => n.props.testID);
  expect(recs).toEqual(['rec-assess_balance', 'rec-strength_two_days']);
  expect(screen.getByText(/Source: Bull FC, et al/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Assess: Balance & coordination' }));
  await waitFor(() => expect(screen).toHavePathname('/test/single_leg_stance'));
});

it('Progress is empty until there are results, then shows the trend', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/progress', wrapper: providers(backend.request) });
  expect(await screen.findByText('No results yet. Your progress appears here after your first assessment.')).toBeTruthy();
});

it('Progress lists tested items with latest value and change', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  backend.seedResult(20);
  backend.seedResult(24);
  await renderRouter(routes, { initialUrl: '/progress', wrapper: providers(backend.request) });
  expect(await screen.findByTestId('progress-pushups-latest')).toHaveTextContent('24 reps');
  expect(screen.getByTestId('progress-pushups-delta-prev')).toHaveTextContent('+4 vs previous');
  await fireEvent.press(screen.getByText('All indicators'));
  await waitFor(() => expect(screen).toHavePathname('/progress/pushups'));
});
