/**
 * Kinetra design tokens — world "Marcaje turistice" (Carpathian trail waymarks).
 *
 * Rock-white ground, a forest-green shell, and the four waymark colours. Every dimension is a
 * marked trail: its blaze (shape + colour on a white plate) identifies it everywhere. Blaze colours
 * identify, never judge: errors and safety notes keep their own colours plus an icon and text, and
 * "not assessed" stays neutral rather than reading as a bad result.
 *
 * Kinetra Hybrid (2026-11-15) adds two layers on this base, see docs/DESIGN_SYSTEM.md:
 * - Performance lab: a deep-teal data ink, hairlines and sunken wells for charts, metric type sizes.
 * - Human wellness: trail-sign pictograms of people (components/pictograms) and the body map.
 */

const palette = {
  // Light ground
  rock: '#F3F4F2',
  white: '#FFFFFF',
  stone200: '#DCDFDA',
  stone500: '#8A928E',
  stone600: '#5C6460',
  ink: '#1A1D1F',

  // Dark ground (night forest)
  night950: '#0E1512',
  night900: '#16201B',
  night800: '#1D2A23',
  night700: '#2A3832',
  mist300: '#A7B2AC',
  mist100: '#E8ECE9',

  // Forest
  forest700: '#2F6B45',
  forest600: '#2F7A4F',
  forest800: '#1E4A33',
  forest300: '#7CC796',
  forest100: '#E3EEE6',
  forestNight: '#1E3327',
  leaf500: '#5FB37E',

  // Waymark paints (on a white plate, in both themes)
  blazeRed: '#D23A2C',
  blazeBlue: '#2563C9',
  blazeYellow: '#E3B21E',
  blazeGreen: '#2F8F4E',

  // Data ink (performance-lab layer): charts, rulers, the "strength" zone
  teal700: '#1E6B63',
  teal300: '#5FC4B6',
  teal100: '#D8ECE8',
  tealNight: '#16352F',

  // Meaning only
  amber600: '#B97511',
  amber400: '#F2A93B',
  error600: '#B3261E',
  error300: '#F2766B',
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
  /** Filled controls (primary buttons, active marks). White text sits on it at ≥ 4.5:1. */
  brand: string;
  /** Brand colour for text and links on surfaces (≥ 4.5:1 in both themes). */
  brandText: string;
  brandSoft: string;
  onBrand: string;
  /** The app shell: the Today hero panel and other "trail head" surfaces. */
  shell: string;
  onShell: string;
  onShellMuted: string;
  progress: string;
  /** Used for "unknown / not assessed" — deliberately neutral, never red. */
  unknown: string;
  warning: string;
  danger: string;
  /** The white plate a blaze is painted on. */
  plate: string;
  plateBorder: string;
  /** Recessed wells behind charts and rulers. */
  surfaceSunken: string;
  /** 1-px grid and divider lines inside data visuals. */
  hairline: string;
  /** Data ink: lines, markers and fills of charts and rulers (≥ 4.5:1 on surface). */
  dataInk: string;
  dataInkSoft: string;
  /** Health zones (D42). Each is always paired with its icon and word, never colour alone. */
  zoneAttention: string;
  zoneAttentionSoft: string;
  zoneFine: string;
  zoneFineSoft: string;
  zoneStrength: string;
  zoneStrengthSoft: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.rock,
    surface: palette.white,
    surfaceRaised: palette.white,
    border: palette.stone200,
    text: palette.ink,
    textMuted: palette.stone600,
    textInverse: palette.white,
    brand: palette.forest700,
    brandText: palette.forest700,
    brandSoft: palette.forest100,
    onBrand: palette.white,
    shell: palette.forest700,
    onShell: palette.white,
    onShellMuted: 'rgba(255,255,255,0.82)',
    progress: palette.forest700,
    unknown: palette.stone500,
    warning: palette.amber600,
    danger: palette.error600,
    plate: palette.white,
    plateBorder: palette.stone200,
    surfaceSunken: '#EAEDE9',
    hairline: 'rgba(26,29,31,0.09)',
    dataInk: palette.teal700,
    dataInkSoft: palette.teal100,
    zoneAttention: palette.amber600,
    zoneAttentionSoft: '#F8ECD6',
    zoneFine: palette.forest700,
    zoneFineSoft: palette.forest100,
    zoneStrength: palette.teal700,
    zoneStrengthSoft: palette.teal100,
  },
  dark: {
    background: palette.night950,
    surface: palette.night900,
    surfaceRaised: palette.night800,
    border: palette.night700,
    text: palette.mist100,
    textMuted: palette.mist300,
    textInverse: palette.night950,
    brand: palette.forest600,
    brandText: palette.forest300,
    brandSoft: palette.forestNight,
    onBrand: palette.white,
    shell: palette.forest800,
    onShell: palette.white,
    onShellMuted: 'rgba(255,255,255,0.78)',
    progress: palette.leaf500,
    unknown: '#7E8A84',
    warning: palette.amber400,
    danger: palette.error300,
    plate: '#F4F5F2',
    plateBorder: palette.night700,
    surfaceSunken: '#0A100D',
    hairline: 'rgba(232,236,233,0.09)',
    dataInk: palette.teal300,
    dataInkSoft: palette.tealNight,
    zoneAttention: palette.amber400,
    zoneAttentionSoft: '#3A2B12',
    zoneFine: palette.forest300,
    zoneFineSoft: palette.forestNight,
    zoneStrength: palette.teal300,
    zoneStrengthSoft: palette.tealNight,
  },
};

