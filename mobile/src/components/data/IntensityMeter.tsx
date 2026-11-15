import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Intensity } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

const LEVEL: Record<Intensity, number> = { non_exertional: 1, submaximal: 2, maximal: 3 };

/** Intensity as 1–3 rising bars plus its word (never bars alone). */
export function IntensityMeter({ intensity, onShell = false }: { intensity: Intensity; onShell?: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const n = LEVEL[intensity];
  const on = onShell ? colors.onShell : colors.dataInk;
  const off = onShell ? 'rgba(255,255,255,0.25)' : colors.hairline;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ width: 4, height: 4 + i * 3, borderRadius: 1, backgroundColor: i <= n ? on : off }} />
        ))}
      </View>
      <AppText variant="micro" color={onShell ? 'onShellMuted' : 'textMuted'}>
        {t(`assess.intensity.${intensity}`)}
      </AppText>
    </View>
  );
}
