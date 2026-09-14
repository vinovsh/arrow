import {clamp} from './math';

/** §5.5 — viewport limits. minScale is fit; the board never zooms out past whole. */
export const MIN_SCALE = 1.0;
export const MAX_SCALE = 3.5;
export const DOUBLE_TAP_SCALE = 2.0;
/** Rubber-band overshoot allowed while dragging, sprung back on release. */
export const PAN_OVERSHOOT_DP = 40;
/**
 * A touch is a tap if it lifts inside this window and moves less than TAP_SLOP_DP.
 * Generous on purpose: nothing on the board answers to a long press, so the only
 * thing a tight window buys is a press held a beat too long doing nothing at all,
 * which the player reads as the game having missed them.
 */
export const TAP_MAX_MS = 500;
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
 * §5.4 — board fit size is min(screenWidth - 32, availableHeight); cellSize is floored
 * so the dot grid lands on whole dp and stays crisp at scale 1.
 */
export function computeBoardMetrics(
  screenWidth: number,
  availableHeight: number,
  gridSize: number,
): BoardMetrics {
  const fit = Math.max(120, Math.min(screenWidth - 32, availableHeight));
  const cellSize = Math.floor(fit / gridSize);
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
 * An arrow is a *line*, not a pipe. The weight is a small fraction of the cell so a
 * 5x5 board and a 14x14 board read as the same drawing at two sizes, and the clamp is
 * what keeps that true at both ends: without a ceiling a 65dp cell on a 5x5 goes
 * straight back to rope, and without a floor a 14x14 on a small phone thins to a
 * hairline that antialiasing eats.
 *
 * The numbers land at roughly 7dp on a 5x5 and 3dp on a 14x14 — about a quarter of
 * what this used to draw, which is where the board's empty space comes from. Density
 * is unchanged: it was never the arrow count that filled the screen, it was the ink.
 */
export const ARROW_STROKE_RATIO = 0.13;
export const ARROW_STROKE_MIN = 2.5;
export const ARROW_STROKE_MAX = 7;

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
 * length and the width independently is what turns a 22x22 board's heads into squat
 * triangles wider than they are long, because the length ceiling bites first. One
 * factor keeps the head the same shape at every grid size, only smaller.
 */
export function arrowHeadSizeFor(
  cellSize: number,
  strokeWidth: number,
  pathLength: number,
): ArrowHeadSize {
  // A single-cell arrow has only a stub of body, so its head carries the whole
  // reading of direction and is allowed slightly more presence.
  const boost = pathLength === 1 ? 1.15 : 1;
  const length = strokeWidth * 3 * boost;
  const halfWidth = strokeWidth * 1.5 * boost;
  const shrink = Math.min(
    1,
    (cellSize * 0.44) / length,
    (cellSize * 0.26) / halfWidth,
  );
  return {length: length * shrink, halfWidth: halfWidth * shrink};
}

/**
 * §10.2 — the dot grid is a positioning aid and nothing more, so it has to stay well
 * under the arrows now that the arrows are thin. Small, and dimmed in the theme.
 */
export const dotRadiusFor = (cellSize: number): number =>
  clamp(cellSize * 0.03, 0.9, 2);

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
