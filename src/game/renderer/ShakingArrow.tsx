import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet} from 'react-native';
import Svg from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import {perpendicular} from '../models/types';
import type {RenderTier} from '../../app/featureFlags';
import {withOwnUnderlay} from '../../app/featureFlags';
import {ArrowShape} from './ArrowShape';
import {buildArrowGeometry} from './arrowGeometry';
import {ARROW_MOTION} from '../../config/arrowMotion';

interface Props {
  arrow: ArrowPath;
  index: number;
  gridSize: number;
  cellSize: number;
  tier: RenderTier;
  onComplete: (index: number) => void;
}

// §9.3 — three-cycle shake perpendicular to direction. No colour change. Both
// numbers are tuning rather than design, so they live with the rest of the arrow
// speed knobs in src/config/arrowMotion.ts.
const SHAKE_AMPLITUDE = ARROW_MOTION.blockedShake.amplitudeDp;
const SHAKE_MS = ARROW_MOTION.blockedShake.durationMs;

/**
 * A blocked arrow, refusing to go.
 *
 * Unlike the exit, this one *is* a rigid transform, and deliberately so: the arrow is
 * not going anywhere, it is bumping against whatever is in front of it, so it should
 * keep its shape exactly. The shake runs perpendicular to the direction it wanted to
 * travel, which reads as "it tried and could not" rather than as a generic error buzz.
 *
 * It still has to live outside the board's SVG, because react-native-svg resolves a
 * `<G>` transform into a matrix at render time and never sees an animated update.
 */
export function ShakingArrow({
  arrow,
  index,
  gridSize,
  cellSize,
  tier,
  onComplete,
}: Props): React.JSX.Element {
  const size = cellSize * gridSize;
  const geometry = useMemo(
    () => buildArrowGeometry(arrow, cellSize),
    [arrow, cellSize],
  );
  // §13 — the baked underlay drops an arrow the moment it starts shaking, so this
  // one draws its own rather than losing its casing exactly while it is being watched.
  const ownTier = useMemo(() => withOwnUnderlay(tier), [tier]);
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const leg = SHAKE_MS / 6;
    const swing = (toValue: number) =>
      Animated.timing(wobble, {
        toValue,
        duration: leg,
        easing: Easing.linear,
        useNativeDriver: true,
      });
    Animated.sequence([
      swing(1),
      swing(-1),
      swing(1),
      swing(-1),
      swing(1),
      swing(0),
    ]).start(({finished}) => {
      if (finished) {
        onComplete(index);
      }
    });
  }, [wobble, index, onComplete]);

  const style = useMemo(() => {
    const axis = perpendicular(arrow.direction);
    const offset = wobble.interpolate({
      inputRange: [-1, 1],
      outputRange: [-SHAKE_AMPLITUDE, SHAKE_AMPLITUDE],
    });
    return {
      transform: axis.x !== 0 ? [{translateX: offset}] : [{translateY: offset}],
    };
  }, [wobble, arrow.direction]);

  return (
    <Animated.View
      style={[styles.layer, {width: size, height: size}, style]}
      pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <ArrowShape arrow={arrow} geometry={geometry} tier={ownTier} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', left: 0, top: 0},
});
