/**
 * Recent results as a horizontal strip of tiles: the test's pictogram, its headline value large, and
 * the date. Tap opens the result. Values are the stored headline indicators, formatted as everywhere.
 */
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInRight, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type TestResult } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/motion';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { formatValue } from '@/features/assessments/ResultView';
import { useTheme } from '@/theme/ThemeProvider';

export function RecentStrip({ results }: { results: TestResult[] }) {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
      style={{ marginHorizontal: -2 }}
    >
      {results.map((r, i) => {
        const h = headlineIndicator(r);
        const value = h ? formatValue(h, i18n.resolvedLanguage) : null;
        const name = tr(`assess.tests.${r.test_code}.name`);
        return (
          <Animated.View key={r.id} entering={FadeInRight.delay(i * 60).duration(280).reduceMotion(ReduceMotion.System)}>
            <PressableScale
              testID={`recent-${r.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${value ?? '—'}`}
              onPress={() => router.push({ pathname: '/result/[id]', params: { id: r.id } })}
              highlight={{ base: colors.surface, active: colors.brandSoft }}
              style={{ width: 148, padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}
            >
              <Pictogram name={r.test_code} size={36} />
              <AppText variant="caption" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="metricSm" color={value ? 'text' : 'unknown'} numberOfLines={1} style={{ fontSize: 22, lineHeight: 26 }}>
                {value ?? '—'}
              </AppText>
              <View>
                <AppText variant="micro" color="textMuted">
                  {new Date(r.performed_at).toLocaleDateString(i18n.resolvedLanguage)}
                </AppText>
              </View>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}
