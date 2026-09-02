import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import {theme} from '../../theme/theme';
import type {RenderTier} from '../../app/featureFlags';
import {
  buildRopeGeometry,
  escapeDurationMs,
  exitTravelDistance,
} from './arrowGeometry';

interface Props {
  arrow: ArrowPath;
  index: number;
  gridSize: number;
  cellSize: number;
  tier: RenderTier;
  onComplete: (index: number) => void;
}

/**
 * An arrow being pulled off the board, redrawn each frame as a deforming rope.
 *
 * The geometry is recomputed rather than transformed. A transform — translate,
 * rotate, scale, anything applied to a container — moves the arrow as one rigid
 * object, so a U keeps its U and an L keeps its L all the way out. Here the path's
 * own points are what move: `buildRopeGeometry` reslices the arrow along its extended
 * path every frame, so the bends unwind toward the tail and the body straightens into
 * the direction the head points before it leaves.
 *
 * That means a new `d` string per frame, which rules out both animation drivers:
 * Reanimated cannot hand a computed path to the UI thread without a worklet doing the
 * geometry there, and RN's Animated has no native driver for string props. A plain
 * `requestAnimationFrame` loop is the honest way to do it — one small component
 * re-rendering per frame, only while an arrow is actually leaving. Even a fast
 * clear-out has a handful in flight at once, nowhere near the whole board (§13).
 */
export function EscapingArrow({
  arrow,
  index,
  gridSize,
  cellSize,
  tier,
  onComplete,
}: Props): React.JSX.Element {
  const size = cellSize * gridSize;
  const travel = useMemo(
    () => exitTravelDistance(arrow, gridSize, cellSize),
    [arrow, gridSize, cellSize],
  );
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const duration = escapeDurationMs(travel, size);
    const startedAt = Date.now();
    let frame = 0;

    const tick = (): void => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      setProgress(t);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!done.current) {
        done.current = true;
        onComplete(index);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [travel, size, index, onComplete]);

  const geometry = useMemo(() => {
    // Immediate response, then acceleration: slope 0.35 at the start so the tap is
    // answered on the first frame, rising to 1.65 by the end so it is genuinely
    // leaving rather than drifting. A steeper ease-out covers most of the distance
    // before the eye catches up and reads as a blink.
    const eased = 0.35 * progress + 0.65 * progress * progress;
    // The rope gives a little as it is yanked and is back to its own length by the
    // time it is clear — the elastic cue, not a change of size.
    const stretch = 1 + 0.05 * Math.sin(Math.PI * progress);
    return buildRopeGeometry(
      arrow,
      gridSize,
      cellSize,
      eased * travel,
      stretch,
    );
  }, [arrow, gridSize, cellSize, progress, travel]);

  // An SVG always clips to its own viewBox, so a canvas the size of the board would
  // cut the arrow off at the very edge it is trying to leave — the exact thing this
  // animation exists to avoid. The canvas is therefore extended in the one direction
  // the arrow travels, far enough to carry it out of sight, and capped at a board's
  // width because beyond that it is off-screen anyway.
  const pad = Math.min(travel + cellSize, size);
  const padLeft = arrow.direction === 'L' ? pad : 0;
  const padTop = arrow.direction === 'U' ? pad : 0;
  const canvasWidth = size + padLeft + (arrow.direction === 'R' ? pad : 0);
  const canvasHeight = size + padTop + (arrow.direction === 'D' ? pad : 0);

  const colour = theme.arrow[arrow.color];
  const hasBody = geometry.body !== '';
  // Fully opaque across the board; it only gives up its last stretch, by which point
  // it is already outside the frame. The player sees it leave, not dissolve.
  const opacity = progress < 0.82 ? 1 : 1 - (progress - 0.82) / 0.18;

  return (
    <Svg
      width={canvasWidth}
      height={canvasHeight}
      // Negative origin keeps the geometry in board coordinates while the canvas
      // reaches past the board, so nothing here needs to know it has been extended.
      viewBox={`${-padLeft} ${-padTop} ${canvasWidth} ${canvasHeight}`}
      // §9.2 has escaping paths slip under the board frame; an arrow cut off at the
      // boundary reads as deleted rather than as having left, so this one is not.
      style={[styles.layer, {left: -padLeft, top: -padTop}]}
      pointerEvents="none">
      <G opacity={opacity}>
        {!tier.bakedGlowUnderlay && (
          <>
            {hasBody && (
              <Path
                d={geometry.body}
                stroke={colour}
                strokeWidth={geometry.strokeWidth * 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeOpacity={0.34 * tier.glowOpacityScale}
              />
            )}
            <Path
              d={geometry.head}
              fill={colour}
              stroke={colour}
              strokeWidth={geometry.strokeWidth * 0.85}
              strokeLinejoin="round"
              opacity={0.34 * tier.glowOpacityScale}
            />
          </>
        )}

        {hasBody && (
          <Path
            d={geometry.body}
            stroke={colour}
            strokeWidth={geometry.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        <Path d={geometry.head} fill={colour} />

        {tier.layersPerArrow === 3 && hasBody && (
          <Path
            d={geometry.body}
            stroke={theme.arrow.white}
            strokeWidth={geometry.strokeWidth * 0.22}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.25}
          />
        )}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute'},
});
