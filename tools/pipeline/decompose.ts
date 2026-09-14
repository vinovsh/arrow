/**
 * Stage 2 — path decomposition (§8.2).
 *
 * Carves a mask into simple paths of 1-8 cells that match the band's length mix,
 * consuming every mask cell. Reproducible from (shape, gridSize, seed).
 *
 * Two properties make this tractable where a naive DFS stalls:
 *   - a length-1 path is always legal, so the carve can never orphan a cell;
 *   - lengths are drawn up front as a multiset summing to the mask size, so the
 *     arrow count is decided before any geometry is walked rather than discovered
 *     afterwards.
 */
import type {GridPoint} from '../../src/game/models/types.ts';
import {MAX_PATH_CELLS} from '../../src/game/models/types.ts';
import type {Rng} from '../../src/utils/rng.ts';
import type {Mask} from '../shapes/dsl.ts';
import type {LengthMix} from './plan.ts';
import {contourCells} from './mask.ts';

/**
 * §4.2 — the carver's range.
 *
 * Both of these used to be the binding constraint on how a board reads. At 8 cells
 * and 3 turns the longest path could cross half a small board and bend three times,
 * which sounds generous until the length mix is weighted so that lengths 1-2 win 64%
 * of the draws — the range was there, and the mix never spent it. Now that the mix is
 * built from a target mean, the range is what actually decides whether a path can
 * snake across the board and double back, so it is set for the maze the levels are
 * meant to be rather than for the scatter they were.
 */
export const MAX_PATH_LENGTH = MAX_PATH_CELLS;
export const MAX_TURNS = 6;
/** §4.2 — every band keeps at least this many long, turning "feature paths". */
export const FEATURE_PATHS = 3;
export const FEATURE_MIN_LENGTH = 6;

export interface CarvedPath {
  cells: GridPoint[];
  turns: number;
  feature: boolean;
}

export interface Decomposition {
  paths: CarvedPath[];
  /** Observed proportion per length, index 0 = length 1. */
  distribution: number[];
}

/**
 * Length multiset with exactly `count` entries summing to `total`.
 *
 * Drawing each length independently from the mix looks natural and is wrong: a
 * 50-sample draw from a distribution misses its own bucket shares by several
 * percentage points, and §8.4 fails a level whose mix is more than 3 points off. So
 * buckets are filled by largest-remainder quota instead — the closest integer
 * multiset to the target mix at this count — and the randomness moves to which paths
 * get which lengths, which is where it actually shows on the board.
 *
 * The quota is then nudged to make the lengths sum to `total`, always by one cell at
 * a time and always out of whichever bucket is currently furthest above its share, so
 * the mix degrades as little as the cell count allows.
 */
export function drawLengths(
  count: number,
  total: number,
  mix: LengthMix,
  rng: Rng,
): number[] | null {
  if (count <= 0 || total < count || total > count * MAX_PATH_LENGTH) {
    return null;
  }

  const buckets = new Array(MAX_PATH_LENGTH).fill(0);
  const remainders: {index: number; fraction: number}[] = [];
  let assigned = 0;
  for (let i = 0; i < MAX_PATH_LENGTH; i++) {
    const exact = (mix.weights[i] ?? 0) * count;
    const whole = Math.floor(exact);
    buckets[i] = whole;
    assigned += whole;
    remainders.push({index: i, fraction: exact - whole});
  }
  remainders.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; assigned < count; i++) {
    buckets[remainders[i % remainders.length].index]++;
    assigned++;
  }

  const sumOf = (): number => buckets.reduce((s, n, i) => s + n * (i + 1), 0);
  const share = (i: number): number =>
    buckets[i] / count - (mix.weights[i] ?? 0);

  let guard = count * MAX_PATH_LENGTH * 4;
  while (sumOf() !== total && guard-- > 0) {
    const grow = sumOf() < total;
    // Move one path up or down a bucket. Take from the bucket most over its share and
    // give to the one most under it, so each cell of drift costs the least mix error.
    let from = -1;
    let bestFrom = -Infinity;
    for (let i = 0; i < MAX_PATH_LENGTH; i++) {
      const canMove =
        buckets[i] > 0 && (grow ? i < MAX_PATH_LENGTH - 1 : i > 0);
      if (canMove && share(i) > bestFrom) {
        bestFrom = share(i);
        from = i;
      }
    }
    if (from < 0) {
      break;
    }
    buckets[from]--;
    buckets[grow ? from + 1 : from - 1]++;
  }
  if (sumOf() !== total) {
    return null;
  }

  const lengths: number[] = [];
  for (let i = 0; i < MAX_PATH_LENGTH; i++) {
    for (let k = 0; k < buckets[i]; k++) {
      lengths.push(i + 1);
    }
  }
  return rng.shuffle(lengths);
}

