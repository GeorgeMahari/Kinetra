/**
 * Lifecycle of infinite animations: they start only when allowed, stop when the screen loses focus,
 * and never outlive the component. The Reanimated stand-in records `cancelAnimation` calls and lets a
 * test switch Reduce Motion off.
 */
import { act, render, screen } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { useShimmer } from '../motion';
import { isInViewport, useVisibleLoop } from '../visibleLoop';

const R = Reanimated as unknown as {
  cancelAnimation: jest.Mock;
  __setReducedMotion: (v: boolean) => void;
  useSharedValue: typeof Reanimated.useSharedValue;
};

beforeEach(() => {
  R.cancelAnimation.mockClear();
  R.__setReducedMotion(false);
});
afterAll(() => R.__setReducedMotion(true));

describe('isInViewport', () => {
  it('is true while any part of the box overlaps the window', () => {
    expect(isInViewport(100, 50, 800)).toBe(true);
    expect(isInViewport(-40, 50, 800)).toBe(true); // partly above the top
    expect(isInViewport(790, 50, 800)).toBe(true); // partly below the bottom
  });
  it('is false once the box is entirely outside', () => {
    expect(isInViewport(-60, 50, 800)).toBe(false);
    expect(isInViewport(800, 50, 800)).toBe(false);
  });
});

const loop = jest.fn(() => 42);

function Looper({ enabled = true }: { enabled?: boolean }) {
  const v = R.useSharedValue(0);
  const { running } = useVisibleLoop(v, loop, 0, enabled);
  return <Text testID="state">{running ? 'running' : 'idle'}</Text>;
}

describe('useVisibleLoop', () => {
  beforeEach(() => loop.mockClear());

  it('runs while the screen is focused and stops when another screen covers it', async () => {
    // A stack keeps screen a mounted underneath b, as in the app: a loses focus, it does not unmount.
    await renderRouter({ _layout: () => <Stack />, a: () => <Looper />, b: () => <Text>B</Text> }, { initialUrl: '/a' });
    expect(screen.getByTestId('state')).toHaveTextContent('running');
    expect(loop).toHaveBeenCalledTimes(1);

    await act(() => router.push('/b' as never)); // a test-only route, outside the typed app routes
    expect(R.cancelAnimation).toHaveBeenCalled();
    expect(screen.getByTestId('state', { includeHiddenElements: true })).toHaveTextContent('idle');

    await act(() => router.back());
    expect(screen.getByTestId('state')).toHaveTextContent('running');
    expect(loop).toHaveBeenCalledTimes(2); // restarted, not resumed twice
  });

  it('never starts under Reduce Motion', async () => {
    R.__setReducedMotion(true);
    await renderRouter({ a: () => <Looper /> }, { initialUrl: '/a' });
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(loop).not.toHaveBeenCalled();
  });

  it('respects the caller condition (e.g. no streak, no flame flicker)', async () => {
    await renderRouter({ a: () => <Looper enabled={false} /> }, { initialUrl: '/a' });
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(loop).not.toHaveBeenCalled();
  });

  it('cancels the animation when the component unmounts', async () => {
    const { unmount } = await renderRouter({ a: () => <Looper /> }, { initialUrl: '/a' });
    R.cancelAnimation.mockClear();
    await act(() => unmount());
    expect(R.cancelAnimation).toHaveBeenCalled();
  });
});

describe('useShimmer', () => {
  function Shimmer() {
    useShimmer();
    return null;
  }

  it('cancels its loop when the placeholder unmounts', async () => {
    const { unmount } = await render(<Shimmer />);
    expect(R.cancelAnimation).not.toHaveBeenCalled();
    await act(() => unmount());
    expect(R.cancelAnimation).toHaveBeenCalledTimes(1);
  });

  it('does not loop at all under Reduce Motion', async () => {
    R.__setReducedMotion(true);
    const { unmount } = await render(<Shimmer />);
    await act(() => unmount());
    expect(R.cancelAnimation).not.toHaveBeenCalled();
  });
});
