import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Provenance } from '@/api/assessments';
import type { ProgressSeries } from '@/api/insights';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { formatValue, ProvenanceBadge } from '@/features/assessments/ResultView';
import { useTheme } from '@/theme/ThemeProvider';

import { protocolLabel, signedChange } from './present';

/** One indicator, one protocol: latest value tile, change vs previous/first, chart, table view. */
export function SeriesCard({
  title,
  unit,
  provenance,
  series,
  testID,
}: {
  title: string;
  unit: string;
  provenance: Provenance;
  series: ProgressSeries;
  testID?: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [table, setTable] = useState(false);
  const locale = i18n.resolvedLanguage;
  const fmt = (v: number) => formatValue({ code: '', value: v, unit, provenance, interpretation: null, notes: [], reference_ids: [] }, locale) ?? '';
  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const last = series.points[series.points.length - 1]!;
  const protocol = protocolLabel(t, series.protocol_key);

  return (
    <Card>
      <View testID={testID} style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label">{title}</AppText>
            <ProvenanceBadge provenance={provenance} />
            {protocol ? (
              <AppText variant="caption" color="textMuted">
                {t('progress.protocol', { protocol })}
              </AppText>
            ) : null}
          </View>
          {/* Hero value: proportional figures, same sans as the rest. */}
          <AppText variant="title" testID={testID ? `${testID}-latest` : undefined}>
            {fmt(last.value)}
          </AppText>
        </View>

        {series.change_vs_previous == null ? (
          <AppText variant="caption" color="textMuted">
            {t('progress.noPrevious')}
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <AppText variant="caption" testID={testID ? `${testID}-delta-prev` : undefined}>
              <AppText variant="label">{signedChange(series.change_vs_previous, locale)}</AppText>{' '}
              <AppText variant="caption" color="textMuted">{t('progress.vsPrevious')}</AppText>
            </AppText>
            <AppText variant="caption">
              <AppText variant="label">{signedChange(series.change_vs_first ?? 0, locale)}</AppText>{' '}
              <AppText variant="caption" color="textMuted">{t('progress.vsFirst')}</AppText>
            </AppText>
          </View>
        )}

        <LineChart
          points={series.points.map((p) => ({ id: p.result_id, date: new Date(p.performed_at), value: p.value }))}
          format={fmt}
          formatTick={(v) => new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 'ratio' ? 2 : 1 }).format(v)}
          formatDate={fmtDate}
          accessibilityLabel={`${title}: ${series.points.map((p) => `${fmtDate(new Date(p.performed_at))} ${fmt(p.value)}`).join(', ')}`}
        />

        <Button
          variant="ghost"
          label={table ? t('progress.hideTable') : t('progress.showTable')}
          onPress={() => setTable((v) => !v)}
        />
        {table ? (
          <View testID={testID ? `${testID}-table` : undefined} accessibilityRole="list" style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" color="textMuted">{t('progress.date')}</AppText>
              <AppText variant="caption" color="textMuted">{t('progress.value')}</AppText>
            </View>
            {[...series.points].reverse().map((p) => (
              <View key={p.result_id} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs }}>
                <AppText variant="caption">{new Date(p.performed_at).toLocaleDateString(locale)}</AppText>
                <AppText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{fmt(p.value)}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
