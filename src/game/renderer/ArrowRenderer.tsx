import React, {useEffect, useMemo} from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {G} from 'react-native-svg';
import type {ArrowPath, ArrowState} from '../models/types';
import type {RenderTier} from '../../app/featureFlags';
import {ArrowShape} from './ArrowShape';
import {buildArrowGeometry} from './arrowGeometry';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface ArrowVisualState {
  state: ArrowState;
  /** §9.3 — set while this arrow is shaking off a blocked tap, in the moving layer. */
  shaking: boolean;
  /** §9.3 — outlined at 25% as the blocker of a failed tap. */
  highlighted: boolean;
  /** §3.3, §3.4 — pulsing for a hint or the silent assist. */
  pulsing: boolean;
  /**
   * When the tap that freed this arrow landed, in ms. The exit flight is timed from
   * here rather than from the moment its component mounts, so the setup between the
   * two is spent moving the arrow instead of leaving it parked.
   */
  escapeStartedAt?: number;
}

interface Props {
  arrow: ArrowPath;
  index: number;
  cellSize: number;
  tier: RenderTier;
  highlighted: boolean;
  pulsing: boolean;
}

/** §9.1 — 0.15Hz breathing, ±6% opacity. */
const BREATH_PERIOD_MS = 1000 / 0.15;

/**
 * An arrow sitting still on the board.
 *
 * Everything that moves — the exit flight and the blocked shake — is drawn by
 * `MovingArrow` in its own layer instead, because Reanimated cannot drive a transform
 * on an SVG group. What is left here is genuinely static, so this subtree re-renders
 * only when the arrow's own highlight or pulse changes.
 */
function ArrowRendererBase({
  arrow,
  index,
  cellSize,
  tier,
  highlighted,
  pulsing,
}: Props): React.JSX.Element {
  const geometry = useMemo(
    () => buildArrowGeometry(arrow, cellSize),
    [arrow, cellSize],
  );
  const breath = useSharedValue(1);

  // §9.1 — phase-offset per arrow so the board shimmers rather than pulsing in
  // lockstep. Opacity is a real SVG attribute, so unlike a transform it does animate
  // here — which is also why it costs what it does: every frame of it writes a prop
  // into the board's <Svg> and invalidates the surface. `idleBreathing` is false on
  // every tier now (see featureFlags), so this arms nothing; the machinery is left in
  // place because flipping that one flag back is the whole of turning it on again.
  useEffect(() => {
    if (!tier.idleBreathing) {
      return;
    }
    breath.value = withDelay(
      (index * 137) % BREATH_PERIOD_MS,
      withRepeat(
        withSequence(
          withTiming(1.06, {
            duration: BREATH_PERIOD_MS / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.94, {
            duration: BREATH_PERIOD_MS / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );
  }, [tier.idleBreathing, index, breath]);

  const groupProps = useAnimatedProps(() => ({opacity: breath.value}));

  return (
    <AnimatedG animatedProps={groupProps}>
      <ArrowShape
        arrow={arrow}
        geometry={geometry}
        tier={tier}
        highlighted={highlighted}
        pulsing={pulsing}
      />
    </AnimatedG>
  );
}

/**
 * §13 — one memoised `<G>` per arrow. An arrow re-renders only when its own state
 * changes, so a tap on a 90-arrow board touches two subtrees rather than ninety.
 */
export const ArrowRenderer = React.memo(
  ArrowRendererBase,
  (a, b) =>
    a.arrow === b.arrow &&
    a.cellSize === b.cellSize &&
    a.highlighted === b.highlighted &&
    a.pulsing === b.pulsing &&
    a.tier === b.tier,
);
