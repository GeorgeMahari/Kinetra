import '@/i18n';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { ThemeTiles } from '../settings/ThemeTiles';

beforeEach(async () => {
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
});

describe('ThemeTiles', () => {
  it('starts on Automatic and saves the tile that is pressed', async () => {
    await render(
      <ThemeProvider>
        <ThemeTiles />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-system')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByTestId('theme-dark')).toHaveProp('accessibilityState', { selected: false });

    await fireEvent.press(screen.getByTestId('theme-dark'));
    expect(screen.getByTestId('theme-dark')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByTestId('theme-system')).toHaveProp('accessibilityState', { selected: false });
    await waitFor(async () => expect(await AsyncStorage.getItem('kinetra.pref.theme')).toBe('dark'));
  });

  it('names each tile for screen readers', async () => {
    await render(
      <ThemeProvider>
        <ThemeTiles />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radio', { name: 'Light appearance' })).toBeTruthy();
  });
});
