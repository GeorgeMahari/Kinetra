/**
 * A measurement that counts up to its value on arrival (≈ 0.7 s, ease-out), then rests. The final text
 * is always the exact, formatted value; under Reduce Motion it appears at once. Screen readers get the
 * final value only, never the intermediate frames.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText, type AppTextProps } from '@/components/AppText';

export function AnimatedNumber({
  value,
  format,
  duration = 700,
  ...text
}: { value: number; format: (v: number) => string; duration?: number } & Omit<AppTextProps, 'children'>) {
  const reduced = useReducedMotion();
  const animate = !reduced && Number.isFinite(value);
  const [shown, setShown] = useState(0);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    if (!animate) return undefined;
    const start = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      setShown(k === 1 ? value : value * eased);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [value, animate, duration]);
  return (
    <AppText variant="metric" {...text} accessibilityLabel={format(value)}>
      {format(animate ? shown : value)}
    </AppText>
  );
}
