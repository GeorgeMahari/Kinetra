/**
 * Profile identity on the forest shell: initials on a white trail-blaze plate, name and email, and the
 * level from the progression the app already computes (read-only). The level track fills on arrival.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { Me } from '@/api/auth';
import type { Progression } from '@/api/progression';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export function initialsOf(name: string | null, email: string): string {
  const source = (name ?? '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
  }
  return (email[0] ?? '?').toUpperCase();
}

export function ProfileHeader({ user, progression }: { user: Me; progression?: Progression }) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius, motion } = useTheme();
  const reduced = useReducedMotion();
  const name = user.profile.display_name;
  const share =
    progression && progression.next_level_at
      ? Math.max(0, Math.min(1, (progression.points - progression.level_floor) / (progression.next_level_at - progression.level_floor)))
      : 1;
  const fill = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    fill.set(reduced ? share : withTiming(share, { duration: motion.reveal, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [share, reduced, fill, motion.reveal]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.duration.slow).reduceMotion(ReduceMotion.System)}
      testID="profile-header"
      style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.plate * 2,
            backgroundColor: colors.plate,
            borderWidth: 1,
            borderColor: colors.plateBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="title" style={{ color: colors.shell, letterSpacing: 0.5 }}>
            {initialsOf(name, user.email)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" color="onShell" numberOfLines={1} testID="profile-name">
            {name || tr('redesignProfile.header.noName')}
          </AppText>
          <AppText variant="caption" color="onShellMuted" numberOfLines={1}>
            {user.email}
          </AppText>
        </View>
      </View>
      {progression ? (
        <View
          accessible
          accessibilityLabel={tr('redesignProfile.header.levelA11y', { level: progression.level, points: progression.points })}
          style={{ gap: spacing.xs }}
          testID="profile-level"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <AppText variant="label" color="onShell">
              {tr('redesignProfile.header.level', { level: progression.level })}
            </AppText>
            <AppText variant="caption" color="onShellMuted" style={{ fontVariant: ['tabular-nums'] }}>
              {tr('redesignProfile.header.points', { points: progression.points })}
            </AppText>
          </View>
          <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.onShellMuted, opacity: 0.35 }} />
          <Animated.View
            style={[{ position: 'absolute', left: 0, bottom: 0, height: 6, borderRadius: radius.pill, backgroundColor: colors.onShell }, bar]}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
