import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { iconSize, type ThemeColors } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './motion';

/**
 * A grouped-list row: icon on a soft tile, title and optional subtitle, optional detail on the right,
 * chevron when pressable. `tone="danger"` is for destructive destinations: icon and title change
 * together, so the meaning never rests on colour alone (the icon itself also says it).
 */
export function ListRow({
  icon,
  title,
  subtitle,
  detail,
  onPress,
  testID,
  tone = 'default',
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  detail?: string;
  onPress?: () => void;
  testID?: string;
  tone?: 'default' | 'danger';
}) {
  const { colors, spacing, radius } = useTheme();
  const ink: keyof ThemeColors = tone === 'danger' ? 'danger' : 'brandText';
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 }}>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm + 2,
            backgroundColor: tone === 'danger' ? colors.zoneAttentionSoft : colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={iconSize.md} color={colors[ink]} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" color={tone === 'danger' ? 'danger' : 'text'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {detail ? (
        <AppText variant="caption" color="textMuted" style={{ maxWidth: '45%', textAlign: 'right' }} numberOfLines={2}>
          {detail}
        </AppText>
      ) : null}
      {onPress ? <Icon name="chevronRight" size={iconSize.sm + 2} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      hapticKind="select"
      highlight={{ base: colors.surface, active: colors.brandSoft }}
      style={{ marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md }}
    >
      {content}
    </PressableScale>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.hairline, marginLeft: inset }} />;
}

/**
 * A titled group of rows on one surface (the grouped-list pattern), with hairline separators inset
 * past the icons. `title` sits above the surface, `footer` below it.
 */
export function ListGroup({
  title,
  footer,
  children,
  testID,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { colors, spacing, radius, elevation } = useTheme();
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      {title ? (
        <AppText variant="micro" color="textMuted" style={{ textTransform: 'uppercase', marginLeft: spacing.xs }} accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          ...elevation.card,
        }}
      >
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <Divider inset={48} /> : null}
            <View style={{ paddingVertical: spacing.xs }}>{child}</View>
          </View>
        ))}
      </View>
      {footer ? (
        <AppText variant="caption" color="textMuted" style={{ marginHorizontal: spacing.xs }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="heading">{title}</AppText>
      {caption ? (
        <AppText variant="caption" color="textMuted">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}
