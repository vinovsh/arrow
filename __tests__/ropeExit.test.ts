import {
  SINGLE_CELL_STUB,
  bodyLengthOf,
  buildRopeGeometry,
  escapeDurationMs,
  exitTravelDistance,
} from '../src/game/renderer/arrowGeometry';
import type {ArrowPath} from '../src/game/models/types';

const CELL = 40;
const GRID = 8;

const arrow = (
  cells: [number, number][],
  direction: ArrowPath['direction'],
): ArrowPath => ({
  id: 'a',
  color: 'cyan',
  cells: cells.map(([x, y]) => ({x, y})),
  direction,
});

/** Pull the points back out of an SVG "M x y L x y ..." path. */
function pointsOf(d: string): {x: number; y: number}[] {
  return [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(m => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

/** Total length of the polyline's segments running in one heading. */
function runLength(d: string, heading: string): number {
  const points = pointsOf(d);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const of =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
    if (of === heading) {
      total += Math.hypot(dx, dy);
    }
  }
  return total;
}

/** How many distinct headings the polyline turns through. */
function segmentDirections(d: string): string[] {
  const points = pointsOf(d);
  const headings: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.hypot(dx, dy) < 0.5) {
      continue;
    }
    const heading =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
    if (headings[headings.length - 1] !== heading) {
      headings.push(heading);
    }
  }
  return headings;
}

/**
 * The exit is a rope being pulled from its head, not a rigid shape sliding away. An
 * L must leave as a straight line, which is only true if the path's own points move.
 */
