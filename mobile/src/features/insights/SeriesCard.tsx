import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Provenance } from '@/api/assessments';
import type { ProgressSeries } from '@/api/insights';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { formatValue, ProvenanceBadge } from '@/features/assessments/ResultView';
import { useTheme } from '@/design-system/ThemeProvider';

import { protocolLabel, signedChange } from './present';

/**
 * One indicator, one protocol: latest value as a metric figure, change vs previous/first as
 * neutral chips (a change is not judged good or bad here: direction depends on the indicator),
 * the interactive chart, and the table view.
 */
export function SeriesCard({
  title,
  unit,
  provenance,
  series,
  testID,
  header,
  showTitle = true,
}: {
  title: string;
  unit: string;
  provenance: Provenance;
  series: ProgressSeries;
  testID?: string;
  /** Rendered at the top of the card (e.g. the test it belongs to, with a link). */
  header?: ReactNode;
  /** Hide the indicator name when the header already says the same thing. */
  showTitle?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [table, setTable] = useState(false);
  const locale = i18n.resolvedLanguage;
  const fmt = (v: number) =>
    formatValue(
      {
        code: '',
        value: v,
        unit,
        provenance,
        interpretation: null,
        notes: [],
        reference_ids: [],
      },
      locale,
    ) ?? '';
  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const last = series.points[series.points.length - 1]!;
  const protocol = protocolLabel(t, series.protocol_key);
  const chip = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  };

  return (
    <Card>
      <View testID={testID} style={{ gap: spacing.md }}>
        {header}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            {showTitle ? <AppText variant="label">{title}</AppText> : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <ProvenanceBadge provenance={provenance} />
              {protocol ? (
                <AppText variant="caption" color="textMuted">
                  {t('progress.protocol', { protocol })}
                </AppText>
              ) : null}
            </View>
          </View>
          <AppText variant="metricSm" testID={testID ? `${testID}-latest` : undefined}>
            {fmt(last.value)}
          </AppText>
        </View>

        {series.change_vs_previous == null ? (
          <AppText variant="caption" color="textMuted">
            {t('progress.noPrevious')}
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={chip}>
              <AppText variant="caption" testID={testID ? `${testID}-delta-prev` : undefined}>
                <AppText variant="label" color="dataInk">
                  {signedChange(series.change_vs_previous, locale)}
                </AppText>{' '}
                <AppText variant="caption" color="textMuted">
                  {t('progress.vsPrevious')}
                </AppText>
              </AppText>
            </View>
            <View style={chip}>
              <AppText variant="caption">
                <AppText variant="label" color="dataInk">
                  {signedChange(series.change_vs_first ?? 0, locale)}
                </AppText>{' '}
                <AppText variant="caption" color="textMuted">
                  {t('progress.vsFirst')}
                </AppText>
              </AppText>
            </View>
          </View>
        )}

        <LineChart
          points={series.points.map((p) => ({
            id: p.result_id,
            date: new Date(p.performed_at),
            value: p.value,
          }))}
          format={fmt}
          formatTick={(v) =>
            new Intl.NumberFormat(locale, {
              maximumFractionDigits: unit === 'ratio' ? 2 : 1,
            }).format(v)
          }
          formatDate={fmtDate}
          accessibilityLabel={`${title}: ${series.points.map((p) => `${fmtDate(new Date(p.performed_at))} ${fmt(p.value)}`).join(', ')}`}
        />

        <Button
          variant="ghost"
          label={table ? t('progress.hideTable') : t('progress.showTable')}
          onPress={() => setTable((v) => !v)}
        />
        {table ? (
          <View
            testID={testID ? `${testID}-table` : undefined}
            accessibilityRole="list"
            style={{
              backgroundColor: colors.surfaceSunken,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="micro" color="textMuted">
                {t('progress.date')}
              </AppText>
              <AppText variant="micro" color="textMuted">
                {t('progress.value')}
              </AppText>
            </View>
            {[...series.points].reverse().map((p) => (
              <View
                key={p.result_id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline,
                  paddingTop: spacing.xs,
                }}
              >
                <AppText variant="caption">{new Date(p.performed_at).toLocaleDateString(locale)}</AppText>
                <AppText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(p.value)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
