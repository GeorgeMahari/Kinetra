/**
 * Progress calendar: one month at a time, Monday first. A day on which results were saved is
 * filled in the brand green; today has a ring. Tapping a marked day lists what was recorded.
 * Colour is never the only signal: marked days have a bold number and say how many results they hold
 * to screen readers, and the legend says what green means.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { Card } from '@/components/layout/Card';
import { Icon } from '@/design-system/Icon';
import { haptic } from '@/design-system/motion';
import { useAssessmentsApi } from '@/features/assessments/useAssessments';
import { useTheme } from '@/design-system/ThemeProvider';

import { dayKey, groupByDay, monthGrid, monthWindow, weekdayNames, type DayKey } from './calendar';

function useActivity(year: number, month: number) {
  const { api, userId } = useAssessmentsApi();
  const { since, until } = monthWindow(year, month);
  // Key starts with 'assessments' so saving or deleting a result refreshes the calendar.
  return useQuery({
    queryKey: ['assessments', 'activity', userId, year, month],
    queryFn: () => api.activity(since, until),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function ActivityCalendar({ now = new Date() }: { now?: Date }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<DayKey | null>(null);
  const activity = useActivity(cursor.year, cursor.month);
  const days = groupByDay(activity.data ?? []);
  const today = dayKey(now);
  const locale = i18n.resolvedLanguage;
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const activeDays = [...days.keys()].length;

  const shift = (delta: number) => {
    haptic('select');
    setSelected(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const selectedTests = selected ? (days.get(selected) ?? []) : [];
  // Test names are looked up by runtime keys; typing them against the whole tree is too deep.
  const testName = (code: string) => (t as unknown as (key: string) => string)(`assess.tests.${code}.name`);

  return (
    <View testID="activity-calendar">
      <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <NavButton label={t('progress.calendar.previous')} onPress={() => shift(-1)} flip testID="calendar-prev" />
        <View style={{ alignItems: 'center' }}>
          <AppText variant="heading" testID="calendar-month" style={{ textTransform: 'capitalize' }}>
            {monthLabel}
          </AppText>
          <AppText variant="caption" color="textMuted" testID="calendar-count">
            {t('progress.calendar.activeDays', { count: activeDays })}
          </AppText>
        </View>
        <NavButton
          label={t('progress.calendar.next')}
          onPress={() => shift(1)}
          disabled={isCurrentMonth}
          testID="calendar-next"
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row' }}>
          {weekdayNames(locale).map((w, i) => (
            <AppText
              key={i}
              variant="caption"
              color="textMuted"
              style={{ flex: 1, textAlign: 'center', textTransform: 'uppercase' }}
              importantForAccessibility="no"
            >
              {w}
            </AppText>
          ))}
        </View>
        {monthGrid(cursor.year, cursor.month).map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={{ flex: 1, aspectRatio: 1 }} />;
              const count = days.get(day)?.length ?? 0;
              const marked = count > 0;
              const isToday = day === today;
              const isSelected = day === selected;
              const date = Number(day.slice(8));
              const spoken = new Date(cursor.year, cursor.month, date).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
              });
              return (
                <View key={day} style={{ flex: 1, aspectRatio: 1, padding: 2 }}>
                  <Pressable
                    testID={`calendar-day-${day}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: !marked }}
                    accessibilityLabel={`${spoken}: ${
                      marked ? t('progress.calendar.results', { count }) : t('progress.calendar.noData')
                    }`}
                    disabled={!marked}
                    onPress={() => {
                      haptic('select');
                      setSelected(isSelected ? null : day);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      backgroundColor: marked ? colors.brand : 'transparent',
                      borderWidth: isToday || isSelected ? 2 : 0,
                      borderColor: isSelected ? colors.text : colors.brandText,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <AppText
                      variant="label"
                      style={{
                        color: marked ? colors.onBrand : colors.textMuted,
                        fontWeight: marked || isToday ? '700' : '400',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {date}
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: colors.brand }} />
        <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
          {t('progress.calendar.legend')}
        </AppText>
      </View>

      {selected && selectedTests.length > 0 ? (
        <Animated.View
          key={selected}
          entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
          testID="calendar-day-details"
          style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <AppText variant="label">
            {new Date(`${selected}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </AppText>
          {[...new Set(selectedTests)].map((code) => {
            const n = selectedTests.filter((c) => c === code).length;
            return (
              <AppText key={code} variant="caption" color="textMuted">
                {n > 1 ? `${testName(code)} × ${n}` : testName(code)}
              </AppText>
            );
          })}
        </Animated.View>
      ) : null}
      </Card>
    </View>
  );
}

function NavButton({
  label,
  onPress,
  disabled,
  flip,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  flip?: boolean;
  testID?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.brandSoft : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}
    >
      <View style={flip ? { transform: [{ rotate: '180deg' }] } : undefined}>
        <Icon name="chevronRight" size={22} color={colors.brandText} />
      </View>
    </Pressable>
  );
}
