/**
 * Stage 1 — shape mask (§8.1).
 *
 * A shape is rasterised at the slot's grid size and then nudged to the exact cell
 * count the slot needs (`targetArrows * targetMeanPathLength`, ±8%). Nudging happens
 * by dilating or eroding the silhouette one boundary cell at a time, always choosing
 * the cell that keeps the outline smoothest, so the picture survives the fit.
 */
import type {Rng} from '../../src/utils/rng.ts';
import type {Mask} from '../shapes/dsl.ts';
import {countCells, rasterise} from '../shapes/dsl.ts';
import type {ShapeDef} from '../shapes/library.ts';

export interface FittedMask {
  mask: Mask;
  cells: {x: number; y: number}[];
  cellCount: number;
  /** Rasterisation threshold that got closest before dilate/erode ran. */
  threshold: number;
}

/** §8.1 — the mask must land within this fraction of the requested cell count. */
export const MASK_TOLERANCE = 0.08;

const neighbours4 = (x: number, y: number): [number, number][] => [
  [x, y - 1],
  [x, y + 1],
  [x - 1, y],
  [x + 1, y],
];

const inBounds = (mask: Mask, x: number, y: number): boolean =>
  y >= 0 && y < mask.length && x >= 0 && x < mask[0].length;

const at = (mask: Mask, x: number, y: number): boolean =>
  inBounds(mask, x, y) && mask[y][x];

function filledNeighbourCount(mask: Mask, x: number, y: number): number {
  let n = 0;
  for (const [nx, ny] of neighbours4(x, y)) {
    if (at(mask, nx, ny)) {
      n++;
    }
  }
  return n;
}

/** Cells that could be added: empty, inside the grid, touching the silhouette. */
function growthCandidates(
  mask: Mask,
): {x: number; y: number; support: number}[] {
  const out: {x: number; y: number; support: number}[] = [];
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      if (mask[y][x]) {
        continue;
      }
      const support = filledNeighbourCount(mask, x, y);
      if (support > 0) {
        out.push({x, y, support});
      }
    }
  }
  return out;
}

/** Filled cells whose removal cannot disconnect the silhouette locally. */
function shrinkCandidates(
  mask: Mask,
): {x: number; y: number; support: number}[] {
  const out: {x: number; y: number; support: number}[] = [];
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      if (!mask[y][x]) {
        continue;
      }
      const support = filledNeighbourCount(mask, x, y);
      // A cell with one filled neighbour is a spur; two or fewer is an edge cell.
      if (support <= 2) {
        out.push({x, y, support});
      }
    }
  }
  return out;
}

/** Flood fill over 4-connectivity; the decomposer needs one connected blob. */
export function isConnected(mask: Mask): boolean {
  let start: [number, number] | null = null;
  let total = 0;
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      if (mask[y][x]) {
        total++;
        if (!start) {
          start = [x, y];
        }
      }
    }
  }
  if (!start) {
    return false;
  }
  const seen = new Set<string>();
  const stack: [number, number][] = [start];
  seen.add(`${start[0]},${start[1]}`);
  while (stack.length) {
    const [x, y] = stack.pop() as [number, number];
    for (const [nx, ny] of neighbours4(x, y)) {
      const key = `${nx},${ny}`;
      if (at(mask, nx, ny) && !seen.has(key)) {
        seen.add(key);
        stack.push([nx, ny]);
      }
    }
  }
  return seen.size === total;
}

/** Drops any component smaller than the largest, so decomposition sees one blob. */
export function keepLargestComponent(mask: Mask): Mask {
  const height = mask.length;
  const width = mask[0].length;
  const label = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y][x] || label[y * width + x] >= 0) {
        continue;
      }
      const id = sizes.length;
      let size = 0;
      const stack: [number, number][] = [[x, y]];
      label[y * width + x] = id;
      while (stack.length) {
        const [cx, cy] = stack.pop() as [number, number];
        size++;
        for (const [nx, ny] of neighbours4(cx, cy)) {
          if (at(mask, nx, ny) && label[ny * width + nx] < 0) {
            label[ny * width + nx] = id;
            stack.push([nx, ny]);
          }
        }
      }
      sizes.push(size);
    }
  }
  if (sizes.length <= 1) {
    return mask;
  }
  let best = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] > sizes[best]) {
      best = i;
    }
  }
  return mask.map((row, y) =>
    row.map((v, x) => v && label[y * width + x] === best),
  );
}

function cloneMask(mask: Mask): Mask {
  return mask.map(row => row.slice());
}

/**
 * Rasterise `shape` at `gridSize` and reshape it to `targetCells`.
 *
 * Threshold is scanned first because it changes the silhouette coherently — a fatter
 * cat still reads as a cat. Only the residual is closed by adding or removing
 * individual boundary cells, and those are chosen by neighbour support so the result
 * stays a blob rather than growing whiskers.
 */
export function fitMask(
  shape: ShapeDef,
  gridSize: number,
  targetCells: number,
  rng: Rng,
): FittedMask | null {
  let best: {mask: Mask; threshold: number; distance: number} | null = null;
  for (let t = 0.18; t <= 0.82; t += 0.02) {
    const raw = keepLargestComponent(rasterise(shape.ops, gridSize, t));
    const count = countCells(raw);
    if (count === 0) {
      continue;
    }
    const distance = Math.abs(count - targetCells);
    if (!best || distance < best.distance) {
      best = {mask: raw, threshold: t, distance};
    }
  }
  if (!best) {
    return null;
  }

  const mask = cloneMask(best.mask);
  let count = countCells(mask);
  let guard = gridSize * gridSize * 2;

  while (count < targetCells && guard-- > 0) {
    const options = growthCandidates(mask);
    if (options.length === 0) {
      break;
    }
    // Prefer cells that already have the most filled neighbours: those fill in
    // concavities instead of sprouting spurs off the outline.
    const maxSupport = Math.max(...options.map(o => o.support));
    const pool = options.filter(o => o.support === maxSupport);
    const pick = pool[rng.int(pool.length)];
    mask[pick.y][pick.x] = true;
    count++;
  }

  while (count > targetCells && guard-- > 0) {
    const options = shrinkCandidates(mask);
    if (options.length === 0) {
      break;
    }
    const minSupport = Math.min(...options.map(o => o.support));
    const pool = options.filter(o => o.support === minSupport);
    const pick = pool[rng.int(pool.length)];
    mask[pick.y][pick.x] = false;
    if (!isConnected(mask)) {
      mask[pick.y][pick.x] = true;
      // Nothing safe left to trim; stop rather than fragment the picture.
      const remaining = shrinkCandidates(mask).length;
      if (remaining <= 1) {
        break;
      }
      continue;
    }
    count--;
  }

  const cells: {x: number; y: number}[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (mask[y][x]) {
        cells.push({x, y});
      }
    }
  }

  if (
    Math.abs(cells.length - targetCells) >
    Math.max(2, targetCells * MASK_TOLERANCE)
  ) {
    return null;
  }

  return {mask, cells, cellCount: cells.length, threshold: best.threshold};
}

/** Mask cells with at least one empty or off-board neighbour — the silhouette outline. */
export function contourCells(mask: Mask): {x: number; y: number}[] {
  const out: {x: number; y: number}[] = [];
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      if (!mask[y][x]) {
        continue;
      }
      if (filledNeighbourCount(mask, x, y) < 4) {
        out.push({x, y});
      }
    }
  }
  return out;
}
