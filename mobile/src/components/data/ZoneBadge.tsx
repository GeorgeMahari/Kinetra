/**
 * A health zone (D42) as a pill: icon + word on a soft tint. Shape and word carry the meaning, so it
 * never depends on colour alone; "not assessed" stays neutral.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Zone } from '@/api/plan';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export const ZONE_STYLE: Record<Zone, { icon: IconName; ink: keyof ThemeColors; soft: keyof ThemeColors }> = {
  attention: { icon: 'alert', ink: 'zoneAttention', soft: 'zoneAttentionSoft' },
  fine: { icon: 'check', ink: 'zoneFine', soft: 'zoneFineSoft' },
  strength: { icon: 'flame', ink: 'zoneStrength', soft: 'zoneStrengthSoft' },
  unknown: { icon: 'unknown', ink: 'unknown', soft: 'surfaceSunken' },
};

export function ZoneBadge({ zone, size = 'md' }: { zone: Zone; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const s = ZONE_STYLE[zone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: size === 'sm' ? 2 : 4,
        paddingHorizontal: size === 'sm' ? spacing.xs + 2 : spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors[s.soft],
        alignSelf: 'flex-start',
      }}
    >
      <Icon name={s.icon} size={size === 'sm' ? 12 : 14} color={colors[s.ink]} />
      <AppText variant={size === 'sm' ? 'micro' : 'caption'} color={s.ink} style={{ fontWeight: '600' }}>
        {t(`plan.zones.${zone}`)}
      </AppText>
    </View>
  );
}
