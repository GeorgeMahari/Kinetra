import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/design-system/ThemeProvider';

import { AppText } from '@/design-system/AppText';
import { Button } from './Button';
import { haptic } from '@/design-system/motion';

const RING = 216;
const STROKE = 10;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Countdown (fixed-duration tests) or stopwatch (hold tests). Uses wall-clock time so it stays
 * accurate even if renders are delayed. `onStop` reports elapsed seconds for stopwatch mode.
 *
 * Drawn as a ring: it fills towards the limit (the countdown's length or the stopwatch's cap);
 * an uncapped stopwatch sweeps once a minute. The ring follows the same 200 ms ticks as the
 * digits, so nothing animates while the timer is idle. A success haptic marks the limit.
 */
export function Timer({
  mode,
  seconds = 0,
  capSeconds,
  onStop,
}: {
  mode: 'countdown' | 'stopwatch';
  seconds?: number;
  capSeconds?: number;
  onStop?: (elapsedSeconds: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const limit = mode === 'countdown' ? seconds : capSeconds;

  useEffect(() => {
    if (startedAt == null) return;
    tick.current = setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      if (limit != null && e >= limit) {
        setElapsed(limit);
        setStartedAt(null);
        haptic('success');
        onStop?.(limit);
      } else {
        setElapsed(e);
      }
    }, 200);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [startedAt, limit, onStop]);

  const running = startedAt != null;
  const finished = !running && limit != null && elapsed >= limit;
  const display = mode === 'countdown' ? seconds - elapsed : elapsed;
  const fraction = limit ? Math.min(1, elapsed / limit) : (elapsed % 60) / 60;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      testID="timer"
      style={{
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.surfaceSunken} strokeWidth={STROKE} fill="none" />
          {fraction > 0 ? (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={finished ? colors.progress : colors.dataInk}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={[circumference, circumference]}
              strokeDashoffset={circumference * (1 - fraction)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          ) : null}
        </Svg>
        <AppText
          testID="timer-display"
          variant={finished && mode === 'countdown' ? 'title' : 'display'}
          accessibilityLiveRegion="polite"
          style={{ fontVariant: ['tabular-nums'], textAlign: 'center' }}
          color={finished ? 'progress' : 'text'}
        >
          {finished && mode === 'countdown' ? t('assess.timer.done') : formatClock(display)}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {running ? (
          <Button
            testID="timer-stop"
            variant="secondary"
            label={t('assess.timer.stop')}
            onPress={() => {
              const e = (Date.now() - (startedAt ?? Date.now())) / 1000;
              setStartedAt(null);
              setElapsed(e);
              onStop?.(Math.floor(e));
            }}
          />
        ) : (
          <Button
            testID="timer-start"
            label={t('assess.timer.start')}
            onPress={() => {
              setElapsed(0);
              setStartedAt(Date.now());
            }}
          />
        )}
        {!running && elapsed > 0 ? (
          <Button variant="ghost" label={t('assess.timer.reset')} onPress={() => setElapsed(0)} />
        ) : null}
      </View>
    </View>
  );
}
