import {clamp} from './math';

/** §5.5 — viewport limits. minScale is fit; the board never zooms out past whole. */
export const MIN_SCALE = 1.0;
export const MAX_SCALE = 3.5;
export const DOUBLE_TAP_SCALE = 2.0;
/** Rubber-band overshoot allowed while dragging, sprung back on release. */
export const PAN_OVERSHOOT_DP = 40;
/** A touch is a tap if it lifts inside this window and moves less than TAP_SLOP_DP. */
export const TAP_MAX_MS = 250;
export const TAP_SLOP_DP = 10;
/** Above this the SVG re-renders once, debounced, to restore crispness. */
export const CRISP_RERENDER_SCALE = 1.5;
export const CRISP_RERENDER_DEBOUNCE_MS = 120;
/** The board SVG is rasterised at this multiple and displayed at 1.0 (§13). */
export const BASE_RESOLUTION_SCALE = 1.5;

export interface BoardMetrics {
  /** Side length of the square board in dp at scale 1. */
  size: number;
  cellSize: number;
  /** Left/top offset that centres the board inside its viewport. */
  originX: number;
  originY: number;
}

/**
 * The grid width at which the board first fills the screen. Below it the cell size
 * does *not* grow to take up the slack — a 6x6 board draws at the same cell as a
 * 17x17 one and simply sits small in the middle of the page.
 *
 * This is the single rule behind the reference's sense of scale, and it is measured
 * rather than guessed: across `ref/Arrow` the stroke width (and so the cell, at a
 * fixed ratio) is 12px on a 6-wide board, 12px on a 16-wide, then 11px at 18, 9px at
 * 22, 8px at 25 and 7px at 28 — i.e. constant up to about 17 columns and
 * fit-to-width above it, to within a pixel at every sample.
 *
 * Fitting small boards to the width instead — which is what this used to do — is
 * what made the tutorial levels read as three enormous pipes rather than as a small,
 * calm drawing: at 6 columns it hands every cell a sixth of the screen.
 */
export const FULL_WIDTH_GRID = 17;

/**
 * §5.4 — board fit size is min(screenWidth - 32, availableHeight); cellSize is floored
 * so the dot grid lands on whole dp and stays crisp at scale 1.
 */
export function computeBoardMetrics(
  screenWidth: number,
  availableHeight: number,
  gridSize: number,
): BoardMetrics {
  const fit = Math.max(120, Math.min(screenWidth - 32, availableHeight));
  const cellSize = Math.floor(fit / Math.max(gridSize, FULL_WIDTH_GRID));
  const size = cellSize * gridSize;
  return {
    size,
    cellSize,
    originX: (screenWidth - size) / 2,
    originY: (availableHeight - size) / 2,
  };
}

/**
 * §10.2 — arrow line weight.
 *
 * An arrow is a *line*, not a pipe. The weight is a fixed fraction of the cell so a
 * 6x6 board and a 28x28 board read as the same drawing at two sizes.
 *
 * 0.19 is measured, not chosen: every board in `ref/Arrow` draws a stroke of almost
 * exactly 0.19 x its dot pitch, from the 12px-on-63px of the tutorial levels to the
 * 7px-on-37px of level 10. It is what leaves a white gap of four-fifths of a cell
 * between two paths running side by side, which is the whole reason a dense maze
 * stays readable in one colour — the separation is the page showing through, not a
 * casing drawn under the line.
 *
 * The clamp only guards the extremes, where `FULL_WIDTH_GRID` has stopped helping:
 * without a floor a 28-wide board on a small phone thins to a hairline antialiasing
 * eats, and without a ceiling a tablet's cell goes back to rope.
 */
export const ARROW_STROKE_RATIO = 0.19;
export const ARROW_STROKE_MIN = 2;
export const ARROW_STROKE_MAX = 12;

export const strokeWidthFor = (cellSize: number): number =>
  clamp(cellSize * ARROW_STROKE_RATIO, ARROW_STROKE_MIN, ARROW_STROKE_MAX);

