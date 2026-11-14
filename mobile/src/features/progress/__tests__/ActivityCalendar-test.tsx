import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import { ActivityCalendar } from '../ActivityCalendar';

beforeEach(() => i18n.changeLanguage('en'));

// The fake backend's pushup results are recorded on 12 November 2026 (12:00 UTC).
const NOW = new Date(2026, 10, 14, 10, 0);

describe('ActivityCalendar', () => {
  it('marks the days with saved results and lists them on tap', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.seedResult(20);
    backend.seedResult(22);
    const Wrapper = providers(backend.request);
    await render(
      <Wrapper>
        <ActivityCalendar now={NOW} />
      </Wrapper>,
    );
    expect(await screen.findByText('Days with data: 1')).toBeTruthy();
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(/November 2026/i);
    const marked = screen.getByTestId('calendar-day-2026-11-12');
    expect(marked).toHaveProp('accessibilityLabel', expect.stringContaining('results saved: 2'));
    expect(screen.getByTestId('calendar-day-2026-11-13')).toHaveProp('accessibilityLabel', expect.stringContaining('no data'));

    await fireEvent.press(marked);
    expect(screen.getByTestId('calendar-day-details')).toHaveTextContent(/× 2/);
  });

  it('pages back a month, but not past the current one', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    const Wrapper = providers(backend.request);
    await render(
      <Wrapper>
        <ActivityCalendar now={NOW} />
      </Wrapper>,
    );
    expect(screen.getByTestId('calendar-next')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('calendar-prev'));
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(/October 2026/i);
    expect(await screen.findByText('Days with data: 0')).toBeTruthy();
    expect(screen.getByTestId('calendar-next')).toBeEnabled();
  });
});
