/**
 * A finished day, celebrated: waymark confetti (the four trail colours, in the four blaze shapes)
 * bursts from the top and settles, while a banner slides in with the new streak. Achievements earned
 * by the same tick appear as badges in the banner. Under Reduce Motion only the banner shows, without
 * movement. Decorative pieces are hidden from screen readers; the banner is announced.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  SlideInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { Blaze, type BlazeShape } from '@/components/Blaze';
import { Icon } from '@/design-system/Icon';
import { useTheme } from '@/design-system/ThemeProvider';
import type { BlazeColor } from '@/design-system/tokens';

const SHAPES: BlazeShape[] = ['band', 'dot', 'cross', 'triangle'];
const COLORS: BlazeColor[] = ['red', 'blue', 'yellow', 'green'];
const PIECES = 26;

export function Celebration({
  streak,
  achievements,
  dayComplete = true,
  onDone,
}: {
  streak: number;
  achievements: string[];
  /** False when only achievements were earned (no finished day): no confetti, a quieter title. */
  dayComplete?: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const message = dayComplete ? t('plan.dayComplete', { count: streak }) : t('plan.achievementUnlocked');

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const id = setTimeout(onDone, achievements.length ? 4200 : 2800);
    return () => clearTimeout(id);
  }, [message, onDone, achievements.length]);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} testID="plan-celebration">
      {reduced || !dayComplete ? null : (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {Array.from({ length: PIECES }, (_, i) => (
            <Piece key={i} index={i} />
          ))}
        </View>
      )}
      <Animated.View
        entering={SlideInUp.springify().damping(16).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
        style={{ position: 'absolute', top: insets.top + spacing.md, left: spacing.lg, right: spacing.lg, alignItems: 'center' }}
      >
        <Pressable
          onPress={onDone}
          accessibilityRole="alert"
          accessibilityLabel={message}
          style={{
            width: '100%',
            maxWidth: 520,
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: colors.shell,
            ...elevation.raised,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="flame" size={30} color={colors.onShell} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading" color="onShell">
                {dayComplete ? t('plan.dayCompleteTitle') : t('plan.newAchievements')}
              </AppText>
              {dayComplete ? (
                <AppText variant="caption" color="onShellMuted">
                  {message}
                </AppText>
              ) : null}
            </View>
          </View>
          {achievements.map((code, i) => (
            <Animated.View
              key={code}
              entering={FadeIn.delay(350 + i * 200).duration(300).reduceMotion(ReduceMotion.System)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' }}
              testID={`celebration-achievement-${code}`}
            >
              <Blaze shape={SHAPES[i % 4]!} color={COLORS[(i + 2) % 4]!} size={28} />
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color="onShellMuted">
                  {t('plan.achievementUnlocked')}
                </AppText>
                <AppText variant="label" color="onShell">
                  {tr(`progression.achievements.${code}.name`)}
                </AppText>
              </View>
            </Animated.View>
          ))}
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** One confetti waymark: shot up and sideways, then falling and turning as it fades. */
function Piece({ index }: { index: number }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  // Deterministic spread (no randomness in render): angle and speed from the index.
  const angle = -Math.PI / 2 + ((index / PIECES) - 0.5) * Math.PI * 0.95;
  const speed = 0.55 + ((index * 37) % 10) / 22;
  const spin = ((index * 53) % 7) - 3;
  const delay = (index % 6) * 25;
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const vx = Math.cos(angle) * speed * width * 0.55;
    const vy = Math.sin(angle) * speed * height * 0.42;
    return {
      opacity: p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
      transform: [
        { translateX: vx * p },
        { translateY: vy * p + height * 0.55 * p * p },
        { rotate: `${spin * 220 * p}deg` },
        { scale: 0.6 + 0.4 * Math.min(1, p * 4) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: width / 2 - 9, top: height * 0.32 }, style]}>
      <Blaze shape={SHAPES[index % 4]!} color={COLORS[(index * 3) % 4]!} size={18} />
    </Animated.View>
  );
}
