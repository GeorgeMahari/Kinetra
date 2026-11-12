import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import i18n from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { OfflineBanner } from '../OfflineBanner';
import { EmptyState, ErrorState, LoadingState } from '../States';

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const themed = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider scheme="light">{ui}</ThemeProvider>
  </SafeAreaProvider>
);

beforeEach(() => i18n.changeLanguage('en'));

describe('OfflineBanner', () => {
  it.each(['checking', 'online'] as const)('is hidden when %s', async (state) => {
    await render(themed(<OfflineBanner state={state} onRetry={jest.fn()} />));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('explains the outage and retries', async () => {
    const onRetry = jest.fn();
    await render(themed(<OfflineBanner state="offline" onRetry={onRetry} />));
    expect(screen.getByText(/Changes can’t be saved right now/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('distinguishes a database outage', async () => {
    await render(themed(<OfflineBanner state="degraded" onRetry={jest.fn()} />));
    expect(screen.getByText('Server is up, but its database is unavailable')).toBeTruthy();
  });
});

describe('state components', () => {
  it('ErrorState shows a localized message, never the raw server text', async () => {
    await i18n.changeLanguage('ru');
    const onRetry = jest.fn();
    await render(themed(<ErrorState error={new ApiError('network_error', 'ECONNREFUSED', null)} onRetry={onRetry} />));
    expect(screen.getByText('Нет соединения. Проверьте интернет и повторите попытку.')).toBeTruthy();
    expect(screen.queryByText('ECONNREFUSED')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('ErrorState falls back to a generic message for unknown errors', async () => {
    await render(themed(<ErrorState error={new Error('boom')} />));
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
  });

  it('EmptyState renders its action', async () => {
    const onPress = jest.fn();
    await render(themed(<EmptyState title="Nothing yet" body="Body" action={{ label: 'Start', onPress }} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('LoadingState has a default label', async () => {
    await render(themed(<LoadingState />));
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});
