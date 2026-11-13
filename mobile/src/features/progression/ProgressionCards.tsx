import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Progression } from '@/api/progression';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Choice';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { formatValue } from '@/features/assessments/ResultView';
import { protocolLabel } from '@/features/insights/present';
import { useTheme } from '@/theme/ThemeProvider';

import { Meter } from './Meter';
import { useSaveCheckin } from './useProgression';

export function LevelCard({ p }: { p: Progression }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const span = p.next_level_at != null ? p.next_level_at - p.level_floor : 1;
  const into = p.next_level_at != null ? p.points - p.level_floor : 1;
  return (
    <Card>
      <View testID="level-card" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="title">{t('progression.level', { level: p.level })}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('progression.streak', { count: p.streak_weeks })}
          </AppText>
        </View>
        <Meter value={into} max={span} label={t('progression.level', { level: p.level })} testID="level-meter" />
        <AppText variant="caption" color="textMuted" testID="level-points">
          {p.next_level_at != null
            ? t('progression.toNext', { points: p.points, remaining: p.next_level_at - p.points, next: p.level + 1 })
            : t('progression.maxLevel', { points: p.points })}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {t('progression.pointsHelp')}
        </AppText>
      </View>
    </Card>
  );
}

export function ObjectivesList({ p }: { p: Progression }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {p.objectives.map((o) => {
        const label = t(`progression.objectives.${o.code}`);
        return (
          <View key={o.code} testID={`objective-${o.code}`} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="label">{label}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {o.met ? <Icon name="check" size={16} color={colors.progress} /> : null}
                <AppText variant="caption" color="textMuted">
                  {o.met ? t('progression.met') : t('progression.progressOf', { current: o.current, target: o.target })}
                </AppText>
              </View>
            </View>
            <Meter value={o.current} max={o.target} label={`${label}: ${o.current} / ${o.target}`} />
          </View>
        );
      })}
    </View>
  );
}

export function WeekCard({ p }: { p: Progression }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const save = useSaveCheckin();
  const [sessions, setSessions] = useState<number | null>(p.checkin?.sessions ?? null);
  const [strength, setStrength] = useState<number | null>(p.checkin?.strength_sessions ?? null);
  const [minutes, setMinutes] = useState<number | null>(p.checkin?.active_minutes ?? null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const showStrength = p.objectives.some((o) => o.code === 'strength_sessions');

  // When the saved check-in changes (after saving or refetching), show its values.
  const [shownCheckin, setShownCheckin] = useState(p.checkin);
  if (shownCheckin !== p.checkin) {
    setShownCheckin(p.checkin);
    setSessions(p.checkin?.sessions ?? null);
    setStrength(p.checkin?.strength_sessions ?? null);
    setMinutes(p.checkin?.active_minutes ?? null);
  }

  return (
    <Card>
      <View testID="week-card" style={{ gap: spacing.lg }}>
        <SectionHeader title={t('progression.weekTitle')} caption={t('progression.objectivesHint')} />
        <ObjectivesList p={p} />
        <View style={{ gap: spacing.md }}>
          <AppText variant="label">{t('progression.checkinTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('progression.checkinHint')}
          </AppText>
          <Stepper testID="checkin-sessions" label={t('progression.sessions')} value={sessions} onChange={setSessions} />
          {showStrength ? (
            <Stepper
              testID="checkin-strength"
              label={t('progression.strengthSessions')}
              value={strength}
              onChange={setStrength}
              max={sessions ?? 21}
            />
          ) : null}
          <Stepper
            testID="checkin-minutes"
            label={t('progression.activeMinutes')}
            value={minutes}
            onChange={setMinutes}
            min={0}
            max={1200}
            step={15}
          />
          {msg ? <Notice tone={msg.tone} message={msg.message} /> : null}
          <Button
            testID="checkin-save"
            variant="secondary"
            label={t('progression.save')}
            loading={busy}
            disabled={sessions == null}
            onPress={async () => {
              setBusy(true);
              setMsg(null);
              try {
                await save({ sessions: sessions ?? 0, strength_sessions: strength, active_minutes: minutes });
                setMsg({ tone: 'success', message: t('progression.saved') });
              } catch (err) {
                setMsg({ tone: 'error', message: errorMessage(t, err) });
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </View>
    </Card>
  );
}

export function PersonalBests({ p }: { p: Progression }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={t('progression.pbTitle')} caption={t('progression.pbHint')} />
      {p.personal_bests.length === 0 ? (
        <AppText variant="caption" color="textMuted">
          {t('progression.pbEmpty')}
        </AppText>
      ) : (
        p.personal_bests.map((b) => {
          const protocol = protocolLabel(t, b.protocol_key);
          return (
            <Pressable
              key={`${b.test_code}-${b.protocol_key}-${b.indicator}`}
              testID={`pb-${b.indicator}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/result/[id]', params: { id: b.result_id } })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="label">{t(`assess.indicators.${b.indicator}` as 'assess.indicators.bmi')}</AppText>
                <AppText variant="caption" color="textMuted">
                  {[t(`assess.tests.${b.test_code}.name`), protocol, new Date(b.performed_at).toLocaleDateString(i18n.resolvedLanguage)]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <AppText variant="heading">
                {formatValue({ code: b.indicator, value: b.value, unit: b.unit, provenance: 'measured', interpretation: null, notes: [], reference_ids: [] }, i18n.resolvedLanguage)}
              </AppText>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

export function AchievementsList({ p, limit }: { p: Progression; limit?: number }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  // Earned first (newest first), then the rest in catalogue order.
  const sorted = [...p.achievements].sort((a, b) =>
    a.earned_at && b.earned_at ? b.earned_at.localeCompare(a.earned_at) : a.earned_at ? -1 : b.earned_at ? 1 : 0,
  );
  return (
    <View style={{ gap: spacing.sm }}>
      {sorted.slice(0, limit ?? sorted.length).map((a) => {
        const earned = !!a.earned_at;
        return (
          <View
            key={a.code}
            testID={`achievement-${a.code}`}
            accessible
            accessibilityLabel={`${t(`progression.achievements.${a.code}.name`)}: ${earned ? t('progression.earnedOn', { date: new Date(a.earned_at!).toLocaleDateString(i18n.resolvedLanguage) }) : t('progression.notYet')}`}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: earned ? colors.brandSoft : 'transparent',
                borderWidth: earned ? 0 : 1,
                borderStyle: 'dashed',
                borderColor: colors.unknown,
              }}
            >
              <Icon name={earned ? 'check' : 'unknown'} size={18} color={earned ? colors.brand : colors.unknown} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{t(`progression.achievements.${a.code}.name`)}</AppText>
              <AppText variant="caption" color="textMuted">
                {t(`progression.achievements.${a.code}.body`)}
              </AppText>
            </View>
            <AppText variant="caption" color={earned ? 'text' : 'unknown'}>
              {earned ? new Date(a.earned_at!).toLocaleDateString(i18n.resolvedLanguage) : t('progression.notYet')}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
