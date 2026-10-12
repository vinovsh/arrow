/**
 * Core data model — §12. Shared verbatim between the runtime app and the
 * build-time level pipeline in tools/, so both agree on what a level is.
 */

export type Direction = 'U' | 'D' | 'L' | 'R';

export type ArrowColor =
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'yellow'
  | 'blue'
  | 'white';

export const ARROW_COLORS: readonly ArrowColor[] = [
  'cyan',
  'green',
  'orange',
  'pink',
  'purple',
  'yellow',
  'blue',
  'white',
];

export type ArrowState = 'active' | 'escaping' | 'escaped';

export type Band =
  | 'Tutorial'
  | 'Easy'
  | 'Medium'
  | 'Medium+'
  | 'Hard'
  | 'Hard+'
  | 'Very Hard'
  | 'Expert'
  | 'Expert+'
  | 'Master'
  | 'Extreme'
  | 'Insane';

export interface GridPoint {
  x: number;
  y: number;
}

export interface ArrowPath {
  id: string;
  color: ArrowColor;
  /** Ordered tail to head; current boards use long, multi-turn paths. */
  cells: GridPoint[];
  /** Explicit; required for 1-cell arrows, redundant validation for the rest. */
  direction: Direction;
}

/** Cosmetic overlay (eyes, stem, whiskers). Occupies no grid cells. */
export interface DecorPath {
  /** SVG path data in normalised board coordinates: 0..1 across the whole board. */
  d: string;
  /** Stroke width in the same normalised units. */
  w?: number;
  fill?: boolean;
}

export interface Level {
  id: number;
  gridSize: number;
  theme: string;
  band: Band;
  /** Computed difficulty signal, 1..10; labels also consider board scale. */
  difficulty: number;
  parTime: number;
  arrows: ArrowPath[];
  decor?: DecorPath[];
}

/** Unit vectors for each direction, in grid space (y grows downward). */
export const DIR_VECTORS: Record<Direction, GridPoint> = {
  U: {x: 0, y: -1},
  D: {x: 0, y: 1},
  L: {x: -1, y: 0},
  R: {x: 1, y: 0},
};

export const ALL_DIRECTIONS: readonly Direction[] = ['U', 'D', 'L', 'R'];

/** A head must never aim at any part of its own body along its exit lane. */
export function headFacesOwnBody(
  arrow: Pick<ArrowPath, 'cells' | 'direction'>,
): boolean {
  const head = arrow.cells[arrow.cells.length - 1];
  if (!head) {
    return false;
  }
  const step = DIR_VECTORS[arrow.direction];
  return arrow.cells
    .slice(0, -1)
    .some(p =>
      step.x !== 0
        ? p.y === head.y && (p.x - head.x) * step.x > 0
        : p.x === head.x && (p.y - head.y) * step.y > 0,
    );
}

/** Perpendicular unit vector, used by the blocked-shake animation (§9.3). */
export function perpendicular(d: Direction): GridPoint {
  return d === 'U' || d === 'D' ? {x: 1, y: 0} : {x: 0, y: 1};
}

/** Direction implied by the final segment of a multi-cell path. */
export function directionFromCells(cells: GridPoint[]): Direction | null {
  if (cells.length < 2) {
    return null;
  }
  const a = cells[cells.length - 2];
  const b = cells[cells.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) {
    return 'R';
  }
  if (dx === -1 && dy === 0) {
    return 'L';
  }
  if (dx === 0 && dy === 1) {
    return 'D';
  }
  if (dx === 0 && dy === -1) {
    return 'U';
  }
  return null;
}

export function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export const cellIndex = (p: GridPoint, gridSize: number): number =>
  p.y * gridSize + p.x;

/** Runtime capacity for the long-path campaign; shipped arrows use 8..64 cells. */
export const MAX_PATH_CELLS = 64;
