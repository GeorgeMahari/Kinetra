import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import PlanTab from '../(app)/(tabs)/plan';

const routes = { plan: PlanTab, assess: () => null, achievements: () => null, 'test/[code]': () => null };

beforeEach(() => i18n.changeLanguage('en'));

it('starts a plan, ticks the day off and celebrates the finished day', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/plan', wrapper: providers(backend.request) });

  // Before a plan: the suggested focus and the health zones, attention first.
  expect(await screen.findByTestId('plan-start')).toBeTruthy();
  expect(screen.getByTestId('zone-muscularEndurance')).toHaveProp('accessibilityLabel', expect.stringContaining('Attention'));

  await fireEvent.press(screen.getByTestId('plan-start-button'));
  expect(await screen.findByTestId('plan-hero')).toBeTruthy();
  expect(screen.getByTestId('plan-today-count')).toHaveTextContent('0 of 2');
  expect(screen.getByTestId('plan-target-value')).toHaveTextContent(/2,?660/);

  await fireEvent.press(screen.getByTestId('task-check-steady_cardio'));
  await waitFor(() => expect(screen.getByTestId('plan-today-count')).toHaveTextContent('1 of 2'));
  expect(screen.getByTestId('task-check-steady_cardio')).toHaveProp('accessibilityState', { checked: true });

  await fireEvent.press(screen.getByTestId('task-check-mobility_flow'));
  expect(await screen.findByTestId('plan-celebration')).toBeTruthy();
  expect(screen.getByText('Day complete!')).toBeTruthy();
  expect(screen.getByTestId('celebration-achievement-perfect_day')).toBeTruthy();
  expect(screen.getByTestId('plan-streak')).toHaveProp('accessibilityLabel', expect.stringContaining('in a row: 1'));
});

it('keeps the evidence for the suggested focus one tap away', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/plan', wrapper: providers(backend.request) });
  expect(await screen.findByTestId('plan-start')).toBeTruthy();
  // Closed by default: the card leads with the focus and the Start button.
  expect(screen.queryByTestId('plan-why')).toBeNull();
  await fireEvent.press(screen.getByTestId('plan-why-toggle'));
  expect(await screen.findByTestId('plan-why')).toHaveTextContent(/associat/i);
});

it('opens how to do a task when its text is tapped', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  await renderRouter(routes, { initialUrl: '/plan', wrapper: providers(backend.request) });
  await fireEvent.press(await screen.findByTestId('plan-start-button'));
  await fireEvent.press(await screen.findByTestId('task-steady_cardio'));
  expect(screen.getByTestId('task-how-steady_cardio')).toHaveTextContent(/steady pace/);
});

it('two quick ticks both stick, even when the first answer arrives last', async () => {
  const backend = createFakeBackend({ status: 'completed' });
  let puts = 0;
  let answered = 0;
  // The server applies each tick at once, but the first answer travels slowly; without serialising,
  // it would land after the second and wipe that tick off the screen.
  const request = (async (path: string, options?: { method?: string }) => {
    const answer = await backend.request(path, options as never);
    if (options?.method === 'PUT') {
      puts += 1;
      await new Promise((r) => setTimeout(r, puts === 1 ? 120 : 0));
      answered += 1;
    }
    return answer;
  }) as typeof backend.request;
  await renderRouter(routes, { initialUrl: '/plan', wrapper: providers(request) });
  await fireEvent.press(await screen.findByTestId('plan-start-button'));
  await screen.findByTestId('plan-hero');

  await fireEvent.press(screen.getByTestId('task-check-steady_cardio'));
  await fireEvent.press(screen.getByTestId('task-check-mobility_flow'));
  await waitFor(() => expect(answered).toBe(2));
  await waitFor(() => expect(screen.getByTestId('plan-today-count')).toHaveTextContent('2 of 2'));
  expect(screen.getByTestId('task-check-steady_cardio')).toHaveProp('accessibilityState', { checked: true });
  expect(screen.getByTestId('task-check-mobility_flow')).toHaveProp('accessibilityState', { checked: true });
});
