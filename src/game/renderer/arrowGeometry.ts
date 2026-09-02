import type {ArrowPath, GridPoint} from '../models/types';
import {DIR_VECTORS} from '../models/types';
import {arrowHeadSizeFor, strokeWidthFor} from '../../utils/layout';

/**
 * Path and arrowhead geometry in board dp. Pure functions, memoised by the renderer
 * per (arrow, cellSize) — nothing here touches React or Reanimated, so the same code
 * serves the board, the hint pulse and the contact-sheet renderer in tools/.
 */

export interface ArrowGeometry {
  /** Polyline through cell centres, stopping short of the head for the triangle. */
  body: string;
  /** Filled triangle at the head, aligned to `direction`. */
  head: string;
  strokeWidth: number;
  headSize: number;
  /** Head cell centre, used to centre a hint's auto-pan (§3.4). */
  headCentre: {x: number; y: number};
  /** Board-space bounds, used by the off-screen blocker chevron (§9.3). */
  bounds: {minX: number; minY: number; maxX: number; maxY: number};
}

const centreOf = (
  cell: GridPoint,
  cellSize: number,
): {x: number; y: number} => ({
  x: (cell.x + 0.5) * cellSize,
  y: (cell.y + 0.5) * cellSize,
});

export function buildArrowGeometry(
  arrow: ArrowPath,
  cellSize: number,
): ArrowGeometry {
  const strokeWidth = strokeWidthFor(cellSize);
  const headSize = arrowHeadSizeFor(cellSize, arrow.cells.length);
  const step = DIR_VECTORS[arrow.direction];
  const head = centreOf(arrow.cells[arrow.cells.length - 1], cellSize);

  // The triangle sits ahead of where the body stops, so the two read as one arrow
  // rather than as a line with a blob welded on.
  const tipDistance = headSize * 0.55;
  const baseDistance = headSize * 0.45;
  const tip = {
    x: head.x + step.x * tipDistance,
    y: head.y + step.y * tipDistance,
  };
  const base = {
    x: head.x - step.x * baseDistance,
    y: head.y - step.y * baseDistance,
  };
  const perp = {x: -step.y, y: step.x};
  const half = headSize * 0.62;

  const headPath =
    `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} ` +
    `L ${(base.x + perp.x * half).toFixed(2)} ${(
      base.y +
      perp.y * half
    ).toFixed(2)} ` +
    `L ${(base.x - perp.x * half).toFixed(2)} ${(
      base.y -
      perp.y * half
    ).toFixed(2)} Z`;

  let body = '';
  if (arrow.cells.length > 1) {
    const points = arrow.cells.map(cell => centreOf(cell, cellSize));
    // Stop the stroke just inside the triangle's base; a round cap then fills the
    // join invisibly at any stroke width.
    const last = points[points.length - 1];
    const previous = points[points.length - 2];
    const dx = last.x - previous.x;
    const dy = last.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const shortenBy = Math.min(length * 0.45, baseDistance);
    points[points.length - 1] = {
      x: last.x - (dx / length) * shortenBy,
      y: last.y - (dy / length) * shortenBy,
    };
    body = points
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
      )
      .join(' ');
  }

  const xs = arrow.cells.map(c => c.x);
  const ys = arrow.cells.map(c => c.y);

  return {
    body,
    head: headPath,
    strokeWidth,
    headSize,
    headCentre: head,
    bounds: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

// ---------------------------------------------------------------------------
// Exit motion
//
// An arrow leaving the board behaves like a rope pulled from its head, not like a
// rigid pipe sliding sideways. Translating the whole shape keeps every bend intact,
// which looks wrong the moment a path has a corner in it: an L drifts away still
// shaped like an L.
//
// The rope is modelled by arc-length reparameterisation along an *extended* path:
// the arrow's own polyline, continued straight out of the head in its pointing
// direction. The arrow occupies a fixed length of that curve, and pulling it out
// only slides which stretch of the curve it occupies.
//
//     travelled = 0    tail~~~~~~~~~head
//     travelled = k         tail~~~~~~~~~head
//
// Because the curve is straight past the head, every point behind the head
// eventually rounds the last corner and joins the straight run. Bends therefore
// travel backwards along the body and vanish off the tail, exactly as rope pulled
// through a bend does. No point ever moves in a direction the rope had not already
// gone, which is what makes it read as flexible rather than as a shape being dragged.
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

/** How far past the board edge the tail is pulled before the arrow is retired. */
export const EXIT_MARGIN_CELLS = 2;

/** Length of the arrow's own body, tail centre to head centre. */
export const bodyLengthOf = (arrow: ArrowPath, cellSize: number): number =>
  (arrow.cells.length - 1) * cellSize;

const distanceBetween = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Distance the tail travels along the extended path for the whole arrow to clear the
 * board: the body's own length, which carries the tail to where the head started,
 * plus the head's run to the edge, plus a margin so the arrow is gone rather than
 * resting on the boundary.
 */
export function exitTravelDistance(
  arrow: ArrowPath,
  gridSize: number,
  cellSize: number,
): number {
  const head = centreOf(arrow.cells[arrow.cells.length - 1], cellSize);
  const size = gridSize * cellSize;
  let headToEdge: number;
  switch (arrow.direction) {
    case 'R':
      headToEdge = size - head.x;
      break;
    case 'L':
      headToEdge = head.x;
      break;
    case 'D':
      headToEdge = size - head.y;
      break;
    case 'U':
      headToEdge = head.y;
      break;
  }
  return (
    bodyLengthOf(arrow, cellSize) + headToEdge + EXIT_MARGIN_CELLS * cellSize
  );
}

interface ExtendedPath {
  vertices: Point[];
  /** Cumulative arc length at each vertex. */
  cumulative: number[];
}

/** The arrow's polyline, continued out of the head far enough to finish the exit on. */
function extendedPath(
  arrow: ArrowPath,
  gridSize: number,
  cellSize: number,
): ExtendedPath {
  const step = DIR_VECTORS[arrow.direction];
  const centres = arrow.cells.map(cell => centreOf(cell, cellSize));
  const head = centres[centres.length - 1];
  const runway =
    exitTravelDistance(arrow, gridSize, cellSize) +
    bodyLengthOf(arrow, cellSize) +
    cellSize;

  const vertices: Point[] = [
    ...centres,
    {x: head.x + step.x * runway, y: head.y + step.y * runway},
  ];
  const cumulative = [0];
  for (let i = 1; i < vertices.length; i++) {
    cumulative.push(
      cumulative[i - 1] + distanceBetween(vertices[i - 1], vertices[i]),
    );
  }
  return {vertices, cumulative};
}

/** The point at arc length `s` along the extended path. */
function pointAt(path: ExtendedPath, s: number): Point {
  const {vertices, cumulative} = path;
  const clamped = Math.max(0, Math.min(cumulative[cumulative.length - 1], s));
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < clamped) {
    i++;
  }
  const span = cumulative[i] - cumulative[i - 1];
  const t = span === 0 ? 0 : (clamped - cumulative[i - 1]) / span;
  const a = vertices[i - 1];
  const b = vertices[i];
  return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
}