const KEY = (p: GridPoint): number => p.y * 64 + p.x;

interface Carver {
  gridSize: number;
  /** -1 unassigned, -2 not part of the mask, else path index. */
  owner: Int32Array;
}

const idx = (c: Carver, x: number, y: number): number => y * c.gridSize + x;

const isFree = (c: Carver, x: number, y: number): boolean =>
  x >= 0 &&
  y >= 0 &&
  x < c.gridSize &&
  y < c.gridSize &&
  c.owner[idx(c, x, y)] === -1;

function freeNeighbours(c: Carver, x: number, y: number): GridPoint[] {
  const out: GridPoint[] = [];
  if (isFree(c, x, y - 1)) {
    out.push({x, y: y - 1});
  }
  if (isFree(c, x, y + 1)) {
    out.push({x, y: y + 1});
  }
  if (isFree(c, x - 1, y)) {
    out.push({x: x - 1, y});
  }
  if (isFree(c, x + 1, y)) {
    out.push({x: x + 1, y});
  }
  return out;
}

/**
 * A path must not touch itself: no two non-consecutive cells may be orthogonally
 * adjacent. Without this an S-bend can double back and read as a solid blob rather
 * than as an arrow.
 */
function touchesSelf(path: GridPoint[], candidate: GridPoint): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const c = path[i];
    if (Math.abs(c.x - candidate.x) + Math.abs(c.y - candidate.y) === 1) {
      return true;
    }
  }
  return false;
}

function isTurn(a: GridPoint, b: GridPoint, c: GridPoint): boolean {
  return b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y;
}

/**
 * A bend needs a straight run behind it. Without this the walker takes a corner at
 * every opportunity and the path staircases — which occupies the same cells but reads
 * as a diagonal smear rather than as a route, and is the one shape a maze must not
 * have. Runs longer than `MAX_STRAIGHT_RUN` are nudged the other way, so a path that
 * has been going straight for a while starts looking for its next corner.
 */
const MIN_RUN_BEFORE_TURN = 2;
const MAX_STRAIGHT_RUN = 4;
const TURN_REWARD = 4;

/**
 * Walk one path from `start` up to `targetLength`. Candidate scoring keeps the
 * remaining mask carvable: stepping into a cell that would strand a neighbour with
 * no free neighbours of its own is penalised, since that neighbour then costs a
 * length-1 path and skews the distribution.
 *
 * Turning used to cost -1 per bend after the first, so the walker went straight
 * whenever it could and 80% of the shipped arrows had no bend at all. Bends are now
 * what the score is looking for; keeping the board carvable is still the first term.
 */