/** The four waymark paints. Shapes carry the identity too, so a blaze never relies on colour alone. */
export const blazeColors = {
  red: palette.blazeRed,
  blue: palette.blazeBlue,
  yellow: palette.blazeYellow,
  green: palette.blazeGreen,
} as const;
export type BlazeColor = keyof typeof blazeColors;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { plate: 5, sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

/**
 * Depth: soft, offset shadows in light; tonal layers (no shadow) in dark, where a shadow on
 * near-black is invisible and only muddies the edge.
 */
export const elevation = {
  light: {
    card: { shadowColor: '#1A2A20', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    raised: { shadowColor: '#1A2A20', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
    floating: { shadowColor: '#0E1512', shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  },
  dark: {
    card: {},
    raised: {},
    floating: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  },
} as const;

/** Motion: short and calm. Springs for touch, timings for reveals. All disabled under Reduce Motion. */
export const motion = {
  pressScale: 0.97,
  spring: { damping: 18, stiffness: 260, mass: 0.6 },
  duration: { fast: 150, base: 250, slow: 400 },
  stagger: 40,
  /** Springs: `gentle` for panels and sheets, `snappy` for touch feedback and markers. */
  gentle: { damping: 20, stiffness: 180, mass: 0.9 },
  snappy: { damping: 14, stiffness: 320, mass: 0.6 },
  /** Reveal of a number or a marker into its final place. */
  reveal: 700,
} as const;

/** Icon sizes, so glyphs line up with text across screens. */
export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32, hero: 48 } as const;

/** Geologica: one family with Romanian diacritics and Cyrillic. Weights map to loaded faces. */
export const fontFamily = {
  400: 'Geologica_400Regular',
  500: 'Geologica_500Medium',
  600: 'Geologica_600SemiBold',
  700: 'Geologica_700Bold',
} as const;
export type FontWeightKey = keyof typeof fontFamily;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  /** Chart axes and small data labels. */
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.2 },
  /** Headline measurements (performance-lab layer): tabular figures, tight tracking. */
  metric: { fontSize: 46, lineHeight: 50, fontWeight: '700' as const, letterSpacing: -1.4, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
  metricSm: { fontSize: 28, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.6, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
} as const;

export type TypographyVariant = keyof typeof typography;

export const brand = palette;
