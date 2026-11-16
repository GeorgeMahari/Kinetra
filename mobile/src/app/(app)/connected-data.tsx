/**
 * Connected data: read-only Health Connect import (Android development/production builds).
 * The device status and the server-side imported data are independent, so imported data can
 * be reviewed and removed from any platform, including Expo Go and iOS.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/design-system/Icon';
import { FadeInItem } from '@/design-system/motion';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import type { ImportKind } from '@/features/devices/mapping';
import {
  useConnectedDataActions,
  useHealthConnectDevice,
  useImportedData,
} from '@/features/devices/useConnectedData';
import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize, type ThemeColors } from '@/design-system/tokens';

type Message = { tone: 'error' | 'success' | 'info'; message: string } | null;
const KINDS: ImportKind[] = ['resting_hr_bpm', 'weight_kg', 'steps_daily'];
const KIND_ICON: Record<ImportKind, IconName> = { resting_hr_bpm: 'cardio', weight_kg: 'body', steps_daily: 'endurance' };

function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const { colors, spacing, radius, elevation } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <AppText variant="micro" color="textMuted" style={{ textTransform: 'uppercase', marginLeft: spacing.xs }} accessibilityRole="header">
        {title}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          ...elevation.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Metric({ value, label, testID }: { value: string; label: string; testID?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flex: 1, gap: spacing.xxs }} testID={testID}>
      <AppText variant="metricSm" color="dataInk">
        {value}
      </AppText>
      <AppText variant="micro" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

export default function ConnectedData() {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const device = useHealthConnectDevice();
  const imported = useImportedData();
  const actions = useConnectedDataActions();
  const [busy, setBusy] = useState<'allow' | 'sync' | 'remove' | null>(null);
  const [msg, setMsg] = useState<Message>(null);
  const [msgFor, setMsgFor] = useState<'device' | 'imported'>('device');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const lang = i18n.resolvedLanguage;
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang);
  const num = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(v);

  const run = async (kind: 'allow' | 'sync' | 'remove', fn: () => Promise<Message>) => {
    setBusy(kind);
    setMsg(null);
    setMsgFor(kind === 'remove' ? 'imported' : 'device');
    try {
      setMsg(await fn());
    } catch (err) {
      setMsg({ tone: 'error', message: errorMessage(t, err) });
    } finally {
      setBusy(null);
    }
  };

  const availability = device.data?.availability;
  const granted = device.data?.granted ?? 0;
  const status: { key: string; icon: IconName; ink: keyof ThemeColors; soft: keyof ThemeColors } | null = !availability
    ? null
    : availability !== 'available'
      ? { key: 'unavailable', icon: 'offline', ink: 'unknown', soft: 'surfaceSunken' }
      : granted >= 3
        ? { key: 'connected', icon: 'check', ink: 'zoneFine', soft: 'zoneFineSoft' }
        : granted > 0
          ? { key: 'partial', icon: 'alert', ink: 'zoneAttention', soft: 'zoneAttentionSoft' }
          : { key: 'notConnected', icon: 'device', ink: 'textMuted', soft: 'surfaceSunken' };
  const summary = imported.data?.summary;

  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <FadeInItem index={0}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: colors.shell,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="device" size={iconSize.lg} color={colors.onShell} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="title">{t('devices.title')}</AppText>
              <AppText color="textMuted">{t('devices.intro')}</AppText>
            </View>
          </View>
        </FadeInItem>

        <FadeInItem index={1}>
          <Section title={t('devices.statusTitle')} testID="hc-panel">
            {device.isPending ? <LoadingState /> : null}
            {device.isError ? <ErrorState error={device.error} onRetry={() => void device.refetch()} /> : null}
            {status ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  alignSelf: 'flex-start',
                  paddingVertical: 4,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: colors[status.soft],
                }}
                testID={`hc-state-${status.key}`}
              >
                <Icon name={status.icon} size={iconSize.sm - 2} color={colors[status.ink]} />
                <AppText variant="caption" color={status.ink} style={{ fontWeight: '600' }}>
                  {tr(`redesignProfile.devices.${status.key}`)}
                </AppText>
              </View>
            ) : null}
            {availability && availability !== 'available' ? (
              <AppText testID="hc-status" color="textMuted">
                {t(`devices.status.${availability}`)}
              </AppText>
            ) : null}
            {availability === 'available' ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Metric value={`${granted}/3`} label={tr('redesignProfile.devices.typesAllowed')} />
                  {summary ? <Metric value={num(summary.count)} label={tr('redesignProfile.devices.valuesImported')} /> : null}
                </View>
                <AppText testID="hc-permissions" variant="caption" color="textMuted">
                  {t('devices.permissions', { granted })}
                </AppText>
                <View style={{ gap: spacing.sm }}>
                  {granted < 3 ? (
                    <Button
                      testID="hc-allow"
                      label={t('devices.allow')}
                      loading={busy === 'allow'}
                      onPress={() =>
                        run('allow', async () => {
                          const n = await actions.allow();
                          return n === 0 ? { tone: 'info', message: t('devices.noneGranted') } : null;
                        })
                      }
                    />
                  ) : null}
                  {granted > 0 ? (
                    <Button
                      testID="hc-sync"
                      label={t('devices.sync')}
                      variant={granted < 3 ? 'secondary' : 'primary'}
                      loading={busy === 'sync'}
                      onPress={() =>
                        run('sync', async () => {
                          const r = await actions.sync();
                          return {
                            tone: 'success',
                            message:
                              r.inserted + r.updated === 0
                                ? t('devices.syncNothing')
                                : t('devices.syncResult', { inserted: r.inserted, updated: r.updated }),
                          };
                        })
                      }
                    />
                  ) : null}
                  <Button
                    testID="hc-settings"
                    variant="ghost"
                    label={t('devices.openSettings')}
                    onPress={actions.openSettings}
                  />
                </View>
              </View>
            ) : null}
            {msg && msgFor === 'device' ? <Notice testID="hc-message" {...msg} /> : null}
          </Section>
        </FadeInItem>

        <FadeInItem index={2}>
          <Section title={t('devices.importedTitle')}>
            {imported.isPending ? <LoadingState /> : null}
            {imported.isError ? <ErrorState error={imported.error} onRetry={() => void imported.refetch()} /> : null}
            {imported.data && imported.data.summary.count === 0 ? (
              <AppText testID="imported-none" color="textMuted">
                {t('devices.importedNone')}
              </AppText>
            ) : null}
            {imported.data && imported.data.summary.count > 0 ? (
              <View style={{ gap: spacing.md }}>
                <AppText testID="imported-count" variant="caption" color="textMuted">
                  {t('devices.importedCount', {
                    count: imported.data.summary.count,
                    date: imported.data.summary.last_imported_at ? date(imported.data.summary.last_imported_at) : '—',
                  })}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {KINDS.map((k) => {
                    const m = imported.data.latest[k];
                    if (!m) return null;
                    return (
                      <View
                        key={k}
                        testID={`latest-${k}`}
                        accessible
                        style={{
                          flexGrow: 1,
                          flexBasis: '45%',
                          padding: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: colors.surfaceSunken,
                          gap: spacing.xs,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Icon name={KIND_ICON[k]} size={iconSize.sm} color={colors.dataInk} />
                          <AppText variant="micro" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                            {t(`devices.latest.${k}`)}
                          </AppText>
                        </View>
                        <AppText variant="metricSm">{`${num(m.value)} ${t(`devices.units.${k}`)}`}</AppText>
                        <AppText variant="micro" color="textMuted">
                          {date(m.measured_at)}
                        </AppText>
                        <AppText variant="micro" color="textMuted">
                          {t('devices.source')}
                        </AppText>
                      </View>
                    );
                  })}
                </View>

                {!confirmingRemove ? (
                  <Button
                    testID="hc-remove"
                    variant="ghost"
                    label={t('devices.remove')}
                    onPress={() => setConfirmingRemove(true)}
                  />
                ) : (
                  <Animated.View
                    entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
                    style={{
                      gap: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: colors.danger,
                    }}
                  >
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Icon name="alert" size={iconSize.sm + 2} color={colors.danger} />
                      <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                        {t('devices.removeWarning')}
                      </AppText>
                    </View>
                    <Button
                      testID="hc-remove-confirm"
                      label={t('devices.removeConfirm')}
                      loading={busy === 'remove'}
                      onPress={() =>
                        run('remove', async () => {
                          await actions.remove();
                          setConfirmingRemove(false);
                          return { tone: 'success', message: t('devices.removed') };
                        })
                      }
                    />
                    <Button variant="secondary" label={t('devices.cancel')} onPress={() => setConfirmingRemove(false)} />
                  </Animated.View>
                )}
              </View>
            ) : null}
            {msg && msgFor === 'imported' ? <Notice testID="imported-message" {...msg} /> : null}
          </Section>
        </FadeInItem>

        <FadeInItem index={3}>
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}
          >
            <Icon name="info" size={iconSize.sm + 2} color={colors.textMuted} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{tr('redesignProfile.devices.privacyTitle')}</AppText>
              <AppText variant="caption" color="textMuted">
                {t('devices.howUsed')}
              </AppText>
            </View>
          </View>
        </FadeInItem>
      </View>
    </Screen>
  );
}
