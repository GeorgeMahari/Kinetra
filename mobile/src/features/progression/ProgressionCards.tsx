import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import type { Progression } from '@/api/progression';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/design-system/AppText';
import { BadgeArt } from '@/features/progression/BadgeArt';
import { PressableScale } from '@/design-system/motion';
import { isPictogram, Pictogram } from '@/components/brand/Pictogram';
import { Button } from '@/components/forms/Button';
import { Card } from '@/components/layout/Card';
import { Stepper } from '@/components/forms/Choice';
import { Icon } from '@/design-system/Icon';
import { SectionHeader } from '@/components/layout/ListRow';
import { Notice } from '@/components/feedback/Notice';
import { formatValue } from '@/features/assessments/ResultView';
import { protocolLabel } from '@/features/insights/present';
import { useTheme } from '@/design-system/ThemeProvider';

import { Meter } from './Meter';
import { useSaveCheckin } from './useProgression';

export function LevelCard({ p }: { p: Progression }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const span = p.next_level_at != null ? p.next_level_at - p.level_floor : 1;
  const into = p.next_level_at != null ? p.points - p.level_floor : 1;
  // The trail-head panel: the level as a big figure on the forest shell, the streak as a chip.
  return (
    <Animated.View
      entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)}
      testID="level-card"
      style={{
        backgroundColor: colors.shell,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: spacing.md,
        }}
      >
        <View accessible accessibilityLabel={t('progression.level', { level: p.level })} testID="level-number">
          <AppText variant="micro" color="onShellMuted">
            {t('progressView.levelLabel')}
          </AppText>
          <AppText variant="metric" color="onShell">
            {p.level}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Icon name="flame" size={16} color={colors.onShell} />
          <AppText variant="caption" color="onShell">
            {t('progression.streak', { count: p.streak_weeks })}
          </AppText>
        </View>
      </View>
      <Meter
        tone="shell"
        value={into}
        max={span}
        label={t('progression.level', { level: p.level })}
        testID="level-meter"
      />
      <AppText variant="caption" color="onShell" testID="level-points">
        {p.next_level_at != null
          ? t('progression.toNext', {
              points: p.points,
              remaining: p.next_level_at - p.points,
              next: p.level + 1,
            })
          : t('progression.maxLevel', { points: p.points })}
      </AppText>
      <AppText variant="caption" color="onShellMuted">
        {t('progression.pointsHelp')}
      </AppText>
    </Animated.View>
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
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <AppText variant="label">{label}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {o.met ? <Icon name="check" size={16} color={colors.progress} /> : null}
                <AppText variant="caption" color="textMuted">
                  {o.met
                    ? t('progression.met')
                    : t('progression.progressOf', {
                        current: o.current,
                        target: o.target,
                      })}
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
  const [msg, setMsg] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
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
          <Stepper
            testID="checkin-sessions"
            label={t('progression.sessions')}
            value={sessions}
            onChange={setSessions}
          />
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
                await save({
                  sessions: sessions ?? 0,
                  strength_sessions: strength,
                  active_minutes: minutes,
                });
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
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={t('progression.pbTitle')} caption={t('progression.pbHint')} />
      {p.personal_bests.length === 0 ? (
        <AppText variant="caption" color="textMuted">
          {t('progression.pbEmpty')}
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {p.personal_bests.map((b) => {
            const protocol = protocolLabel(t, b.protocol_key);
            const value = formatValue(
              {
                code: b.indicator,
                value: b.value,
                unit: b.unit,
                provenance: 'measured',
                interpretation: null,
                notes: [],
                reference_ids: [],
              },
              i18n.resolvedLanguage,
            );
            return (
              <PressableScale
                key={`${b.test_code}-${b.protocol_key}-${b.indicator}`}
                testID={`pb-${b.indicator}`}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/result/[id]',
                    params: { id: b.result_id },
                  })
                }
                highlight={{ base: colors.surface, active: colors.brandSoft }}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  padding: spacing.md,
                  gap: spacing.xs,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {isPictogram(b.test_code) ? <Pictogram name={b.test_code} size={34} /> : null}
                  <Icon name="flame" size={16} color={colors.dataInk} />
                </View>
                <AppText variant="metricSm" style={{ fontSize: 24, lineHeight: 28 }}>
                  {value}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {t(`assess.indicators.${b.indicator}` as 'assess.indicators.bmi')}
                </AppText>
                <AppText variant="micro" color="textMuted" numberOfLines={2}>
                  {[protocol, new Date(b.performed_at).toLocaleDateString(i18n.resolvedLanguage)]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Achievements as a badge collection: earned first (newest first), then the rest in catalogue order. */
export function AchievementsList({ p, limit }: { p: Progression; limit?: number }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const sorted = [...p.achievements].sort((a, b) =>
    a.earned_at && b.earned_at ? b.earned_at.localeCompare(a.earned_at) : a.earned_at ? -1 : b.earned_at ? 1 : 0,
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {sorted.slice(0, limit ?? sorted.length).map((a, i) => {
        const earned = !!a.earned_at;
        return (
          <Animated.View
            key={a.code}
            entering={FadeInDown.delay(Math.min(i, 10) * 40)
              .duration(300)
              .reduceMotion(ReduceMotion.System)}
            style={{ flexBasis: '47%', flexGrow: 1 }}
          >
            <View
              testID={`achievement-${a.code}`}
              accessible
              accessibilityLabel={`${t(`progression.achievements.${a.code}.name`)}: ${earned ? t('progression.earnedOn', { date: new Date(a.earned_at!).toLocaleDateString(i18n.resolvedLanguage) }) : t('progression.notYet')}`}
              style={{
                minHeight: 168,
                padding: spacing.md,
                gap: spacing.xs,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: earned ? colors.border : colors.hairline,
                backgroundColor: earned ? colors.surface : 'transparent',
                ...(earned ? elevation.card : null),
              }}
            >
              <BadgeArt code={a.code} earned={earned} size={52} />
              <AppText variant="label" color={earned ? 'text' : 'textMuted'} numberOfLines={2}>
                {t(`progression.achievements.${a.code}.name`)}
              </AppText>
              <AppText variant="micro" color="textMuted" numberOfLines={3} style={{ flex: 1 }}>
                {t(`progression.achievements.${a.code}.body`)}
              </AppText>
              <AppText variant="micro" color={earned ? 'dataInk' : 'unknown'}>
                {earned ? new Date(a.earned_at!).toLocaleDateString(i18n.resolvedLanguage) : t('progression.notYet')}
              </AppText>
            </View>
          </Animated.View>
        );
      })}
      {(limit ?? sorted.length) % 2 === 1 ? <View style={{ flexBasis: '47%', flexGrow: 1 }} /> : null}
    </View>
  );
}
