import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import { ThemeProvider } from '@/design-system/ThemeProvider';

import { ServerStatusBanner } from '../ServerStatusBanner';

async function renderBanner(state: 'checking' | 'online' | 'degraded' | 'offline', onRetry = jest.fn()) {
  await render(
    <ThemeProvider scheme="dark">
      <ServerStatusBanner state={state} onRetry={onRetry} />
    </ThemeProvider>,
  );
  return onRetry;
}

describe('ServerStatusBanner', () => {
  beforeEach(() => i18n.changeLanguage('en'));

  it('offers a retry when the server is offline', async () => {
    const onRetry = await renderBanner('offline');
    expect(screen.getByText('Can’t reach the Kinetra server')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no retry when connected', async () => {
    await renderBanner('online');
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is localized', async () => {
    await i18n.changeLanguage('ro');
    await renderBanner('offline');
    expect(screen.getByText('Serverul Kinetra nu poate fi contactat')).toBeTruthy();
  });
});
