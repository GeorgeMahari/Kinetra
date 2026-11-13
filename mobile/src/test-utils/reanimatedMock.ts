/**
 * Test stand-in for react-native-reanimated, wired through `moduleNameMapper` (for both the package
 * and its `/mock` entry, which expo-router's testing library loads). The shipped mock boots the JS
 * engine and throws under jest-expo. Animations simply don't run; reduced motion is reported on.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const RN = require('react-native');

const builder: Record<string, unknown> = {};
for (const m of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'reduceMotion', 'easing']) {
  builder[m] = () => builder;
}
const id = <T>(c: T): T => c;
const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: id, call: () => {} };

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: (v: unknown) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => true,
  withSpring: id,
  withTiming: id,
  withRepeat: id,
  withSequence: (...v: unknown[]) => v[v.length - 1],
  FadeInDown: builder,
  ZoomIn: builder,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};
