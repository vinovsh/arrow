import type {ArrowPath, GridPoint} from '../models/types';
import {DIR_VECTORS} from '../models/types';
import type {ArrowHeadSize} from '../../utils/layout';
import {arrowHeadSizeFor, strokeWidthFor} from '../../utils/layout';

/**
 * Path and arrowhead geometry in board dp. Pure functions, memoised by the renderer
 * per (arrow, cellSize) — nothing here touches React or Reanimated, so the same code
 * serves the board, the hint pulse and the contact-sheet renderer in tools/.
 */

interface Point {
  x: number;
  y: number;
}

/** Everything a renderer needs to draw an arrow: two paths and the width between them. */
export interface ArrowStrokes {
  /** Polyline through cell centres, stopping short of the head for the triangle. */
  body: string;
  /** Filled triangle at the head, aligned to `direction`. */
  head: string;
  strokeWidth: number;
  headSize: ArrowHeadSize;
}

export interface ArrowGeometry extends ArrowStrokes {
  /** Head cell centre, used to centre a hint's auto-pan (§3.4). */
  headCentre: Point;
  /** Board-space bounds, used by the off-screen blocker chevron (§9.3). */
  bounds: {minX: number; minY: number; maxX: number; maxY: number};
}

const centreOf = (cell: GridPoint, cellSize: number): Point => ({
  x: (cell.x + 0.5) * cellSize,
  y: (cell.y + 0.5) * cellSize,
});

const distanceBetween = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * A single-cell arrow has no run between cell centres to draw, and a bare triangle
 * floating in a cell does not read as an arrow — it reads as a caret. It gets a stub
 * of body behind the head instead, as a fraction of a cell, so the whole board speaks
 * one visual language: a line with a small head on it.
 */
export const SINGLE_CELL_STUB = 0.34;

/**
 * The centreline an arrow is drawn along, tail first.
 *
 * For a real path this is just the cell centres. For a single cell it is a stub
 * reaching back from the centre against the direction of travel — which is what makes
 * the stub travel with the arrow rather than being tacked on at draw time, since the
 * exit slides along this same polyline.
 */
export function bodyPolyline(arrow: ArrowPath, cellSize: number): Point[] {
  const centres = arrow.cells.map(cell => centreOf(cell, cellSize));
  if (centres.length > 1) {
    return centres;
  }
  const step = DIR_VECTORS[arrow.direction];
  const only = centres[0];
  const stub = cellSize * SINGLE_CELL_STUB;
  return [{x: only.x - step.x * stub, y: only.y - step.y * stub}, only];
}

/**
 * The head triangle, straddling `nose`: it reaches 55% of its length ahead and 45%
 * behind, so the arrow's tip sits just past the cell centre while the base stays
 * inside it.
 */
function headTriangle(
  nose: Point,
  step: GridPoint,
  headSize: ArrowHeadSize,
): string {
  const tip = {
    x: nose.x + step.x * headSize.length * 0.55,
    y: nose.y + step.y * headSize.length * 0.55,
  };
  const base = {
    x: nose.x - step.x * headSize.length * 0.45,
    y: nose.y - step.y * headSize.length * 0.45,
  };
  const perp = {x: -step.y, y: step.x};
  const w = headSize.halfWidth;
  return (
    `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} ` +
    `L ${(base.x + perp.x * w).toFixed(2)} ${(base.y + perp.y * w).toFixed(2)} ` +
    `L ${(base.x - perp.x * w).toFixed(2)} ${(base.y - perp.y * w).toFixed(2)} Z`
  );
}

/**
 * The body as an SVG path, with its last point pulled back inside the triangle's
 * base. A round cap then fills the join invisibly at any stroke width, so the line and
 * the head read as one object rather than as a stick with a blob on the end.
 */