/** The stretch of the extended path between two arc lengths, as a polyline. */
function sliceBetween(path: ExtendedPath, from: number, to: number): Point[] {
  const points: Point[] = [pointAt(path, from)];
  for (let i = 0; i < path.vertices.length; i++) {
    if (path.cumulative[i] > from && path.cumulative[i] < to) {
      points.push(path.vertices[i]);
    }
  }
  points.push(pointAt(path, to));

  // A corner landing on an endpoint would otherwise appear twice, giving a
  // zero-length segment and a visible pip under a round line cap.
  return points.filter(
    (p, i) => i === 0 || distanceBetween(points[i - 1], p) > 0.01,
  );
}

export interface RopeGeometry {
  body: string;
  head: string;
  strokeWidth: number;
  headSize: number;
}

/**
 * The arrow's shape after being pulled `travelled` dp along its extended path.
 *
 * `stretch` briefly lengthens the body — the rope giving a little as it is yanked —
 * and is back to 1 by the time the arrow is clear, so its resting size never changes.
 */
export function buildRopeGeometry(
  arrow: ArrowPath,
  gridSize: number,
  cellSize: number,
  travelled: number,
  stretch = 1,
): RopeGeometry {
  const path = extendedPath(arrow, gridSize, cellSize);
  const strokeWidth = strokeWidthFor(cellSize);
  const headSize = arrowHeadSizeFor(cellSize, arrow.cells.length);
  const step = DIR_VECTORS[arrow.direction];

  const points = sliceBetween(
    path,
    travelled,
    travelled + bodyLengthOf(arrow, cellSize) * stretch,
  );

  // The curve is straight past the head, so the moment the arrow moves at all its
  // head points the way it was pointing when tapped, and keeps doing so (§2.1).
  const nose = points[points.length - 1];
  const tipDistance = headSize * 0.55;
  const baseDistance = headSize * 0.45;
  const tip = {
    x: nose.x + step.x * tipDistance,
    y: nose.y + step.y * tipDistance,
  };
  const base = {
    x: nose.x - step.x * baseDistance,
    y: nose.y - step.y * baseDistance,
  };
  const perp = {x: -step.y, y: step.x};
  const half = headSize * 0.62;
  const headPath =
    `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} ` +
    `L ${(base.x + perp.x * half).toFixed(2)} ${(
      base.y +
      perp.y * half
    ).toFixed(2)} ` +
    `L ${(base.x - perp.x * half).toFixed(2)} ${(
      base.y -
      perp.y * half
    ).toFixed(2)} Z`;

  let body = '';
  if (points.length > 1) {
    const drawn = points.map(p => ({...p}));
    // Stop the stroke inside the triangle's base, as the resting arrow does, so the
    // join stays invisible at any stroke width.
    const last = drawn[drawn.length - 1];
    const previous = drawn[drawn.length - 2];
    const dx = last.x - previous.x;
    const dy = last.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const shortenBy = Math.min(length * 0.45, baseDistance);
    last.x -= (dx / length) * shortenBy;
    last.y -= (dy / length) * shortenBy;
    body = drawn
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
      )
      .join(' ');
  }

  return {body, head: headPath, strokeWidth, headSize};
}

/**
 * 400-700ms, scaled by how far the arrow has to travel, so a path leaving from the
 * far side of a 14x14 board does not crawl while a one-cell hop off the edge feels
 * instant.
 */
export function escapeDurationMs(travel: number, boardSize: number): number {
  const t = Math.min(1, travel / Math.max(1, boardSize));
  return Math.round(400 + t * 300);
}
