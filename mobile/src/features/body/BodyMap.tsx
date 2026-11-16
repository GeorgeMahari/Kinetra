/**
 * The body map: a geometric figure (the same family as the trail pictograms), front or back, whose
 * areas can be tapped. Highlighted areas are filled with the health-zone colour passed in by the caller
 * (the zone of the selected dimension); everything else stays neutral. Selecting an area focuses it:
 * the figure eases its scale towards that area (no zoom under Reduce Motion).
 *
 * Illustrative only: see features/body/regions.ts.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { haptic } from '@/design-system/motion';
import { useTheme } from '@/design-system/ThemeProvider';

import type { BodyRegion } from './regions';

type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number; r: number } | { kind: 'path'; d: string };

// 200 × 400 grid. Pairs (left/right) share one region id.
const SHAPES: Record<'front' | 'back', Partial<Record<BodyRegion, Shape[]>>> = {
  front: {
    shoulders: [
      { kind: 'rect', x: 52, y: 80, w: 26, h: 26, r: 13 },
      { kind: 'rect', x: 122, y: 80, w: 26, h: 26, r: 13 },
    ],
    chest: [{ kind: 'rect', x: 72, y: 84, w: 56, h: 52, r: 14 }],
    arms: [
      { kind: 'rect', x: 44, y: 104, w: 18, h: 60, r: 9 },
      { kind: 'rect', x: 40, y: 166, w: 16, h: 60, r: 8 },
      { kind: 'rect', x: 138, y: 104, w: 18, h: 60, r: 9 },
      { kind: 'rect', x: 144, y: 166, w: 16, h: 60, r: 8 },
    ],
    core: [{ kind: 'rect', x: 76, y: 139, w: 48, h: 44, r: 10 }],
    waist: [{ kind: 'rect', x: 74, y: 186, w: 52, h: 14, r: 7 }],
    thighs: [
      { kind: 'rect', x: 74, y: 204, w: 24, h: 92, r: 12 },
      { kind: 'rect', x: 102, y: 204, w: 24, h: 92, r: 12 },
    ],
    calves: [
      { kind: 'rect', x: 77, y: 300, w: 19, h: 70, r: 9.5 },
      { kind: 'rect', x: 104, y: 300, w: 19, h: 70, r: 9.5 },
    ],
    ankles: [
      { kind: 'rect', x: 74, y: 373, w: 24, h: 14, r: 7 },
      { kind: 'rect', x: 102, y: 373, w: 24, h: 14, r: 7 },
    ],
    heart: [
      {
        kind: 'path',
        d: 'M110 122c-1.5-1.4-12-8-12-15 0-4.2 3.1-6.8 6.3-6.8 2.4 0 4.5 1.3 5.7 3.4 1.2-2.1 3.3-3.4 5.7-3.4 3.2 0 6.3 2.6 6.3 6.8 0 7-10.5 13.6-12 15z',
      },
    ],
  },
  back: {
    shoulders: [
      { kind: 'rect', x: 52, y: 80, w: 26, h: 26, r: 13 },
      { kind: 'rect', x: 122, y: 80, w: 26, h: 26, r: 13 },
    ],
    upperBack: [{ kind: 'rect', x: 72, y: 84, w: 56, h: 58, r: 14 }],
    arms: [
      { kind: 'rect', x: 44, y: 104, w: 18, h: 60, r: 9 },
      { kind: 'rect', x: 40, y: 166, w: 16, h: 60, r: 8 },
      { kind: 'rect', x: 138, y: 104, w: 18, h: 60, r: 9 },
      { kind: 'rect', x: 144, y: 166, w: 16, h: 60, r: 8 },
    ],
    lowerBack: [{ kind: 'rect', x: 76, y: 145, w: 48, h: 44, r: 10 }],
    glutes: [{ kind: 'rect', x: 74, y: 192, w: 52, h: 34, r: 14 }],
    hamstrings: [
      { kind: 'rect', x: 74, y: 228, w: 24, h: 68, r: 12 },
      { kind: 'rect', x: 102, y: 228, w: 24, h: 68, r: 12 },
    ],
    calves: [
      { kind: 'rect', x: 77, y: 300, w: 19, h: 70, r: 9.5 },
      { kind: 'rect', x: 104, y: 300, w: 19, h: 70, r: 9.5 },
    ],
    ankles: [
      { kind: 'rect', x: 74, y: 373, w: 24, h: 14, r: 7 },
      { kind: 'rect', x: 102, y: 373, w: 24, h: 14, r: 7 },
    ],
  },
};

/** Centre of each region on its side, for the focus zoom. */
function centre(side: 'front' | 'back', region: BodyRegion): { x: number; y: number } {
  const shapes = SHAPES[side][region] ?? [];
  const boxes = shapes.map((s) => (s.kind === 'rect' ? s : { x: 98, y: 100, w: 24, h: 22 }));
  if (!boxes.length) return { x: 100, y: 200 };
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function BodyMap({
  side,
  highlighted,
  tint,
  tintSoft,
  selected,
  onSelect,
  height = 400,
}: {
  side: 'front' | 'back';
  /** Areas to fill with the zone colour. */
  highlighted: Set<BodyRegion>;
  tint: string;
  tintSoft: string;
  selected: BodyRegion | null;
  onSelect: (r: BodyRegion | null) => void;
  height?: number;
}) {
  const { t } = useTranslation();
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const width = height / 2;
  const zoom = useSharedValue(1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  useEffect(() => {
    if (reduced || !selected) {
      zoom.set(withSpring(1, motion.gentle));
      dx.set(withSpring(0, motion.gentle));
      dy.set(withSpring(0, motion.gentle));
      return;
    }
    const c = centre(side, selected);
    const k = 1.25;
    zoom.set(withSpring(k, motion.gentle));
    // Move the area towards the middle, scaled to on-screen pixels.
    dx.set(withSpring(((100 - c.x) * (width / 200)) * 0.6, motion.gentle));
    dy.set(withSpring(((200 - c.y) * (height / 400)) * 0.35, motion.gentle));
  }, [selected, side, reduced, zoom, dx, dy, width, height, motion.gentle]);
  const focus = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: zoom.value }],
  }));

  const shapes = SHAPES[side];
  const draw = (region: BodyRegion, s: Shape, i: number) => {
    const on = highlighted.has(region);
    const sel = selected === region;
    const fill = region === 'heart' ? (on ? tint : colors.unknown) : on ? tintSoft : colors.surfaceSunken;
    const stroke = sel ? colors.text : on ? tint : colors.hairline;
    const key = `${region}-${i}`;
    const common = {
      fill,
      stroke,
      strokeWidth: sel ? 3 : on ? 1.6 : 1,
      onPress: () => {
        haptic('select');
        onSelect(sel ? null : region);
      },
    };
    return s.kind === 'rect' ? (
      <Rect key={key} {...common} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />
    ) : (
      <Path key={key} {...common} d={s.d} />
    );
  };

  // Draw the heart last so it sits on the chest.
  const order = (Object.keys(shapes) as BodyRegion[]).sort((a, b) => (a === 'heart' ? 1 : b === 'heart' ? -1 : 0));

  return (
    <View
      style={{ width, height, overflow: 'hidden', alignSelf: 'center' }}
      accessible
      accessibilityLabel={t('body.figureA11y', { side: t(`body.side.${side}`) })}
      testID={`body-map-${side}`}
    >
      <Animated.View style={focus}>
        <Svg width={width} height={height} viewBox="0 0 200 400">
          <G>
            {/* Head and neck: not tappable, nothing is measured there. */}
            <Circle cx={100} cy={46} r={24} fill={colors.surfaceSunken} stroke={colors.hairline} />
            <Rect x={90} y={68} width={20} height={16} rx={6} fill={colors.surfaceSunken} stroke={colors.hairline} />
            {side === 'front' ? (
              <Rect x={74} y={200} width={52} height={10} rx={5} fill={colors.surfaceSunken} stroke={colors.hairline} />
            ) : null}
            {order.map((region) => (shapes[region] ?? []).map((s, i) => draw(region, s, i)))}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
