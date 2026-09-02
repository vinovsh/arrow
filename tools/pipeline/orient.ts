/**
 * Stage 3 — orientation search (§8.3).
 *
 * The search space is 4^k · 2^(n−k), which is hopeless by brute force at n = 90. The
 * decisive observation is that **orientation never changes which cells a path
 * occupies** — only where its head points. Occupancy is therefore fixed before the
 * search starts, which means a solvable assignment can be *constructed* rather than
 * found: peel the paths one at a time, and give each one a direction whose corridor
 * is clear of the paths that are still on the board. The peel order is then a valid
 * solve order by construction, so stage 4 can never reject the result as unsolvable.
 *
 * Construction alone does not hit a difficulty target, so it is followed by annealing
 * over single-arrow reorientations, rejecting anything that breaks solvability.
 */
import type {
  ArrowPath,
  Direction,
  GridPoint,
} from '../../src/game/models/types.ts';
import {ALL_DIRECTIONS, DIR_VECTORS} from '../../src/game/models/types.ts';
import type {Rng} from '../../src/utils/rng.ts';
import {analyse, validate} from '../../src/game/engine/LevelValidator.ts';
import type {Validation} from '../../src/game/engine/LevelValidator.ts';
import type {CarvedPath} from './decompose.ts';
import {D_TOLERANCE, DIFFICULTY_CEILING} from './plan.ts';

/** One legal way to point a carved path: which end is the head, and where it faces. */
export interface Orientation {
  cells: GridPoint[];
  direction: Direction;
}

/**
 * A 1-cell path can face any of four directions; a longer path has two, one per end.
 * Reversing a path is what swaps its head, so the cell order is reversed with it.
 */
export function orientationsFor(path: CarvedPath): Orientation[] {
  const cells = path.cells;
  if (cells.length === 1) {
    return ALL_DIRECTIONS.map(direction => ({cells: [cells[0]], direction}));
  }
  const forward = cells;
  const backward = [...cells].reverse();
  return [
    {
      cells: forward,
      direction: stepDirection(
        forward[forward.length - 2],
        forward[forward.length - 1],
      ),
    },
    {
      cells: backward,
      direction: stepDirection(
        backward[backward.length - 2],
        backward[backward.length - 1],
      ),
    },
  ];
}

function stepDirection(from: GridPoint, to: GridPoint): Direction {
  if (to.x > from.x) {
    return 'R';
  }
  if (to.x < from.x) {
    return 'L';
  }
  if (to.y > from.y) {
    return 'D';
  }
  return 'U';
}

/** Owner grid: -1 empty, otherwise the path index occupying that cell. */
function buildOwners(
  gridSize: number,
  paths: readonly CarvedPath[],
): Int32Array {
  const owners = new Int32Array(gridSize * gridSize).fill(-1);
  for (let i = 0; i < paths.length; i++) {
    for (const cell of paths[i].cells) {
      owners[cell.y * gridSize + cell.x] = i;
    }
  }
  return owners;
}

interface CorridorScan {
  /** Indices of other paths the corridor crosses, in order from the head outward. */
  crossed: number[];
}

function scanCorridor(
  gridSize: number,
  owners: Int32Array,
  self: number,
  orientation: Orientation,
): CorridorScan {
  const head = orientation.cells[orientation.cells.length - 1];
  const step = DIR_VECTORS[orientation.direction];
  const crossed: number[] = [];
  const seen = new Set<number>();
  let x = head.x + step.x;
  let y = head.y + step.y;
  while (x >= 0 && y >= 0 && x < gridSize && y < gridSize) {
    const owner = owners[y * gridSize + x];
    if (owner >= 0 && owner !== self && !seen.has(owner)) {
      seen.add(owner);
      crossed.push(owner);
    }
    x += step.x;
    y += step.y;
  }
  return {crossed};
}

/**
 * Peel a solvable assignment (§2.3 in reverse). `hardness` biases each choice: at 0
 * every arrow is pointed at the nearest clear edge, which leaves the finished board
 * wide open; at 1 each arrow is pointed through as many already-removed paths as
 * possible, which turns those into start-state blockers and deepens the dependency
 * DAG. Returns null when the mask admits no peel order for this decomposition.
 */
