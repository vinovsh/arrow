import React, {useEffect, useMemo, useRef} from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../../theme/theme';
import type {ArrowPath} from '../models/types';
import type {RenderTier} from '../../app/featureFlags';
import {
  drawRopeFrame,
  exitTravelDistance,
  prepareRopeMotion,
} from './arrowGeometry';
import {
  escapeDurationMs,
  escapeProgress,
  escapeStretch,
} from '../../config/arrowMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
interface Props {
  arrow: ArrowPath;
  index: number;
  gridSize: number;
  cellSize: number;
  tier: RenderTier;
  /** Distance from the board edge to the viewport clip in the exit direction. */
  clearance: number;
  startedAt?: number;
  onComplete: (index: number) => void;
}

/** Rope unwinding is driven on the UI thread, with no React render per frame. */
function EscapingArrowBase({
  arrow,
  index,
  gridSize,
  cellSize,
  clearance,
  startedAt,
  onComplete,
}: Props): React.JSX.Element {
  const travel = useMemo(
    () => exitTravelDistance(arrow, gridSize, cellSize, clearance),
    [arrow, gridSize, cellSize, clearance],
  );
  const duration = escapeDurationMs(travel, cellSize * gridSize);
  const motion = useMemo(
    () => prepareRopeMotion(arrow, gridSize, cellSize, clearance),
    [arrow, gridSize, cellSize, clearance],
  );
  const launchTime = useRef(startedAt ?? Date.now()).current;
  const initial = Math.min(
    1,
    Math.max(0, (Date.now() - launchTime) / duration),
  );
  const progress = useSharedValue(initial);
  const complete = useRef(false);
  const finish = React.useCallback(
    (completedIndex: number) => {
      if (!complete.current) {
        complete.current = true;
        onComplete(completedIndex);
      }
    },
    [onComplete],
  );
  useEffect(() => {
    const elapsed = Math.max(0, Date.now() - launchTime);
    progress.value = Math.min(1, elapsed / duration);
    if (elapsed >= duration) {
      finish(index);
      return;
    }
    progress.value = withTiming(
      1,
      {
        duration: duration - elapsed,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      },
      finished => {
        if (finished) {
          runOnJS(finish)(index);
        }
      },
    );
    return () => cancelAnimation(progress);
  }, [duration, launchTime, progress, finish, index]);

  const geometry = useDerivedValue(() =>
    drawRopeFrame(
      motion,
      escapeProgress(progress.value) * travel,
      escapeStretch(progress.value),
    ),
  );
  const bodyProps = useAnimatedProps(() => ({d: geometry.value.body}));
  const headProps = useAnimatedProps(() => ({d: geometry.value.head}));
  const firstFrame = drawRopeFrame(
    motion,
    escapeProgress(initial) * travel,
    escapeStretch(initial),
  );
  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const cell of arrow.cells) {
      minX = Math.min(minX, cell.x * cellSize);
      minY = Math.min(minY, cell.y * cellSize);
      maxX = Math.max(maxX, (cell.x + 1) * cellSize);
      maxY = Math.max(maxY, (cell.y + 1) * cellSize);
    }
    minX -= cellSize;
    minY -= cellSize;
    maxX += cellSize;
    maxY += cellSize;
    switch (arrow.direction) {
      case 'R':
        maxX += travel;
        break;
      case 'L':
        minX -= travel;
        break;
      case 'D':
        maxY += travel;
        break;
      case 'U':
        minY -= travel;
        break;
    }
    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
  }, [arrow, cellSize, travel]);
  return (
    <Svg
      width={bounds.width}
      height={bounds.height}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      style={[styles.layer, {left: bounds.x, top: bounds.y}]}
      pointerEvents="none">
      <AnimatedPath
        d={firstFrame.body}
        animatedProps={bodyProps}
        stroke={theme.board.escaping}
        strokeWidth={motion.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <AnimatedPath
        d={firstFrame.head}
        animatedProps={headProps}
        fill={theme.board.escaping}
      />
    </Svg>
  );
}
export const EscapingArrow = React.memo(EscapingArrowBase);
const styles = StyleSheet.create({layer: {position: 'absolute'}});
