import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet} from 'react-native';
import Svg, {G} from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import type {RenderTier} from '../../app/featureFlags';
import {withOwnUnderlay} from '../../app/featureFlags';
import {ArrowShape} from './ArrowShape';
import {
  EXIT_MARGIN_CELLS,
  buildRopeGeometry,
  escapeDurationMs,
  exitTravelDistance,
} from './arrowGeometry';
// TEMPORARY — tap-latency instrumentation, see src/utils/tapTrace.ts.
import {trace} from '../../utils/tapTrace';

interface Props {
  arrow: ArrowPath;
  index: number;
  gridSize: number;
  cellSize: number;
  tier: RenderTier;
  /**
   * §9.2 — dp from the board edge to the viewport clip, in this arrow's direction.
   * The arrow is not finished when it leaves the board, it is finished when it stops
   * being visible, and only the screen knows how far apart those two are.
   */
  clearance: number;
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
  clearance,
  onComplete,
}: Props): React.JSX.Element {
  const size = cellSize * gridSize;
  const travel = useMemo(
    () => exitTravelDistance(arrow, gridSize, cellSize, clearance),
    [arrow, gridSize, cellSize, clearance],
  );
  const [progress, setProgress] = useState(0);
  const done = useRef(false);
  const traced = useRef(false);
  const displaced = useRef(false);

  useEffect(() => {
    const duration = escapeDurationMs(travel, size);
    const startedAt = Date.now();
    let frame = 0;

    const tick = (): void => {
      if (!traced.current) {
        traced.current = true;
        trace('EscapingArrow first animation frame');
      }
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      setProgress(t);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!done.current) {
        done.current = true;
        onComplete(index);
      }
    };
    trace('EscapingArrow mounted, rAF scheduled');
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [travel, size, index, onComplete]);

  // TEMPORARY — the number that matters: when a frame showing the arrow somewhere
  // other than where it was resting actually reached the screen.
  useEffect(() => {
    if (progress > 0 && !displaced.current) {
      displaced.current = true;
      trace('first committed frame with the arrow displaced');
    }
  }, [progress]);

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
      clearance,
    );
  }, [arrow, gridSize, cellSize, progress, travel, clearance]);

  // An SVG always clips to its own viewBox, so a canvas the size of the board would
  // cut the arrow off at the very edge it is trying to leave — the exact thing this
  // animation exists to avoid. The canvas is extended in the one direction the arrow
  // travels, out to the viewport's own clip and no further: past that the viewport
  // hides it anyway, and the head runs a whole body-length ahead of the tail, so
  // sizing this to the full travel would buy a canvas several boards wide to draw
  // pixels nobody can see.
  const pad = clearance + EXIT_MARGIN_CELLS * cellSize;
  const padLeft = arrow.direction === 'L' ? pad : 0;
  const padTop = arrow.direction === 'U' ? pad : 0;
  const canvasWidth = size + padLeft + (arrow.direction === 'R' ? pad : 0);
  const canvasHeight = size + padTop + (arrow.direction === 'D' ? pad : 0);

  // §13 — the baked underlay has already dropped this arrow, so it draws its own.
  const ownTier = useMemo(() => withOwnUnderlay(tier), [tier]);

  // No fade, at any point. There used to be one over the last 18% of the animation,
  // on the assumption that the arrow was outside the frame by then — it was not. The
  // easing puts the arrow only 72% of the way along its travel at that moment, so on
  // anything but a very short path the fade began while the arrow was still well
  // inside the board and the player watched it dissolve in place. The arrow now
  // simply leaves, and the viewport's clip is what ends it.
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
      <G>
        {/* Drawn through the same component the resting board uses, so the arrow that
            lifts off is the one that was sitting there — every width, the casing and
            the gloss included, follows the geometry it is handed. */}
        <ArrowShape arrow={arrow} geometry={geometry} tier={ownTier} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute'},
});