export function constructSolvable(
  gridSize: number,
  paths: readonly CarvedPath[],
  hardness: number,
  rng: Rng,
): Orientation[] | null {
  const owners = buildOwners(gridSize, paths);
  const remaining = new Set<number>(paths.map((_, i) => i));
  const chosen: (Orientation | null)[] = paths.map(() => null);
  const options = paths.map(orientationsFor);

  while (remaining.size > 0) {
    let bestIndex = -1;
    let bestOrientation: Orientation | null = null;
    let bestScore = -Infinity;

    for (const index of remaining) {
      for (const orientation of options[index]) {
        const scan = scanCorridor(gridSize, owners, index, orientation);
        const blockedByRemaining = scan.crossed.some(other =>
          remaining.has(other),
        );
        if (blockedByRemaining) {
          continue;
        }
        // Everything the corridor crosses is already peeled, so in the finished
        // level those paths are present at the start and block this one.
        const alreadyGone = scan.crossed.length;
        const score =
          (hardness * 2 - 1) * alreadyGone * 3 +
          // Peeling low-mobility paths early keeps the tail of the order feasible.
          (1 - hardness) * (4 - options[index].length) +
          rng.next() * 2;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
          bestOrientation = orientation;
        }
      }
    }

    if (bestIndex < 0 || !bestOrientation) {
      return null;
    }
    chosen[bestIndex] = bestOrientation;
    remaining.delete(bestIndex);
    for (const cell of paths[bestIndex].cells) {
      owners[cell.y * gridSize + cell.x] = -1;
    }
  }

  return chosen as Orientation[];
}

export interface OrientResult {
  arrows: ArrowPath[];
  validation: Validation;
  /** |D − target| after annealing. */
  error: number;
}

function toArrows(orientations: readonly Orientation[]): ArrowPath[] {
  return orientations.map((o, i) => ({
    id: `a${i}`,
    color: 'white' as const,
    cells: o.cells,
    direction: o.direction,
  }));
}

export interface OrientConstraints {
  targetD: number;
  /** §8.3.3 — chains below three free options are only allowed at D ≥ 5. */
  requireFreeMin3: boolean;
  /** §8.3.4 — every non-milestone level must admit more than one solve order. */
  requireMultipleOrders: boolean;
  /** §6 — levels 1-2 must present every arrow as free. */
  allFree: boolean;
  /** §6 — level 3 shows exactly one blocked arrow. */
  exactBlockedAtStart: number | null;
  minDepth: number | null;
}

/**
 * Cost is dominated by the difficulty error so annealing tracks the slot target, with
 * the §8.3 structural rules layered on as penalties rather than hard rejections —
 * a run that has to pass through a briefly illegal state still converges.
 */
function cost(v: Validation, c: OrientConstraints): number {
  if (!v.solvable || !v.signals) {
    return 1e6;
  }
  let total = Math.abs(v.difficulty - c.targetD) * 10;

  if (v.difficulty > DIFFICULTY_CEILING) {
    total += (v.difficulty - DIFFICULTY_CEILING) * 100;
  }
  if (c.requireFreeMin3 && v.signals.freeMinCount < 3) {
    total += (3 - v.signals.freeMinCount) * 8;
  }
  if (c.requireMultipleOrders && Math.max(...v.freeCounts) < 2) {
    total += 25;
  }
  if (c.allFree && v.signals.blockedStart > 0) {
    total += v.signals.blockedStart * 400;
  }
  if (c.exactBlockedAtStart !== null) {
    const blocked = Math.round(v.signals.blockedStart * v.signals.n);
    total += Math.abs(blocked - c.exactBlockedAtStart) * 30;
  }
  if (c.minDepth !== null && v.signals.depth < c.minDepth) {
    total += (c.minDepth - v.signals.depth) * 20;
  }
  return total;
}

/**
 * §8.3 — simulated annealing over single-arrow reorientations. Moves that break
 * solvability are rejected outright, so every state visited is a shippable level and
 * the best-so-far can be returned at any point.
 */
