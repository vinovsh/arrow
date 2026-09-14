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
  /**
   * When the tap landed (Date.now()) — not when this component mounted. See the note
   * on the animation clock below.
   */
  startedAt?: number;
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
  startedAt: tappedAt,
  onComplete,
}: Props): React.JSX.Element {
  const size = cellSize * gridSize;
  const travel = useMemo(
    () => exitTravelDistance(arrow, gridSize, cellSize, clearance),
    [arrow, gridSize, cellSize, clearance],
  );
  const duration = useMemo(() => escapeDurationMs(travel, size), [travel, size]);

  // The flight is clocked from the tap, not from this component's first render.
  //
  // Between those two moments sit a hop off the gesture thread, a React render, a
  // commit and a native mount — on a real device, the better part of two hundred
  // milliseconds. Clocked from the mount, every one of them was time the arrow spent
  // sitting exactly where it had always been, with the player's finger already lifted:
  // the first frame anyone saw was the resting pose, and motion only began a frame
  // after that. Clocked from the tap, that setup is spent *along the path* instead, so
  // the first frame to reach the screen already shows the arrow on its way out.
  //
  // Nothing about the animation itself changes — same curve, same duration, same
  // geometry. Only the question "how far along is it by now?" gets an honest answer.
  // Read once into a ref, because a clock that re-read its own start on every
  // re-render would never advance.
  const startedAt = useRef(tappedAt ?? Date.now()).current;

  // Seeded, not zero, for that same reason: the first painted frame should show where
  // the arrow has got to, not where it was when the finger came down.
  const [progress, setProgress] = useState(() =>
    Math.min(1, (Date.now() - startedAt) / duration),
  );
  const done = useRef(false);
  const traced = useRef(false);
  const displaced = useRef(false);

  useEffect(() => {
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
    trace(
      'EscapingArrow mounted, rAF scheduled — canvas ' +
        Math.round(bounds.width) +
        'x' +
        Math.round(bounds.height) +
        'dp (board ' +
        Math.round(size) +
        'dp, was ' +
        Math.round(size) +
        'x' +
        Math.round(size + clearance + EXIT_MARGIN_CELLS * cellSize) +
        ')',
    );
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, duration, index, onComplete]);

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

  // An SVG always clips to its own viewBox, so this canvas has to cover every
  // position the arrow will occupy on its way out — but *only* those positions.
  //
  // It used to be the whole board plus the run-off, which on a phone came to about
  // 360x582dp: some 990x1600 device pixels, a six-megabyte surface allocated fresh on
  // every tap and repainted every frame, to draw an arrow one column wide. That
  // allocation was the single largest thing standing between the tap and the first
  // frame of motion.
  //
  // A tight box is just as correct and a great deal cheaper. The arrow's own cells
  // bound it to start with; `travel` is by definition how far it moves before it is
  // out of sight, so extending by that in the one direction it goes covers the rest.
  // It never grows the other way: the rope straightens toward the head as it unwinds,
  // so its reach across the direction of travel only shrinks. The cell of slack on
  // every side is for the ink rather than the path — the widest stroke is the glow at
  // 2.4x, spilling 1.2 stroke-widths from the centreline, and a stroke is capped at
  // 7dp, so half a cell already clears it on any board this game draws.
  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
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
      width={bounds.width}
      height={bounds.height}
      // The viewBox carries the box's own origin, so the geometry inside stays in
      // board coordinates and nothing downstream needs to know the canvas moved.
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      // §9.2 has escaping paths slip under the board frame; an arrow cut off at the
      // boundary reads as deleted rather than as having left, so this one is not.
      style={[styles.layer, {left: bounds.x, top: bounds.y}]}
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
