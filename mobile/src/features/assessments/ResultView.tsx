import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Indicator, Provenance, TestResult } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export function formatNumber(value: number, locale: string | undefined, unit: string): string {
  const digits = unit === 'ratio' ? 2 : Number.isInteger(value) ? 0 : 1;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

const UNIT_LABEL: Record<string, string> = { 'kg/m2': 'kg/m²', ratio: '' };

export function formatValue(i: Indicator, locale?: string): string | null {
  if (i.value == null) return null;
  const unit = UNIT_LABEL[i.unit] ?? i.unit;
  return `${formatNumber(i.value, locale, i.unit)}${unit ? ` ${unit}` : ''}`;
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const tone = provenance === 'estimated' ? colors.warning : provenance === 'calculated' ? colors.brand : colors.progress;
  return (
    <View
      testID={`provenance-${provenance}`}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone,
        alignSelf: 'flex-start',
      }}
    >
      <AppText variant="caption" style={{ color: tone, fontSize: 11, fontWeight: '600' }}>
        {t(`assess.provenance.${provenance}`)}
      </AppText>
    </View>
  );
}

/** Sentence for an interpretation, or null when there is none. */
export function interpretationText(t: ReturnType<typeof useTranslation>['t'], i: Indicator): string | null {
  const it = i.interpretation;
  if (!it) return null;
  if (it.scheme === 'percentile_band') {
    const age = it.detail.age_group ?? '';
    const group = t(it.detail.sex === 'female' ? 'assess.interpretations.groupFemale' : 'assess.interpretations.groupMale', { age });
    return t('assess.interpretations.friendSentence', {
      group,
      band: t(`assess.interpretations.${it.label}` as 'assess.interpretations.p50_75'),
    });
  }
  return t(`assess.interpretations.${it.label}` as 'assess.interpretations.who_normal');
}

function IndicatorRow({ indicator }: { indicator: Indicator }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const value = formatValue(indicator, i18n.resolvedLanguage);
  const interp = interpretationText(t, indicator);
  const needsAdvice = indicator.interpretation?.label === 'nice_increased' || indicator.interpretation?.label === 'nice_high';
  return (
    <View testID={`indicator-${indicator.code}`} style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="label">{t(`assess.indicators.${indicator.code}` as 'assess.indicators.bmi')}</AppText>
          <ProvenanceBadge provenance={indicator.provenance} />
        </View>
        {/* A missing value is shown as unknown, never as zero. */}
        <AppText variant="title" color={value ? 'text' : 'unknown'} testID={`value-${indicator.code}`}>
          {value ?? '—'}
        </AppText>
      </View>
      {interp ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Icon name="info" size={16} color={colors.brand} />
          <AppText variant="caption" style={{ flex: 1 }} testID={`interpretation-${indicator.code}`}>
            {interp}
          </AppText>
        </View>
      ) : null}
      {needsAdvice ? (
        <AppText variant="caption" color="textMuted">
          {t('assess.interpretations.niceAdvice')}
        </AppText>
      ) : null}
      {indicator.notes.map((n) => (
        <AppText key={n} variant="caption" color="textMuted">
          {t(`assess.notes.${n}` as 'assess.notes.stopped_early', { defaultValue: '' })}
        </AppText>
      ))}
    </View>
  );
}

export function ResultView({ result }: { result: TestResult }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const hasInterpretation = result.indicators.some((i) => i.interpretation);
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" color="textMuted">
          {new Date(result.performed_at).toLocaleString(i18n.resolvedLanguage)}
        </AppText>
        {result.status === 'stopped_early' ? (
          <AppText variant="caption" color="warning">
            {t('assess.incomplete')}
          </AppText>
        ) : null}
      </View>
      <Card>
        {result.indicators.map((i) => (
          <IndicatorRow key={i.code} indicator={i} />
        ))}
      </Card>
      {!hasInterpretation ? (
        <AppText variant="caption" color="textMuted" testID="no-comparison">
          {t('assess.noComparison')}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('assess.provenanceHelp')}
      </AppText>
      {result.references.length ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('assess.sections.sources')}</AppText>
          {result.references.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(r.url)}
              style={{ gap: 2 }}
            >
              <AppText variant="caption">{r.citation}</AppText>
              <AppText variant="caption" style={{ color: colors.brandText }}>
                {t('assess.sourceLink')}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
