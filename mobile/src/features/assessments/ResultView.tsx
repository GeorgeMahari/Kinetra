/**
 * A saved result, Kinetra Hybrid style: a hero with the test's pictogram and its headline value
 * counting up; for every indicator a norm judges, the ruler or band bar that shows where it sits,
 * with the engine's own sentence; plain indicators as large-number tiles; the body areas the test
 * uses (illustrative); sources on demand. Every number shown comes from the stored result.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { Indicator, Provenance, TestResult } from '@/api/assessments';
import { AppText } from '@/design-system/AppText';
import { AnimatedNumber } from '@/components/data/AnimatedNumber';
import { BandBar } from '@/components/data/BandBar';
import { PercentileRuler } from '@/components/data/PercentileRuler';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';
import { isPictogram, Pictogram } from '@/components/brand/Pictogram';
import { REGIONS_BY_TEST } from '@/features/body/regions';
import i18n from '@/i18n';
import { useTheme } from '@/design-system/ThemeProvider';

import { interpretationVisual } from './interpretationVisual';

export function formatNumber(value: number, locale: string | undefined, unit: string): string {
  const digits = unit === 'ratio' ? 2 : Number.isInteger(value) ? 0 : 1;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** The unit as written in the current language (units arrive from the API as codes like `reps`). */
export function unitLabel(unit: string): string {
  return i18n.t(`viz.unit.${unit}`, {
    defaultValue: unit === 'kg/m2' ? 'kg/m²' : unit === 'ratio' || unit === 'count' ? '' : unit,
  });
}

export function formatValue(i: Indicator, locale?: string): string | null {
  if (i.value == null) return null;
  const unit = unitLabel(i.unit);
  return `${formatNumber(i.value, locale, i.unit)}${unit ? ` ${unit}` : ''}`;
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const tone = provenance === 'estimated' ? colors.warning : provenance === 'calculated' ? colors.dataInk : colors.progress;
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
      <AppText variant="micro" style={{ color: tone }}>
        {t(`assess.provenance.${provenance}`)}
      </AppText>
    </View>
  );
}

/** Sentence for an interpretation, or null when there is none. */
export function interpretationText(t: ReturnType<typeof useTranslation>['t'], i: Indicator): string | null {
  const it = i.interpretation;
  if (!it) return null;
  // Keys built at runtime: typing them against the full resource tree is too deep for the i18next types.
  const tr = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const group = (age: unknown, sex: unknown) =>
    age && sex
      ? tr(sex === 'female' ? 'assess.interpretations.groupFemale' : 'assess.interpretations.groupMale', { age })
      : age
        ? tr('assess.interpretations.groupAge', { age })
        : tr('assess.interpretations.groupProfile');
  if (it.scheme === 'percentile_band') {
    return tr('assess.interpretations.friendSentence', {
      group: group(it.detail.age_group ?? '', it.detail.sex ?? 'male'),
      band: tr(`assess.interpretations.${it.label}`),
    });
  }
  if (it.scheme === 'percentile') {
    if (it.detail.capped === true) return tr('assess.interpretations.stanceCap');
    const p = Math.round(Number(it.detail.percentile));
    return tr('assess.interpretations.percentileSentence', { p, group: group(it.detail.age_group, it.detail.sex) });
  }
  return tr(`assess.interpretations.${it.label}`);
}

function Notes({ indicator }: { indicator: Indicator }) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const lines = indicator.notes.map((n) => tr(`assess.notes.${n}`, { defaultValue: '' })).filter(Boolean);
  if (!lines.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line) => (
        <AppText key={line} variant="caption" color="textMuted">
          {line}
        </AppText>
      ))}
    </View>
  );
}