/** Head length along the direction of travel, and half its width across it. */
export interface ArrowHeadSize {
  length: number;
  halfWidth: number;
}

/**
 * §10.2 — the arrowhead, sized off the *stroke* rather than off the cell.
 *
 * Sizing a head off the cell is what turns it into a spearhead: thin the line without
 * touching the head and the triangle ends up five to eight times the width of the
 * thing it terminates. Tied to the stroke it stays a terminator at every grid size —
 * half-width 1.5x the line, length 3x — and reads as `----->`, not as `====|>`.
 *
 * The cell fractions are only a ceiling, for the fine boards where the stroke has hit
 * its floor: they stop a head spilling into the neighbouring path. Crucially the two
 * ceilings are applied as a single shrink factor rather than one each — clamping the
 * length and the width independently is what turns a 28x28 board's heads into squat
 * triangles wider than they are long, because the length ceiling bites first. One
 * factor keeps the head the same shape at every grid size, only smaller.
 */
/**
 * Both ratios are measured off a reference arrowhead: on a 12px stroke the triangle
 * runs 37px from base to tip and 38px across, i.e. 3.08x and 1.58x half-width. A head
 * that lands anywhere near "2x the line across" — which is what the shape reads as on
 * paper — does not register as a triangle at all at these stroke widths.
 */
export const HEAD_LENGTH_RATIO = 3.1;
export const HEAD_HALF_WIDTH_RATIO = 1.58;

export function arrowHeadSizeFor(
  cellSize: number,
  strokeWidth: number,
  pathLength: number,
): ArrowHeadSize {
  // A single-cell arrow has only a stub of body, so its head carries the whole
  // reading of direction and is allowed slightly more presence.
  const boost = pathLength === 1 ? 1.15 : 1;
  const length = strokeWidth * HEAD_LENGTH_RATIO * boost;
  const halfWidth = strokeWidth * HEAD_HALF_WIDTH_RATIO * boost;
  const shrink = Math.min(
    1,
    (cellSize * 0.62) / length,
    (cellSize * 0.34) / halfWidth,
  );
  return {length: length * shrink, halfWidth: halfWidth * shrink};
}

/**
 * §10.2 — the dot grid is a positioning aid and nothing more, so it has to stay well
 * under the arrows now that the arrows are thin. Small, and dimmed in the theme.
 */
export const dotRadiusFor = (cellSize: number): number =>
  clamp(cellSize * 0.055, 1.1, 3);

/**
 * Pan bounds so board edges never travel inside the viewport (§5.5). At scale 1 the
 * board exactly fits, so the only legal translation is zero.
 */
export function panBounds(
  boardSize: number,
  viewportSize: number,
  scale: number,
): {min: number; max: number} {
  const scaled = boardSize * scale;
  const slack = Math.max(0, (scaled - viewportSize) / 2);
  return {min: -slack, max: slack};
}

export function clampPan(
  value: number,
  boardSize: number,
  viewportSize: number,
  scale: number,
  overshoot = 0,
): number {
  'worklet';
  // clamp is inlined: this runs on the UI thread and must not call back into JS.
  const scaled = boardSize * scale;
  const slack = Math.max(0, (scaled - viewportSize) / 2);
  const min = -slack - overshoot;
  const max = slack + overshoot;
  return value < min ? min : value > max ? max : value;
}

/**
 * Screen point -> board space (cell units), inverting the container transform.
 * The board is centred in the viewport and scaled about that centre.
 */
export function screenToBoard(
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
  boardSize: number,
  cellSize: number,
  scale: number,
  translateX: number,
  translateY: number,
): {x: number; y: number} {
  const cx = viewportWidth / 2 + translateX;
  const cy = viewportHeight / 2 + translateY;
  const boardX = (screenX - cx) / scale + boardSize / 2;
  const boardY = (screenY - cy) / scale + boardSize / 2;
  return {x: boardX / cellSize, y: boardY / cellSize};
}
