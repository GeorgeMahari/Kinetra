/**
 * "Where you are now": every dimension in its health zone. Each zone has its own icon and word,
 * so colour is never the only signal, and "not assessed" stays neutral rather than reading as bad.
 * Tapping a row opens the assessments of that dimension, where a missing or dated test can be done.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PlanView } from '@/api/plan';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/brand/Blaze';
import { ZoneBadge } from '@/components/data/ZoneBadge';
import { FadeInItem, PressableScale } from '@/design-system/motion';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';

export function ZoneList({ zones, focus }: { zones: PlanView['zones']; focus?: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const order = { attention: 0, fine: 1, strength: 2, unknown: 3 } as const;
  const rows = [...zones].sort((a, b) => order[a.zone] - order[b.zone]);
  return (
    <View style={{ gap: spacing.sm }} testID="plan-zones">
      <AppText variant="heading">{t('plan.zonesTitle')}</AppText>
      <AppText variant="caption" color="textMuted">
        {t('plan.zonesCaption')}
      </AppText>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {rows.map((z, i) => {
          const dim = DIMENSIONS.find((d) => d.key === z.dimension);
          const name = t(`dimensions.${z.dimension}.name`);
          return (
            <FadeInItem key={z.dimension} index={i}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 60 }} /> : null}
              <PressableScale
                testID={`zone-${z.dimension}`}
                accessibilityRole="button"
                accessibilityLabel={`${name}: ${t(`plan.zones.${z.zone}`)}${focus === z.dimension ? `, ${t('plan.focusTag')}` : ''}`}
                onPress={() => router.push({ pathname: '/assess', params: { dimension: z.dimension } })}
                hapticKind="select"
                highlight={{ base: colors.surface, active: colors.brandSoft }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 }}
              >
                {dim ? <Blaze {...dim.blaze} size={28} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label">{name}</AppText>
                  {focus === z.dimension ? (
                    <AppText variant="caption" color="brandText">
                      {t('plan.focusTag')}
                    </AppText>
                  ) : null}
                </View>
                <ZoneBadge zone={z.zone} />
              </PressableScale>
            </FadeInItem>
          );
        })}
      </View>
    </View>
  );
}
