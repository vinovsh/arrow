import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet} from 'react-native';
import Svg from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import {perpendicular} from '../models/types';
import type {RenderTier} from '../../app/featureFlags';
import {ArrowShape} from './ArrowShape';
import {buildArrowGeometry} from './arrowGeometry';

interface Props {
  arrow: ArrowPath;
  index: number;
  gridSize: number;
  cellSize: number;
  tier: RenderTier;
  onComplete: (index: number) => void;
}

/** §9.3 — three-cycle shake, ±4dp perpendicular to direction. No colour change. */
const SHAKE_AMPLITUDE = 4;
const SHAKE_MS = 180;

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
        <ArrowShape arrow={arrow} geometry={geometry} tier={tier} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', left: 0, top: 0},
});
