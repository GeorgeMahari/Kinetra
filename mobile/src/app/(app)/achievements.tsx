/**
 * The badge collection: a forest header with how many are unlocked, drawn as a row of diamond
 * waymarks (filled = unlocked), then every badge. Rules are the existing progression rules.
 */
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { AchievementsList } from '@/features/progression/ProgressionCards';
import { useProgression } from '@/features/progression/useProgression';
import { useTheme } from '@/theme/ThemeProvider';

export default function Achievements() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const p = useProgression();
  if (p.isPending) return <LoadingState />;
  if (p.isError) return <ErrorState error={p.error} onRetry={() => void p.refetch()} />;
  const all = p.data.achievements;
  const earned = all.filter((a) => a.earned_at).length;
  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <Animated.View
          entering={FadeInDown.duration(340).reduceMotion(ReduceMotion.System)}
          style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}
          accessible
          accessibilityLabel={t('achievementsView.count', { earned, total: all.length })}
          testID="achievements-summary"
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <AppText variant="metric" color="onShell">
              {earned}
            </AppText>
            <AppText variant="heading" color="onShellMuted">
              / {all.length}
            </AppText>
          </View>
          <AppText color="onShellMuted">{t('achievementsView.caption')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {all.map((a, i) => (
              // The entering animation owns the outer transform; the diamond's rotation sits inside.
              <Animated.View key={a.code} entering={ZoomIn.delay(120 + i * 35).duration(220).reduceMotion(ReduceMotion.System)}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    transform: [{ rotate: '45deg' }],
                    borderWidth: 2,
                    borderColor: colors.onShell,
                    backgroundColor: a.earned_at ? colors.onShell : 'transparent',
                    opacity: a.earned_at ? 1 : 0.5,
                    margin: 3,
                  }}
                />
              </Animated.View>
            ))}
          </View>
        </Animated.View>
        <AchievementsList p={p.data} />
      </View>
    </Screen>
  );
}
