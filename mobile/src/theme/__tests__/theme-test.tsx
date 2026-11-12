import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { loadThemePreference } from '../preferences';
import { resolveScheme, ThemeProvider, useTheme, type Theme } from '../ThemeProvider';

describe('resolveScheme', () => {
  it.each([
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
    ['system', 'light', 'light'],
    ['system', 'dark', 'dark'],
    ['system', null, 'dark'],
  ] as const)('preference %s with system %s -> %s', (pref, system, expected) => {
    expect(resolveScheme(pref, system)).toBe(expected);
  });
});

describe('theme preference persistence', () => {
  beforeEach(() => AsyncStorage.clear());

  it('falls back to system for missing or corrupt values', async () => {
    expect(await loadThemePreference()).toBe('system');
    await AsyncStorage.setItem('kinetra.pref.theme', 'purple');
    expect(await loadThemePreference()).toBe('system');
  });

  it('restores the saved preference and saves changes', async () => {
    await AsyncStorage.setItem('kinetra.pref.theme', 'light');
    let theme: Theme | undefined;
    function Probe() {
      theme = useTheme();
      return <Text testID="scheme">{theme.scheme}</Text>;
    }
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('scheme')).toHaveTextContent('light'));

    await act(async () => theme!.setPreference('dark'));
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    await waitFor(async () => expect(await AsyncStorage.getItem('kinetra.pref.theme')).toBe('dark'));
  });
});