export function anneal(
  gridSize: number,
  paths: readonly CarvedPath[],
  start: readonly Orientation[],
  constraints: OrientConstraints,
  rng: Rng,
  iterations: number,
): OrientResult {
  const options = paths.map(orientationsFor);
  const current = [...start];

  // One arrow array, mutated in place. A proposal only ever changes one arrow's head
  // and cell order, and rebuilding the whole array per iteration was costing more
  // than the solve it fed.
  const arrows = toArrows(current);
  const level = {gridSize, arrows};
  const apply = (index: number, orientation: Orientation): void => {
    arrows[index].cells = orientation.cells;
    arrows[index].direction = orientation.direction;
  };

  const initial = analyse(level);
  let currentCost = cost(initial, constraints);

  let best = [...current];
  let bestValidation = initial;
  let bestCost = currentCost;
  // Stop once the slot is satisfied rather than burning the whole iteration budget.
  let sinceImprovement = 0;
  const patience = Math.max(120, paths.length * 6);

  for (let step = 0; step < iterations && bestCost > 0.5; step++) {
    if (sinceImprovement > patience && bestCost <= D_TOLERANCE * 10) {
      break;
    }
    const temperature = 2.5 * (1 - step / iterations) + 0.01;
    const index = rng.int(paths.length);
    const choices = options[index].filter(
      o => o.direction !== current[index].direction,
    );
    if (choices.length === 0) {
      continue;
    }
    const previous = current[index];
    const proposal = choices[rng.int(choices.length)];
    current[index] = proposal;
    apply(index, proposal);

    const validation = analyse(level);
    if (!validation.solvable) {
      current[index] = previous;
      apply(index, previous);
      continue;
    }
    const candidateCost = cost(validation, constraints);
    const delta = candidateCost - currentCost;
    if (delta <= 0 || rng.next() < Math.exp(-delta / temperature)) {
      currentCost = candidateCost;
      if (candidateCost < bestCost) {
        bestCost = candidateCost;
        best = [...current];
        bestValidation = validation;
        sinceImprovement = 0;
      } else {
        sinceImprovement++;
      }
    } else {
      current[index] = previous;
      apply(index, previous);
      sinceImprovement++;
    }
  }

  const bestArrows = toArrows(best);
  return {
    arrows: bestArrows,
    // The winning board is re-checked with the full validator, so the level that
    // ships has passed §8.4 in its entirety and not just the annealer's fast path.
    validation: validate({gridSize, arrows: bestArrows}),
    error: Math.abs(bestValidation.difficulty - constraints.targetD),
  };
}

/**
 * Construct-then-anneal, sweeping the construction bias so annealing starts from a
 * board that is already roughly the right shape. Restarts are cheap because
 * construction is O(n² · gridSize) and never fails on a well-formed decomposition.
 */
export function searchOrientations(
  gridSize: number,
  paths: readonly CarvedPath[],
  constraints: OrientConstraints,
  rng: Rng,
  restarts = 4,
  iterations?: number,
): OrientResult | null {
  // A solve costs O(n^2 x gridSize), so a flat iteration budget is far too generous
  // on a 5x5 board and far too mean on a 14x14 one. Scale it with the board instead.
  const budget = iterations ?? Math.round(240 + paths.length * 9);
  // Construction bias is swept from open to congested; whichever end the slot needs,
  // annealing starts from a board that is already roughly the right shape.
  const hardnessSweep = [0.15, 0.5, 0.85, 0.35];
  let best: OrientResult | null = null;

  for (let attempt = 0; attempt < restarts; attempt++) {
    const hardness = hardnessSweep[attempt % hardnessSweep.length];
    const seeded = constructSolvable(gridSize, paths, hardness, rng);
    if (!seeded) {
      continue;
    }
    const result = anneal(gridSize, paths, seeded, constraints, rng, budget);
    if (!best || result.error < best.error) {
      best = result;
    }
    if (
      best.error <= D_TOLERANCE &&
      best.validation.difficulty <= DIFFICULTY_CEILING
    ) {
      break;
    }
  }
  return best;
}
