import {
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

  it('handles every direction, and a single-cell arrow that has no body', () => {
    for (const direction of ['U', 'D', 'L', 'R'] as const) {
      const single = arrow([[4, 4]], direction);
      const travel = exitTravelDistance(single, GRID, CELL);
      const rope = buildRopeGeometry(single, GRID, CELL, travel);
      // No body to draw, but the head must still be there and outside the board.
      expect(rope.body).toBe('');
      const nose = pointsOf(rope.head)[0];
      const outside =
        nose.x < 0 || nose.y < 0 || nose.x > GRID * CELL || nose.y > GRID * CELL;
      expect(outside).toBe(true);
    }
  });

  it('keeps the exit inside the 400-700ms window the design asks for', () => {
    for (const travel of [CELL, CELL * 8, CELL * 40]) {
      const ms = escapeDurationMs(travel, GRID * CELL);
      expect(ms).toBeGreaterThanOrEqual(400);
      expect(ms).toBeLessThanOrEqual(700);
    }
  });
});