describe('rope exit geometry', () => {
  // Up the left column, then right along the middle: an L pointing R.
  const lShape = arrow(
    [
      [1, 5],
      [1, 4],
      [1, 3],
      [2, 3],
      [3, 3],
    ],
    'R',
  );

  it('starts out drawn exactly where the resting arrow was', () => {
    const rope = buildRopeGeometry(lShape, GRID, CELL, 0);
    const points = pointsOf(rope.body);
    expect(points[0]).toEqual({x: 1.5 * CELL, y: 5.5 * CELL});
    // Both limbs of the L are present at rest.
    expect(segmentDirections(rope.body)).toEqual(['U', 'R']);
  });

  it('straightens as it is pulled: the bend leaves before the arrow does', () => {
    const bodyLength = bodyLengthOf(lShape, CELL);
    // A quarter of the way along. The vertical limb is exactly half the body, so
    // pulling by half would land the corner precisely on the tail and the arrow
    // would already be straight — this is deliberately short of that.
    const midway = buildRopeGeometry(lShape, GRID, CELL, bodyLength * 0.25);
    expect(segmentDirections(midway.body)).toEqual(['U', 'R']);

    // The upright limb must be shorter than it was while the arrow keeps its full
    // length: the corner is being fed round into the horizontal run. A rigid
    // translation would carry both limbs along at their original lengths.
    const resting = buildRopeGeometry(lShape, GRID, CELL, 0).body;
    expect(runLength(midway.body, 'U')).toBeLessThan(runLength(resting, 'U'));
    expect(runLength(midway.body, 'R')).toBeGreaterThan(runLength(resting, 'R'));
  });

  it('is perfectly straight, along the arrowhead, once the corner is past', () => {
    const bodyLength = bodyLengthOf(lShape, CELL);
    const straight = buildRopeGeometry(lShape, GRID, CELL, bodyLength);
    expect(segmentDirections(straight.body)).toEqual(['R']);

    const points = pointsOf(straight.body);
    // A single horizontal run: every point shares a y.
    for (const p of points) {
      expect(p.y).toBeCloseTo(points[0].y, 5);
    }
  });

  it('never moves any point against the direction the rope already went', () => {
    // The head only ever advances along the arrow's own direction.
    let previous = -Infinity;
    for (let step = 0; step <= 10; step++) {
      const travelled = (exitTravelDistance(lShape, GRID, CELL) * step) / 10;
      const nose = pointsOf(buildRopeGeometry(lShape, GRID, CELL, travelled).head)[0];
      expect(nose.x).toBeGreaterThan(previous);
      previous = nose.x;
    }
  });

  it('carries the whole arrow clear of the board by the end of its travel', () => {
    const travel = exitTravelDistance(lShape, GRID, CELL);
    const finished = buildRopeGeometry(lShape, GRID, CELL, travel);
    const tail = pointsOf(finished.body)[0];
    // Even the tail — the last part to leave — is outside the board.
    expect(tail.x).toBeGreaterThan(GRID * CELL);
  });

  it('straightens a U the same way, and leaves through the head', () => {
    // Down, across, and back up: a U whose head points UP.
    const uShape = arrow(
      [
        [2, 2],
        [2, 3],
        [2, 4],
        [3, 4],
        [4, 4],
        [4, 3],
        [4, 2],
      ],
      'U',
    );
    expect(segmentDirections(buildRopeGeometry(uShape, GRID, CELL, 0).body)).toEqual([
      'D',
      'R',
      'U',
    ]);

    const bodyLength = bodyLengthOf(uShape, CELL);
    const straight = buildRopeGeometry(uShape, GRID, CELL, bodyLength);
    expect(segmentDirections(straight.body)).toEqual(['U']);

    const travel = exitTravelDistance(uShape, GRID, CELL);
    const tail = pointsOf(buildRopeGeometry(uShape, GRID, CELL, travel).body)[0];
    expect(tail.y).toBeLessThan(0);
  });

  it('carries a single-cell arrow out by its stub, in every direction', () => {
    for (const direction of ['U', 'D', 'L', 'R'] as const) {
      const single = arrow([[4, 4]], direction);

      // At rest the stub sits behind the cell centre, so the arrow reads as a short
      // line with a head rather than as a bare triangle floating in the cell.
      const resting = buildRopeGeometry(single, GRID, CELL, 0);
      const tail = pointsOf(resting.body)[0];
      expect(segmentDirections(resting.body)).toEqual([direction]);
      expect(bodyLengthOf(single, CELL)).toBeCloseTo(CELL * SINGLE_CELL_STUB, 5);

      // The stub travels with the head instead of being tacked on at draw time: by
      // the end even the tail — the last part to leave — is off the board.
      const travel = exitTravelDistance(single, GRID, CELL);
      const gone = buildRopeGeometry(single, GRID, CELL, travel);
      const outside = (p: {x: number; y: number}): boolean =>
        p.x < 0 || p.y < 0 || p.x > GRID * CELL || p.y > GRID * CELL;
      expect(outside(pointsOf(gone.head)[0])).toBe(true);
      expect(outside(pointsOf(gone.body)[0])).toBe(true);
      // ...and it genuinely moved, rather than starting out there.
      expect(outside(tail)).toBe(false);
    }
  });

  /**
   * §9.2 — the arrow must be out of sight before it is retired, not merely off the
   * board. The viewport clips, and the board is centred inside it, so on a
   * width-fitted board there is roughly 90dp of open space above and below where an
   * arrow that stopped at the board edge would visibly wink out.
   */
  describe('leaves the viewport, not just the board', () => {
    // A 20x20 board, a 12-cell column leaving upwards. The maze refit put paths this
    // long in every late level, and length is what breaks the old timing: the longer
    // the body, the more of the travel is spent before the tail even reaches the
    // board edge, so a fade pinned to a fraction of the *animation* fires earlier and
    // earlier in the arrow's actual journey.
    const FINE = 16;
    const FINE_GRID = 20;
    const CLEARANCE = 90;
    const longColumn = arrow(
      Array.from({length: 12}, (_, i) => [5, 15 - i] as [number, number]),
      'U',
    );
    const travelOf = (c: number): number =>
      exitTravelDistance(longColumn, FINE_GRID, FINE, c);
    const tailAt = (travelled: number): {x: number; y: number} =>
      pointsOf(
        buildRopeGeometry(
          longColumn,
          FINE_GRID,
          FINE,
          travelled,
          1,
          CLEARANCE,
        ).body,
      )[0];

    it('carries the tail past the clip, not just past the board edge', () => {
      // Above the board is y < 0; out of sight is y < -CLEARANCE.
      expect(tailAt(travelOf(CLEARANCE)).y).toBeLessThan(-CLEARANCE);
    });

    it('would still be in full view at the moment the old fade started', () => {
      // The regression this guards. The fade ran from 82% of the animation, and the
      // easing puts the arrow only 72% of the way along its travel by then — which
      // on this path leaves the tail inside the board, dissolving where it can be
      // seen. Nothing may fade here, so nothing fades at all any more.
      const eased = 0.35 * 0.82 + 0.65 * 0.82 * 0.82;
      expect(tailAt(eased * travelOf(CLEARANCE)).y).toBeGreaterThan(-CLEARANCE);
    });

    it('would have been retired inside the viewport without the clearance', () => {
      // What shipped before: travel measured to the board edge, so the arrow was
      // removed while still short of the clip, in open space.
      expect(tailAt(travelOf(0)).y).toBeGreaterThan(-CLEARANCE);
      expect(travelOf(CLEARANCE)).toBeCloseTo(travelOf(0) + CLEARANCE, 5);
    });
  });

  it('keeps the exit inside the 400-700ms window the design asks for', () => {
    for (const travel of [CELL, CELL * 8, CELL * 40]) {
      const ms = escapeDurationMs(travel, GRID * CELL);
      expect(ms).toBeGreaterThanOrEqual(400);
      expect(ms).toBeLessThanOrEqual(700);
    }
  });
});
