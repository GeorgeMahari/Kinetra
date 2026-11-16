import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { loadThemePreference, saveThemePreference, type ThemePreference } from './preferences';
import { colors, elevation, motion, radius, spacing, typography, type ColorScheme, type ThemeColors } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: (typeof elevation)[ColorScheme];
  motion: typeof motion;
  preference: ThemePreference;
  setPreference(p: ThemePreference): void;
}

const ThemeContext = createContext<Theme | null>(null);

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
  if (preference !== 'system') return preference;
  // Dark is the brand's home; it is also the fallback when the system doesn't say.
  return system === 'light' ? 'light' : 'dark';
}

/**
 * `scheme` forces a scheme (tests, previews). Otherwise the user's saved preference applies,
 * with "system" following the device setting live.
 */
export function ThemeProvider({ children, scheme }: { children: ReactNode; scheme?: ColorScheme }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    if (scheme) return;
    let active = true;
    void loadThemePreference().then((p) => active && setPreferenceState(p));
    return () => {
      active = false;
    };
  }, [scheme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void saveThemePreference(p);
  }, []);

  const resolved = scheme ?? resolveScheme(preference, system);
  const theme = useMemo<Theme>(
    () => ({
      scheme: resolved,
      colors: colors[resolved],
      spacing,
      radius,
      typography,
      elevation: elevation[resolved],
      motion,
      preference,
      setPreference,
    }),
    [resolved, preference, setPreference],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