/** One indicator judged by a norm: name, value, its visual (ruler or bands), the sentence and notes. */
function InterpretedIndicator({ indicator, inHero = false }: { indicator: Indicator; inHero?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const value = formatValue(indicator, i18n.resolvedLanguage);
  const interp = interpretationText(t, indicator);
  const visual = interpretationVisual(t, indicator.interpretation);
  const needsAdvice = indicator.interpretation?.label === 'nice_increased' || indicator.interpretation?.label === 'nice_high';
  return (
    <View
      testID={`indicator-${indicator.code}`}
      style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="label">{t(`assess.indicators.${indicator.code}` as 'assess.indicators.bmi')}</AppText>
          <ProvenanceBadge provenance={indicator.provenance} />
        </View>
        {/* A missing value is shown as unknown, never as zero. The headline's number is in the hero. */}
        <AppText
          variant={inHero ? 'label' : 'metricSm'}
          color={value ? (inHero ? 'textMuted' : 'text') : 'unknown'}
          testID={`value-${indicator.code}`}
        >
          {value ?? '—'}
        </AppText>
      </View>
      {visual?.kind === 'percentile' ? (
        <PercentileRuler percentile={visual.percentile} caption={visual.caption} testID={`ruler-${indicator.code}`} />
      ) : visual?.kind === 'band' ? (
        <BandBar bands={visual.bands} active={visual.active} caption={visual.caption} testID={`bands-${indicator.code}`} />
      ) : null}
      {interp ? (
        <AppText variant="caption" testID={`interpretation-${indicator.code}`}>
          {interp}
        </AppText>
      ) : null}
      {needsAdvice ? (
        <AppText variant="caption" color="textMuted">
          {t('assess.interpretations.niceAdvice')}
        </AppText>
      ) : null}
      <Notes indicator={indicator} />
    </View>
  );
}

/** Indicators without a norm: compact tiles with the value large. */
function PlainIndicator({ indicator }: { indicator: Indicator }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const value = formatValue(indicator, i18n.resolvedLanguage);
  return (
    <View
      testID={`indicator-${indicator.code}`}
      style={{ flexGrow: 1, flexBasis: '45%', gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}
    >
      <AppText variant="caption" color="textMuted" numberOfLines={2}>
        {t(`assess.indicators.${indicator.code}` as 'assess.indicators.bmi')}
      </AppText>
      <AppText variant="metricSm" color={value ? 'text' : 'unknown'} testID={`value-${indicator.code}`}>
        {value ?? '—'}
      </AppText>
      <ProvenanceBadge provenance={indicator.provenance} />
      <Notes indicator={indicator} />
    </View>
  );
}

/** Result hero: the test's pictogram and its headline value counting up on the forest shell. */
function ResultHero({ result }: { result: TestResult }) {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.resolvedLanguage;
  const head = result.indicators.find((i) => i.code === result.headline) ?? result.indicators[0];
  const unit = head ? unitLabel(head.unit) : '';
  const testName = tr(`assess.tests.${result.test_code}.name`);
  const headName = head ? tr(`assess.indicators.${head.code}`) : '';
  return (
    <Animated.View
      entering={FadeInDown.duration(380).reduceMotion(ReduceMotion.System)}
      testID="result-hero"
      style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {isPictogram(result.test_code) ? (
          <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.onShellMuted }}>
            <Pictogram name={result.test_code} size={52} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" color="onShell" numberOfLines={2}>
            {testName}
          </AppText>
          <AppText variant="caption" color="onShellMuted">
            {new Date(result.performed_at).toLocaleString(locale)}
          </AppText>
        </View>
      </View>
      {head && head.value != null ? (
        <View style={{ gap: 2 }}>
          {headName !== testName ? (
            <AppText variant="caption" color="onShellMuted">
              {headName}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <AnimatedNumber
              value={head.value}
              format={(v) => formatNumber(v, locale, head.unit)}
              color="onShell"
              testID="result-headline"
            />
            {unit ? (
              <AppText variant="heading" color="onShellMuted">
                {unit}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      {result.status === 'stopped_early' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="alert" size={16} color={colors.onShell} />
          <AppText variant="caption" color="onShell">
            {t('assess.incomplete')}
          </AppText>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Body areas this test uses (illustrative), linking to the body map. */
function BodyAreas({ code }: { code: TestResult['test_code'] }) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const regions = REGIONS_BY_TEST[code] ?? [];
  if (!regions.length) return null;
  return (
    <PressableScale
      testID="result-body-areas"
      accessibilityRole="button"
      accessibilityHint={t('body.entryCaption')}
      onPress={() => router.push('/body')}
      highlight={{ base: colors.surface, active: colors.brandSoft }}
      style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label">{tr('resultView.areasTitle')}</AppText>
        <Icon name="chevronRight" size={18} color={colors.brandText} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {regions.map((r) => (
          <View key={r} style={{ paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken }}>
            <AppText variant="caption">{tr(`body.regions.${r}`)}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="micro" color="textMuted">
        {tr('resultView.areasNote')}
      </AppText>
    </PressableScale>
  );
}

export function ResultView({ result }: { result: TestResult }) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const interpreted = result.indicators.filter((i) => i.interpretation);
  const plain = result.indicators.filter((i) => !i.interpretation);
  return (
    <View style={{ gap: spacing.lg }}>
      <ResultHero result={result} />
      {interpreted.length ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{tr('resultView.whereTitle')}</AppText>
          {interpreted.map((i, n) => (
            <Animated.View key={i.code} entering={FadeInDown.delay(120 + n * 80).duration(320).reduceMotion(ReduceMotion.System)}>
              <InterpretedIndicator indicator={i} inHero={i.code === result.headline} />
            </Animated.View>
          ))}
        </View>
      ) : (
        <AppText variant="caption" color="textMuted" testID="no-comparison">
          {t('assess.noComparison')}
        </AppText>
      )}
      {plain.length ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{interpreted.length ? tr('resultView.otherTitle') : tr('resultView.valuesTitle')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {plain.map((i) => (
              <PlainIndicator key={i.code} indicator={i} />
            ))}
          </View>
        </View>
      ) : null}
      <BodyAreas code={result.test_code} />
      <AppText variant="caption" color="textMuted">
        {t('assess.provenanceHelp')}
      </AppText>
      {result.references.length ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: sourcesOpen }}
            onPress={() => setSourcesOpen((o) => !o)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
            testID="result-sources-toggle"
          >
            <AppText variant="label">{t('assess.sections.sources')}</AppText>
            <View style={{ transform: [{ rotate: sourcesOpen ? '90deg' : '0deg' }] }}>
              <Icon name="chevronRight" size={18} color={colors.brandText} />
            </View>
          </Pressable>
          {sourcesOpen
            ? result.references.map((r) => (
                <Animated.View key={r.id} entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(r.url)} style={{ gap: 2 }}>
                    <AppText variant="caption">{r.citation}</AppText>
                    <AppText variant="caption" style={{ color: colors.brandText }}>
                      {t('assess.sourceLink')}
                    </AppText>
                  </Pressable>
                </Animated.View>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}
