/**
 * Colour assignment (§8.2, §4.2).
 *
 * Two rules, both about legibility rather than aesthetics: adjacent arrows must
 * differ so the eye can separate paths in a dense silhouette, and on boards of 40+
 * no colour may carry more than 25% of the arrows or the picture reads as noise.
 */
import type {ArrowColor, ArrowPath} from '../../src/game/models/types.ts';
import {ARROW_COLORS} from '../../src/game/models/types.ts';
import type {Rng} from '../../src/utils/rng.ts';

export const COLOUR_CAP_FROM_ARROWS = 40;
export const COLOUR_CAP_SHARE = 0.25;

/** Arrows are adjacent when any of their cells are orthogonally neighbouring. */
function adjacency(arrows: readonly ArrowPath[], gridSize: number): number[][] {
  const owner = new Int32Array(gridSize * gridSize).fill(-1);
  for (let i = 0; i < arrows.length; i++) {
    for (const cell of arrows[i].cells) {
      owner[cell.y * gridSize + cell.x] = i;
    }
  }
  const neighbours: Set<number>[] = arrows.map(() => new Set<number>());
  for (let i = 0; i < arrows.length; i++) {
    for (const cell of arrows[i].cells) {
      const around = [
        [cell.x, cell.y - 1],
        [cell.x, cell.y + 1],
        [cell.x - 1, cell.y],
        [cell.x + 1, cell.y],
      ];
      for (const [x, y] of around) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
          continue;
        }
        const other = owner[y * gridSize + x];
        if (other >= 0 && other !== i) {
          neighbours[i].add(other);
          neighbours[other].add(i);
        }
      }
    }
  }
  return neighbours.map(set => [...set]);
}

export interface ColourResult {
  colors: ArrowColor[];
  /** Largest share any single colour holds. */
  maxShare: number;
  adjacentClashes: number;
}

/**
 * Welsh-Powell order (most-constrained arrow first) with a usage-balancing tiebreak.
 * Eight colours against a planar-ish adjacency graph leaves plenty of slack, so the
 * cap is enforced as a preference and only reported if it could not be met.
 */
export function assignColours(
  arrows: readonly ArrowPath[],
  gridSize: number,
  rng: Rng,
): ColourResult {
  const neighbours = adjacency(arrows, gridSize);
  const order = arrows
    .map((_, i) => i)
    .sort((a, b) => neighbours[b].length - neighbours[a].length || a - b);

  const colors: (ArrowColor | null)[] = arrows.map(() => null);
  const usage = new Map<ArrowColor, number>(ARROW_COLORS.map(c => [c, 0]));
  const capped = arrows.length >= COLOUR_CAP_FROM_ARROWS;
  const cap = capped
    ? Math.max(1, Math.floor(arrows.length * COLOUR_CAP_SHARE))
    : Infinity;

  for (const index of order) {
    const taken = new Set(
      neighbours[index]
        .map(n => colors[n])
        .filter((c): c is ArrowColor => c !== null),
    );
    const legal = ARROW_COLORS.filter(c => !taken.has(c));
    const pool = legal.filter(c => (usage.get(c) ?? 0) < cap);
    const candidates =
      pool.length > 0 ? pool : legal.length > 0 ? legal : ARROW_COLORS;

    // Least-used first keeps the board balanced; the jitter stops every level in a
    // band from opening with the same colour in the same corner.
    let best = candidates[0];
    let bestScore = Infinity;
    for (const colour of candidates) {
      const score = (usage.get(colour) ?? 0) + rng.next() * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = colour;
      }
    }
    colors[index] = best;
    usage.set(best, (usage.get(best) ?? 0) + 1);
  }

  const resolved = colors as ArrowColor[];
  let clashes = 0;
  for (let i = 0; i < arrows.length; i++) {
    for (const n of neighbours[i]) {
      if (n > i && resolved[n] === resolved[i]) {
        clashes++;
      }
    }
  }
  const maxShare =
    Math.max(...[...usage.values()]) / Math.max(1, arrows.length);

  return {colors: resolved, maxShare, adjacentClashes: clashes};
}