function bodyPath(points: Point[], headSize: ArrowHeadSize): string {
  if (points.length < 2) {
    return '';
  }
  const drawn = points.map(p => ({...p}));
  const last = drawn[drawn.length - 1];
  const previous = drawn[drawn.length - 2];
  const dx = last.x - previous.x;
  const dy = last.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  const shortenBy = Math.min(length * 0.45, headSize.length * 0.45);
  last.x -= (dx / length) * shortenBy;
  last.y -= (dy / length) * shortenBy;
  return drawn
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

export function buildArrowGeometry(
  arrow: ArrowPath,
  cellSize: number,
): ArrowGeometry {
  const strokeWidth = strokeWidthFor(cellSize);
  const headSize = arrowHeadSizeFor(cellSize, strokeWidth, arrow.cells.length);
  const step = DIR_VECTORS[arrow.direction];
  const points = bodyPolyline(arrow, cellSize);
  const head = centreOf(arrow.cells[arrow.cells.length - 1], cellSize);

  const xs = arrow.cells.map(c => c.x);
  const ys = arrow.cells.map(c => c.y);

  return {
    body: bodyPath(points, headSize),
    head: headTriangle(head, step, headSize),
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

/** How far past the board edge the tail is pulled before the arrow is retired. */
export const EXIT_MARGIN_CELLS = 2;

/**
 * Length of the arrow's own body, tail to head. Measured off the drawn polyline
 * rather than assumed from the cell count, so a single cell's stub is carried out of
 * the board like any other body instead of vanishing at the boundary.
 */
export const bodyLengthOf = (arrow: ArrowPath, cellSize: number): number => {
  const points = bodyPolyline(arrow, cellSize);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceBetween(points[i - 1], points[i]);
  }
  return total;
};

/**
 * Distance the tail travels for the whole arrow to be *out of sight*.
 *
 * Clearing the board is not enough, and that is the trap this walked into twice. The
 * board sits centred in a viewport that clips (`overflow: 'hidden'`), so there is a
 * band of empty space between the board edge and the point where an arrow actually
 * stops being visible — on a width-fitted board that band is a couple of dp at the
 * sides and around 90dp above and below. An arrow retired at the board edge is
 * retired in open space, in full view, which reads as the arrow being deleted rather
 * than leaving. `clearance` is the dp from the board edge to the clip in the
 * direction of travel; the caller measures it because only the screen knows it.
 *
 * The sum: the body's own length, which carries the tail to where the head started,
 * plus the head's run to the board edge, plus the clearance, plus a margin so the
 * arrow is gone rather than resting on the boundary.
 */
export function exitTravelDistance(
  arrow: ArrowPath,
  gridSize: number,
  cellSize: number,
  clearance = 0,
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
    bodyLengthOf(arrow, cellSize) +
    headToEdge +
    clearance +
    EXIT_MARGIN_CELLS * cellSize
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
  clearance: number,
): ExtendedPath {
  const step = DIR_VECTORS[arrow.direction];
  const centreline = bodyPolyline(arrow, cellSize);
  const head = centreline[centreline.length - 1];
  const runway =
    exitTravelDistance(arrow, gridSize, cellSize, clearance) +
    bodyLengthOf(arrow, cellSize) +
    cellSize;

  const vertices: Point[] = [
    ...centreline,
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

/** A rope-deformed arrow: the same two paths a resting one has. */
export type RopeGeometry = ArrowStrokes;

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
  clearance = 0,
): RopeGeometry {
  const path = extendedPath(arrow, gridSize, cellSize, clearance);
  const strokeWidth = strokeWidthFor(cellSize);
  const headSize = arrowHeadSizeFor(cellSize, strokeWidth, arrow.cells.length);
  const step = DIR_VECTORS[arrow.direction];

  const points = sliceBetween(
    path,
    travelled,
    travelled + bodyLengthOf(arrow, cellSize) * stretch,
  );

  // The curve is straight past the head, so the moment the arrow moves at all its
  // head points the way it was pointing when tapped, and keeps doing so (§2.1).
  return {
    body: bodyPath(points, headSize),
    head: headTriangle(points[points.length - 1], step, headSize),
    strokeWidth,
    headSize,
  };
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
