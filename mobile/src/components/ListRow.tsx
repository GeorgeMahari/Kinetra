import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** A settings-style row: icon, title, optional detail on the right, chevron when pressable. */
export function ListRow({
  icon,
  title,
  subtitle,
  detail,
  onPress,
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  detail?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
      {icon ? <Icon name={icon} color={colors.brand} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {detail ? (
        <AppText variant="caption" color="textMuted">
          {detail}
        </AppText>
      ) : null}
      {onPress ? <Icon name="chevronRight" size={18} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
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
