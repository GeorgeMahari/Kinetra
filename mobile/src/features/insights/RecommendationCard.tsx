import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Recommendation } from '@/api/insights';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { recommendationText } from './present';

const ICON: Record<Recommendation['kind'], IconName> = {
  setup: 'profile',
  safety: 'alert',
  profile: 'body',
  assess: 'today',
  retest: 'recovery',
  habit: 'check',
};

function target(r: Recommendation): (() => void) | undefined {
  if (r.kind === 'setup') return () => router.push('/onboarding');
  if (r.kind === 'profile') return () => router.push('/edit-profile');
  if (r.test_code) return () => router.push({ pathname: '/test/[code]', params: { code: r.test_code! } });
  return undefined;
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const { title, body } = recommendationText(t, rec, i18n.resolvedLanguage);
  if (!title) return null;
  const onPress = target(rec);
  const tone = rec.kind === 'safety' ? colors.warning : colors.brand;

  const content = (
    <Card style={rec.kind === 'safety' ? { borderColor: colors.warning } : undefined}>
      <View testID={`rec-${rec.code}`} style={{ flexDirection: 'row', gap: spacing.md }}>
        <Icon name={ICON[rec.kind]} color={tone} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption">{body}</AppText>
          {rec.reasons.map((r) => (
            <AppText key={r} variant="caption" color="textMuted">
              {t(`recs.reasons.${r}` as 'recs.reasons.increase_gradually_after_screening', { defaultValue: '' })}
            </AppText>
          ))}
          {rec.reference ? (
            <AppText
              variant="caption"
              style={{ color: colors.brandText }}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(rec.reference!.url)}
            >
              {t('dashboard.source')}: {rec.reference.citation.split('.')[0]}
            </AppText>
          ) : null}
        </View>
        {onPress ? <Icon name="chevronRight" size={18} color={colors.textMuted} /> : null}
      </View>
    </Card>
  );
  return onPress ? (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {content}
    </PressableScale>
  ) : (
    content
  );
}
