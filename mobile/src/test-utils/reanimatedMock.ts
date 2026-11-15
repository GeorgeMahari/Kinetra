/**
 * Test stand-in for react-native-reanimated, wired through `moduleNameMapper` (for both the package
 * and its `/mock` entry, which expo-router's testing library loads). The shipped mock boots the JS
 * engine and throws under jest-expo. Animations simply don't run; reduced motion is reported on.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const RN = require('react-native');

const builder: Record<string, unknown> = {};
for (const m of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'reduceMotion', 'easing', 'withInitialValues', 'randomDelay', 'build']) {
  builder[m] = () => builder;
}
const id = <T>(c: T): T => c;
const motionState = { reduced: true };
const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: id, call: () => {} };

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: (v: unknown) => {
    const sv = { value: v, get: () => sv.value, set: (n: unknown) => { sv.value = n; } };
    return sv;
  },
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => motionState.reduced,
  /** Tests can turn motion on to exercise loops: `require('react-native-reanimated').__setReducedMotion(false)`. */
  __setReducedMotion: (v: boolean) => {
    motionState.reduced = v;
  },
  useAnimatedRef: () => {
    const ref = () => {};
    return ref;
  },
  useAnimatedReaction: () => {},
  measure: () => null,
  withSpring: id,
  withTiming: id,
  withRepeat: id,
  withSequence: (...v: unknown[]) => v[v.length - 1],
  withDelay: (_d: number, v: unknown) => v,
  runOnJS: <F>(f: F) => f,
  useAnimatedScrollHandler: () => () => {},
  useAnimatedProps: () => ({}),
  interpolate: (_v: number, _i: number[], out: number[]) => out[0],
  interpolateColor: (_v: number, _i: number[], out: string[]) => out[0],
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  cancelAnimation: jest.fn(),
  Easing: { bezier: () => id, out: id, in: id, inOut: id, cubic: id, linear: id },
  FadeIn: builder,
  FadeInDown: builder,
  FadeInUp: builder,
  FadeOut: builder,
  FadeOutUp: builder,
  SlideInDown: builder,
  SlideInUp: builder,
  ZoomIn: builder,
  ZoomOut: builder,
  LinearTransition: builder,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};
