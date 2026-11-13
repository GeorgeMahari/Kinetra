/**
 * Kinetra design tokens.
 *
 * Direction: "scientific instrument, human warmth". Deep ink surfaces, one confident
 * indigo brand colour, and a mint signal colour for progress. Status colours are
 * reserved for meaning (never decoration) so "not assessed" can always read as
 * neutral rather than as a bad result.
 */

const palette = {
  ink950: '#070B16',
  ink900: '#0B1020',
  ink800: '#121A2E',
  ink700: '#1C2640',
  ink600: '#2A3655',
  slate400: '#8A94AD',
  slate300: '#AEB6CA',
  slate100: '#E7EAF2',
  paper: '#F7F8FB',
  white: '#FFFFFF',

  indigo600: '#4B4FE0',
  indigo500: '#6366F1',
  indigo400: '#8B8EF6',
  indigo300: '#A5A8FA',
  mint500: '#22C7A9',
  mint300: '#7FE3CF',
  amber500: '#F2A93B',
  coral500: '#F0685A',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  brand: string;
  /** Brand colour for text and links on surfaces; lighter than `brand` in dark mode for 4.5:1 contrast. */
  brandText: string;
  brandSoft: string;
  onBrand: string;
  progress: string;
  /** Used for "unknown / not assessed" — deliberately neutral, never red. */
  unknown: string;
  warning: string;
  danger: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.paper,
    surface: palette.white,
    surfaceRaised: palette.white,
    border: palette.slate100,
    text: palette.ink900,
    textMuted: '#5A6480',
    textInverse: palette.white,
    brand: palette.indigo600,
    brandText: palette.indigo600,
    brandSoft: '#ECECFE',
    onBrand: palette.white,
    progress: '#14A88E',
    unknown: palette.slate400,
    warning: '#B97511',
    danger: '#D2483B',
  },
  dark: {
    background: palette.ink900,
    surface: palette.ink800,
    surfaceRaised: palette.ink700,
    border: palette.ink600,
    text: palette.slate100,
    textMuted: palette.slate300,
    textInverse: palette.ink900,
    brand: palette.indigo500,
    brandText: palette.indigo400,
    brandSoft: '#23264F',
    onBrand: palette.white,
    progress: palette.mint500,
    unknown: palette.slate400,
    warning: palette.amber500,
    danger: palette.coral500,
  },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/**
 * Typography uses the platform system font (SF Pro / Roboto) for MVP: excellent
 * legibility, full Cyrillic + Romanian diacritics coverage and zero download cost.
 * A brand display face can be added later via the expo-font config plugin.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

export const brand = palette;
