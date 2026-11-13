/**
 * Connected data: read-only Health Connect import (Android development/production builds).
 * The device status and the server-side imported data are independent, so imported data can
 * be reviewed and removed from any platform, including Expo Go and iOS.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Divider, ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import type { ImportKind } from '@/features/devices/mapping';
import {
  useConnectedDataActions,
  useHealthConnectDevice,
  useImportedData,
} from '@/features/devices/useConnectedData';
import { useTheme } from '@/theme/ThemeProvider';

type Message = { tone: 'error' | 'success' | 'info'; message: string } | null;
const KINDS: ImportKind[] = ['resting_hr_bpm', 'weight_kg', 'steps_daily'];

export default function ConnectedData() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
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

  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <Card>
          <AppText variant="heading">{t('devices.title')}</AppText>
          <AppText>{t('devices.intro')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('devices.howUsed')}
          </AppText>
        </Card>

        <Card>
          <AppText variant="heading">{t('devices.statusTitle')}</AppText>
          {device.isPending ? <LoadingState /> : null}
          {device.isError ? <ErrorState error={device.error} onRetry={() => void device.refetch()} /> : null}
          {availability && availability !== 'available' ? (
            <AppText testID="hc-status" color="textMuted">
              {t(`devices.status.${availability}`)}
            </AppText>
          ) : null}
          {availability === 'available' ? (
            <View style={{ gap: spacing.md }}>
              <AppText testID="hc-permissions">{t('devices.permissions', { granted })}</AppText>
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
          ) : null}
          {msg && msgFor === 'device' ? <Notice testID="hc-message" {...msg} /> : null}
        </Card>

        <Card>
          <AppText variant="heading">{t('devices.importedTitle')}</AppText>
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
              {KINDS.map((k, i) => {
                const m = imported.data.latest[k];
                if (!m) return null;
                return (
                  <View key={k}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      testID={`latest-${k}`}
                      title={t(`devices.latest.${k}`)}
                      subtitle={t('devices.source')}
                      detail={t('devices.latestValue', {
                        value: num(m.value),
                        unit: t(`devices.units.${k}`),
                        date: date(m.measured_at),
                      })}
                    />
                  </View>
                );
              })}

              <View style={{ height: spacing.sm }} />
              {!confirmingRemove ? (
                <Button
                  testID="hc-remove"
                  variant="ghost"
                  label={t('devices.remove')}
                  onPress={() => setConfirmingRemove(true)}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <AppText variant="caption" color="textMuted">
                    {t('devices.removeWarning')}
                  </AppText>
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
                </View>
              )}
            </View>
          ) : null}
          {msg && msgFor === 'imported' ? <Notice testID="imported-message" {...msg} /> : null}
        </Card>
      </View>
    </Screen>
  );
}
