/**
 * Living reference of the design system. Registered only when __DEV__ is true
 * (see the root layout), so it never ships in production builds.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { ProfileMap, ProfileMapLegend } from '@/components/charts/ProfileMap';
import { SeriesCard } from '@/features/insights/SeriesCard';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { Card } from '@/components/layout/Card';
import { Checkbox } from '@/components/forms/Checkbox';
import { Icon, type IconName } from '@/design-system/Icon';
import { Divider, ListRow, SectionHeader } from '@/components/layout/ListRow';
import { Logo } from '@/components/brand/Logo';
import { Pictogram, type PictogramName } from '@/components/brand/Pictogram';

const PICTOS: PictogramName[] = ['resting_hr', 'hrr_step', 'cooper_12min', 'pushups', 'pulls', 'chair_stand_30s', 'plank', 'sit_reach', 'single_leg_stance', 'body_measurements', 'brisk_walk', 'steady_cardio', 'intervals', 'sit_to_stand', 'balance_hold', 'mobility_flow', 'daily_steps', 'wind_down'];
import { Notice } from '@/components/feedback/Notice';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { useTheme } from '@/design-system/ThemeProvider';
import type { ThemeColors, TypographyVariant } from '@/design-system/tokens';

const ICONS: IconName[] = [
  'today', 'profile', 'settings', 'chevronRight', 'offline', 'alert', 'check', 'unknown', 'cardio', 'recovery',
  'strength', 'endurance', 'mobility', 'balance', 'body', 'lifestyle', 'sun', 'moon', 'device', 'globe', 'shield', 'info',
];

export default function DevGallery() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [checked, setChecked] = useState(true);
  const win = useWindowDimensions();
  const [contentW, setContentW] = useState(0);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('dev.galleryTitle'),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.brand,
          headerTitleStyle: { color: colors.text },
        }}
      />
      <Screen header>
        <View style={{ gap: spacing.xxl }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="gallery-pictograms">
            {PICTOS.map((n) => (
              <View key={n} style={{ alignItems: 'center', width: 76, gap: 2 }}>
                <Pictogram name={n} size={56} />
                <AppText variant="micro" color="textMuted" numberOfLines={1}>{n}</AppText>
              </View>
            ))}
            {PICTOS.slice(0, 6).map((n) => (
              <Pictogram key={`bare-${n}`} name={n} size={40} variant="bare" />
            ))}
          </View>
          <Logo size={40} />
          <AppText variant="caption" color="textMuted" testID="layout-probe"
            onLayout={(e) => setContentW(Math.round(e.nativeEvent.layout.width))}>
            {t('dev.galleryHint')} Scheme: {theme.scheme}. Window {Math.round(win.width)} px, content {contentW} px.
          </AppText>

          <View style={{ gap: spacing.md }}>
            {/* Illustrative sample values for design review only (dev build); never shown as user data. */}
            <SectionHeader title="Charts (sample data)" />
            <Card>
              <ProfileMap
                items={['cardio', 'recovery', 'strength', 'muscularEndurance', 'mobility', 'balance', 'body', 'lifestyle'].map(
                  (k, i) => ({
                    key: k,
                    label: k,
                    coverage: (['current', 'dated', 'reported', 'unknown'] as const)[i % 4]!,
                    level: [0.66, null, 0.43, null, 1, null, 0.8, 0.5][i] ?? null,
                  }),
                )}
              />
              <ProfileMapLegend />
            </Card>
            <SeriesCard
              title="Sample series"
              unit="bpm"
              provenance="calculated"
              series={{
                protocol_key: 'hrr_step|1|recovery_mode=passive_seated',
                points: [21, 24, 23, 27, 30].map((v, i) => ({
                  result_id: `s${i}`,
                  performed_at: new Date(2026, 5 + i, 1).toISOString(),
                  value: v,
                })),
                change_vs_previous: 3,
                change_vs_first: 9,
              }}
            />
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Colour tokens" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(Object.keys(colors) as (keyof ThemeColors)[]).map((k) => (
                <View key={k} style={{ width: 96, gap: 4 }}>
                  <View
                    style={{
                      height: 40,
                      borderRadius: radius.sm,
                      backgroundColor: colors[k],
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                  <AppText variant="caption">{k}</AppText>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Typography" />
            {(Object.keys(typography) as TypographyVariant[]).map((v) => (
              <AppText key={v} variant={v}>
                {v} — Știință, сила, strength
              </AppText>
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Icons" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
              {ICONS.map((n) => (
                <View key={n} style={{ alignItems: 'center', width: 64, gap: 4 }}>
                  <Icon name={n} color={colors.text} />
                  <AppText variant="caption" color="textMuted" style={{ fontSize: 10 }}>
                    {n}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Buttons" />
            <Button label="Primary" onPress={() => undefined} />
            <Button variant="secondary" label="Secondary" onPress={() => undefined} />
            <Button variant="ghost" label="Ghost" onPress={() => undefined} />
            <Button label="Loading" loading onPress={() => undefined} />
            <Button label="Disabled" disabled onPress={() => undefined} />
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Inputs" />
            <TextField label="Text field" hint="Helper text" placeholder="Placeholder" />
            <TextField label="With error" value="abc" error="Validation message" />
            <Checkbox checked={checked} onChange={setChecked} label="Checkbox with a longer label that wraps" />
            <SegmentedControl
              accessibilityLabel="Segmented"
              value={seg}
              onChange={setSeg}
              segments={[
                { value: 'a', label: 'Automatic' },
                { value: 'b', label: 'Light' },
                { value: 'c', label: 'Dark' },
              ]}
            />
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Cards, rows and notices" />
            <Card>
              <ListRow icon="globe" title="Pressable row" subtitle="Subtitle" detail="Detail" onPress={() => undefined} />
              <Divider />
              <ListRow title="Static row" detail="Value" />
            </Card>
            <Notice tone="info" message="Info notice" />
            <Notice tone="success" message="Success notice" />
            <Notice tone="error" message="Error notice" />
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="States" />
            <Card>
              <LoadingState />
            </Card>
            <Card>
              <Skeleton width="60%" height={20} />
              <Skeleton />
              <Skeleton width="80%" />
            </Card>
            <Card>
              <EmptyState
                title="Nothing here yet"
                body="Empty states explain what will appear and how to get there."
                action={{ label: 'Primary action', onPress: () => undefined }}
              />
            </Card>
            <Card>
              <ErrorState error={new ApiError('network_error', 'x', null)} onRetry={() => undefined} />
            </Card>
            <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
              <OfflineBanner state="offline" onRetry={() => undefined} />
            </View>
          </View>
        </View>
      </Screen>
    </>
  );
}