function walk(
  c: Carver,
  start: GridPoint,
  targetLength: number,
  wantTurn: boolean,
  rng: Rng,
): CarvedPath {
  const path: GridPoint[] = [start];
  let turns = 0;
  // Segments travelled since the last bend, so the scorer can tell a path that has
  // just turned from one that has been running straight long enough to earn a corner.
  let run = 0;
  c.owner[idx(c, start.x, start.y)] = -3; // reserved while walking

  while (path.length < targetLength) {
    const last = path[path.length - 1];
    const options = freeNeighbours(c, last.x, last.y).filter(
      n => !touchesSelf(path, n),
    );
    if (options.length === 0) {
      break;
    }

    let best: GridPoint | null = null;
    let bestScore = -Infinity;
    for (const option of options) {
      const turning =
        path.length >= 2 && isTurn(path[path.length - 2], last, option);
      if (turning && turns >= MAX_TURNS) {
        continue;
      }
      // Onward mobility after taking this step, minus the risk of stranding cells.
      const onward = freeNeighbours(c, option.x, option.y).filter(
        n => KEY(n) !== KEY(last),
      ).length;
      let score = onward * 2;
      if (turning) {
        score +=
          run < MIN_RUN_BEFORE_TURN
            ? -8
            : TURN_REWARD + Math.min(3, run - MIN_RUN_BEFORE_TURN);
        if (wantTurn && turns === 0) {
          score += 6;
        }
      } else if (run >= MAX_STRAIGHT_RUN) {
        score -= 3;
      }
      score += rng.next() * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    if (!best) {
      break;
    }
    if (path.length >= 2 && isTurn(path[path.length - 2], last, best)) {
      turns++;
      run = 1;
    } else {
      run++;
    }
    path.push(best);
    c.owner[idx(c, best.x, best.y)] = -3;
  }

  return {cells: path, turns, feature: false};
}

/**
 * Start-cell choice. Long paths want room, short paths want to mop up the awkward
 * cells first, so the two use opposite ends of the same mobility metric.
 */
function chooseStart(
  c: Carver,
  pool: GridPoint[],
  targetLength: number,
  rng: Rng,
): GridPoint | null {
  const available = pool.filter(p => isFree(c, p.x, p.y));
  if (available.length === 0) {
    return null;
  }
  const scored = available.map(p => ({
    p,
    mobility: freeNeighbours(c, p.x, p.y).length,
  }));
  const wantRoom = targetLength >= 3;
  const target = wantRoom
    ? Math.max(...scored.map(s => s.mobility))
    : Math.min(...scored.map(s => s.mobility));
  const shortlist = scored.filter(s => s.mobility === target).map(s => s.p);
  return shortlist[rng.int(shortlist.length)];
}

/**
 * §8.2. `arrowCount` is a request, not a guarantee — the walk can come up short on a
 * ragged mask. The caller checks the result against the band range and retries with a
 * fresh seed, which is cheaper and more predictable than backtracking in here.
 */
export function decompose(
  mask: Mask,
  maskCells: GridPoint[],
  arrowCount: number,
  mixWeights: LengthMix,
  rng: Rng,
): Decomposition | null {
  const gridSize = mask.length;
  const lengths = drawLengths(arrowCount, maskCells.length, mixWeights, rng);
  if (!lengths) {
    return null;
  }

  const c: Carver = {
    gridSize,
    owner: new Int32Array(gridSize * gridSize).fill(-2),
  };
  for (const cell of maskCells) {
    c.owner[idx(c, cell.x, cell.y)] = -1;
  }

  const paths: CarvedPath[] = [];
  const commit = (path: CarvedPath): void => {
    const index = paths.length;
    for (const cell of path.cells) {
      c.owner[idx(c, cell.x, cell.y)] = index;
    }
    paths.push(path);
  };

  // Feature paths first, along the contour, while the mask is still open enough to
  // fit a long turning path (§4.2).
  const contour = contourCells(mask);
  const featureLengths = lengths
    .map((len, i) => ({len, i}))
    .filter(entry => entry.len >= FEATURE_MIN_LENGTH)
    .sort((a, b) => b.len - a.len)
    .slice(0, FEATURE_PATHS);
  const consumed = new Set<number>();

  for (const entry of featureLengths) {
    const start = chooseStart(c, contour, entry.len, rng);
    if (!start) {
      break;
    }
    const path = walk(c, start, entry.len, true, rng);
    if (path.cells.length >= FEATURE_MIN_LENGTH && path.turns >= 1) {
      path.feature = true;
      commit(path);
      consumed.add(entry.i);
    } else {
      // Release the reservation and let the general pass have these cells.
      for (const cell of path.cells) {
        c.owner[idx(c, cell.x, cell.y)] = -1;
      }
    }
  }

  const remainingLengths = lengths
    .filter((_, i) => !consumed.has(i))
    .sort((a, b) => b - a);

  for (const target of remainingLengths) {
    const start = chooseStart(c, maskCells, target, rng);
    if (!start) {
      break;
    }
    commit(walk(c, start, target, false, rng));
  }

  // Anything the length multiset failed to cover becomes its own short path, which
  // is exactly what the length-1 bucket is for.
  let guard = maskCells.length + 4;
  while (guard-- > 0) {
    const start = chooseStart(c, maskCells, 1, rng);
    if (!start) {
      break;
    }
    commit(walk(c, start, 1, false, rng));
  }

  for (const cell of maskCells) {
    if (c.owner[idx(c, cell.x, cell.y)] < 0) {
      return null;
    }
  }

  const repaired = repair(paths, lengths, rng);
  const buckets = new Array(MAX_PATH_LENGTH).fill(0);
  for (const path of repaired) {
    buckets[path.cells.length - 1]++;
  }

  return {
    paths: repaired,
    distribution: buckets.map(b => b / repaired.length),
  };
}

// ---------------------------------------------------------------------------
// Repair
//
// The walk is opportunistic: a ragged mask makes some paths come up short, and the
// leftover cells then become length-1 paths nobody asked for. That inflates the arrow
// count past the band range and skews the length mix, so the carve is followed by a
// repair pass that merges and splits paths until the actual length multiset matches
// the one drawn up front. Both operations preserve the partition - every mask cell
// stays owned by exactly one path - so nothing here can reintroduce an orphan.
// ---------------------------------------------------------------------------

function turnsIn(cells: readonly GridPoint[]): number {
  let turns = 0;
  for (let i = 2; i < cells.length; i++) {
    if (isTurn(cells[i - 2], cells[i - 1], cells[i])) {
      turns++;
    }
  }
  return turns;
}

function isSimplePath(cells: readonly GridPoint[]): boolean {
  if (cells.length > MAX_PATH_LENGTH) {
    return false;
  }
  for (let i = 1; i < cells.length; i++) {
    const step =
      Math.abs(cells[i].x - cells[i - 1].x) +
      Math.abs(cells[i].y - cells[i - 1].y);
    if (step !== 1) {
      return false;
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 2; j < cells.length; j++) {
      if (
        Math.abs(cells[i].x - cells[j].x) + Math.abs(cells[i].y - cells[j].y) <=
        1
      ) {
        return false;
      }
    }
  }
  return turnsIn(cells) <= MAX_TURNS;
}

/** All four ways two paths can be laid end to end, filtered to the legal ones. */
function joinCandidates(a: CarvedPath, b: CarvedPath): GridPoint[][] {
  const ac = a.cells;
  const bc = b.cells;
  const arrangements = [
    [...ac, ...bc],
    [...ac, ...[...bc].reverse()],
    [...[...ac].reverse(), ...bc],
    [...[...ac].reverse(), ...[...bc].reverse()],
  ];
  return arrangements.filter(isSimplePath);
}

type Counts = Int32Array;

function countsOf(lengths: readonly number[]): Counts {
  const counts = new Int32Array(MAX_PATH_LENGTH + 1);
  for (const length of lengths) {
    counts[length]++;
  }
  return counts;
}

function distance(actual: Counts, desired: Counts): number {
  let total = 0;
  for (let i = 1; i <= MAX_PATH_LENGTH; i++) {
    total += Math.abs(actual[i] - desired[i]);
  }
  return total;
}

interface MergeOption {
  i: number;
  j: number;
  cells: GridPoint[];
}

function bestMergeFor(
  paths: readonly CarvedPath[],
  desired: Counts,
  jitter: () => number,
): {option: MergeOption; score: number} | null {
  const actual = countsOf(paths.map(p => p.cells.length));
  let best: MergeOption | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      for (const cells of joinCandidates(paths[i], paths[j])) {
        actual[paths[i].cells.length]--;
        actual[paths[j].cells.length]--;
        actual[cells.length]++;
        const score = distance(actual, desired) + jitter();
        actual[paths[i].cells.length]++;
        actual[paths[j].cells.length]++;
        actual[cells.length]--;
        if (score < bestScore) {
          bestScore = score;
          best = {i, j, cells};
        }
      }
    }
  }
  return best ? {option: best, score: bestScore} : null;
}

