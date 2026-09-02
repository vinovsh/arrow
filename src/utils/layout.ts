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

/** §10.2 — arrow stroke is 0.46 x cellSize with an 8dp floor. */
export const strokeWidthFor = (cellSize: number): number =>
  Math.max(8, cellSize * 0.46);

/** §10.2 — single-cell arrowheads are drawn larger so they stay directional. */
export const arrowHeadSizeFor = (
  cellSize: number,
  pathLength: number,
): number => (pathLength === 1 ? cellSize * 0.7 : cellSize * 0.52);

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
