import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Countdown (fixed-duration tests) or stopwatch (hold tests). Uses wall-clock time so it stays
 * accurate even if renders are delayed. `onStop` reports elapsed seconds for stopwatch mode.
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
      <AppText
        testID="timer-display"
        variant="display"
        accessibilityLiveRegion="polite"
        style={{ fontVariant: ['tabular-nums'] }}
        color={finished ? 'progress' : 'text'}
      >
        {finished && mode === 'countdown' ? t('assess.timer.done') : formatClock(display)}
      </AppText>
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