function bestSplitFor(
  paths: readonly CarvedPath[],
  desired: Counts,
  jitter: () => number,
): {i: number; at: number; score: number} | null {
  const actual = countsOf(paths.map(p => p.cells.length));
  let best: {i: number; at: number} | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < paths.length; i++) {
    const cells = paths[i].cells;
    for (let at = 1; at < cells.length; at++) {
      actual[cells.length]--;
      actual[at]++;
      actual[cells.length - at]++;
      const score = distance(actual, desired) + jitter();
      actual[cells.length]++;
      actual[at]--;
      actual[cells.length - at]--;
      if (score < bestScore) {
        bestScore = score;
        best = {i, at};
      }
    }
  }
  return best ? {...best, score: bestScore} : null;
}

function applyMerge(
  paths: readonly CarvedPath[],
  option: MergeOption,
): CarvedPath[] {
  const merged: CarvedPath = {
    cells: option.cells,
    turns: turnsIn(option.cells),
    feature:
      (paths[option.i].feature || paths[option.j].feature) &&
      option.cells.length >= FEATURE_MIN_LENGTH,
  };
  const rest = paths.filter((_, k) => k !== option.i && k !== option.j);
  return [...rest, merged];
}

function applySplit(
  paths: readonly CarvedPath[],
  i: number,
  at: number,
): CarvedPath[] {
  const cells = paths[i].cells;
  const head = cells.slice(0, at);
  const tail = cells.slice(at);
  const featured = paths[i].feature;
  const rest = paths.filter((_, k) => k !== i);
  return [
    ...rest,
    {
      cells: head,
      turns: turnsIn(head),
      feature:
        featured && head.length >= FEATURE_MIN_LENGTH && turnsIn(head) >= 1,
    },
    {
      cells: tail,
      turns: turnsIn(tail),
      feature:
        featured && tail.length >= FEATURE_MIN_LENGTH && turnsIn(tail) >= 1,
    },
  ];
}

/**
 * Bring the carve back to the drawn length multiset. Merges while there are too many
 * paths, splits while there are too few, then trades one merge against one split to
 * close the remaining mix error without moving the count again.
 */
function repair(
  paths: readonly CarvedPath[],
  lengths: readonly number[],
  rng: Rng,
): CarvedPath[] {
  const desired = countsOf(lengths);
  const targetCount = lengths.length;
  const jitter = (): number => rng.next() * 0.4;
  let current = [...paths];
  let guard = paths.length * 4 + 32;

  while (current.length !== targetCount && guard-- > 0) {
    if (current.length > targetCount) {
      const merge = bestMergeFor(current, desired, jitter);
      if (!merge) {
        break;
      }
      current = applyMerge(current, merge.option);
    } else {
      const split = bestSplitFor(current, desired, jitter);
      if (!split) {
        break;
      }
      current = applySplit(current, split.i, split.at);
    }
  }

  let rounds = 10;
  while (rounds-- > 0) {
    const before = distance(
      countsOf(current.map(p => p.cells.length)),
      desired,
    );
    if (before === 0) {
      break;
    }
    const merge = bestMergeFor(current, desired, () => 0);
    if (!merge) {
      break;
    }
    const merged = applyMerge(current, merge.option);
    const split = bestSplitFor(merged, desired, () => 0);
    if (!split || split.score >= before) {
      break;
    }
    current = applySplit(merged, split.i, split.at);
  }

  return current;
}

/** §8.4 CI check — observed mix must sit within 3 points of the band target. */
export function distributionError(observed: number[], mix: LengthMix): number {
  let worst = 0;
  for (let i = 0; i < mix.weights.length; i++) {
    worst = Math.max(worst, Math.abs((observed[i] ?? 0) - mix.weights[i]));
  }
  return worst;
}
