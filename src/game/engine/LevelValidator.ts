import type {ArrowPath, Level} from '../models/types';
import {MAX_PATH_CELLS, directionFromCells} from '../models/types';
import {clamp, roundTo} from '../../utils/math';
import {CollisionDetector} from './CollisionDetector';

export interface DifficultySignals {
  n: number;
  depth: number;
  freeMinCount: number;
  freeAvgCount: number;
  blockedStart: number;
  turns: number;
  occupancy: number;
  spanAvg: number;
}

export interface Validation {
  solvable: boolean;
  /** Canonical solve order as arrow ids; also the hint order (§8.4). */
  order: string[];
  freeCounts: number[];
  signals: DifficultySignals | null;
  difficulty: number;
  parTime: number;
  errors: string[];
}

/**
 * Deterministic choice among the currently free arrows. Removing an arrow can only
 * free others (§2.3), so any greedy order terminates iff the level is solvable —
 * which makes this pass a proof, not a heuristic.
 *
 * Preference order: fewest arrows unblocked (so the easy cascade is saved for later
 * and the hint sequence reads naturally), then lowest index. Both terms are pure
 * functions of the state, so the result is reproducible.
 */
function canonicalPick(free: readonly number[], blockers: Int32Array): number {
  const unblocks = new Int32Array(blockers.length);
  for (let i = 0; i < blockers.length; i++) {
    const blocker = blockers[i];
    if (blocker >= 0) {
      unblocks[blocker]++;
    }
  }
  let best = free[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const index of free) {
    const score = unblocks[index] * 1000 + index;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}

const STEP: Record<string, readonly [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
};

/** Longest forced chain in the blocking DAG, measured at the initial state. */
function dependencyDepth(detector: CollisionDetector): number {
  const n = detector.arrows.length;
  const blockers: number[][] = [];
  for (let i = 0; i < n; i++) {
    const list: number[] = [];
    const arrow = detector.arrows[i];
    const head = arrow.cells[arrow.cells.length - 1];
    const step = STEP[arrow.direction];
    const seen = new Set<number>();
    let x = head.x + step[0];
    let y = head.y + step[1];
    while (x >= 0 && y >= 0 && x < detector.gridSize && y < detector.gridSize) {
      const occupant = detector.occupancy[y * detector.gridSize + x];
      if (occupant !== 0 && occupant - 1 !== i && !seen.has(occupant - 1)) {
        seen.add(occupant - 1);
        list.push(occupant - 1);
      }
      x += step[0];
      y += step[1];
    }
    blockers.push(list);
  }

  const memo = new Int32Array(n).fill(-1);
  const onStack = new Uint8Array(n);
  const walk = (i: number): number => {
    if (onStack[i] === 1) {
      return 0; // a cycle means unsolvable; validate() reports that separately
    }
    if (memo[i] >= 0) {
      return memo[i];
    }
    onStack[i] = 1;
    let best = 0;
    for (const b of blockers[i]) {
      best = Math.max(best, 1 + walk(b));
    }
    onStack[i] = 0;
    memo[i] = best;
    return best;
  };

  let deepest = 0;
  for (let i = 0; i < n; i++) {
    deepest = Math.max(deepest, walk(i));
  }
  return deepest;
}

function meanTurns(arrows: readonly ArrowPath[]): number {
  let total = 0;
  for (const arrow of arrows) {
    for (let i = 2; i < arrow.cells.length; i++) {
      const a = arrow.cells[i - 2];
      const b = arrow.cells[i - 1];
      const c = arrow.cells[i];
      if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
        total++;
      }
    }
  }
  return arrows.length === 0 ? 0 : total / arrows.length;
}

/**
 * States where the player still has a decision to make.
 *
 * §7.1 defines freeMinCount as "fewest free arrows at any state". Read literally that
 * includes the final state, where one arrow remains and is free by definition — so
 * freeMinCount would be 1 on every level ever generated, the 1.6 term would be a
 * constant, and §8.3's "freeMinCount >= 3" gate could never be satisfied. The tail of
 * a solve is not where pressure lives, so both freedom signals are measured over the
 * states with more than three arrows still on the board. Boards too small to have such
 * a phase fall back to the whole trace.
 */
const DECISION_TAIL = 3;

function decisionPhase(freeCounts: readonly number[]): number[] {
  const head = freeCounts.slice(
    0,
    Math.max(0, freeCounts.length - DECISION_TAIL),
  );
  return head.length > 0 ? head : [...freeCounts];
}

/** §7.2 — freedom measured as absolute counts with saturation, not as a fraction. */
export function computeDifficulty(s: DifficultySignals): number {
  const raw =
    1.7 * Math.min(1, s.depth / 8) +
    2.4 * (1 - Math.min(1, s.freeAvgCount / 6)) +
    1.6 * (1 - Math.min(1, s.freeMinCount / 3)) +
    1.5 * s.blockedStart +
    0.9 * Math.min(1, s.turns / 3) +
    0.8 * s.occupancy +
    0.7 * Math.min(1, s.spanAvg / 5) +
    0.5 * Math.min(1, s.n / 90);
  return clamp(1 + 9 * (raw / 10.1), 1, 10);
}

/** §7.3 — feeds the speed bonus and struggle detection only; never displayed. */
export function computeParTime(n: number, difficulty: number): number {
  return Math.round(clamp(8 + 1.7 * n + 3.5 * difficulty, 20, 240));
}

export function structuralErrors(
  gridSize: number,
  arrows: readonly ArrowPath[],
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const arrow of arrows) {
    if (arrow.cells.length < 1 || arrow.cells.length > MAX_PATH_CELLS) {
      errors.push(
        `${arrow.id}: path length ${arrow.cells.length} outside 1..${MAX_PATH_CELLS}`,
      );
    }
    for (let i = 0; i < arrow.cells.length; i++) {
      const cell = arrow.cells[i];
      if (
        cell.x < 0 ||
        cell.y < 0 ||
        cell.x >= gridSize ||
        cell.y >= gridSize
      ) {
        errors.push(
          `${arrow.id}: cell ${cell.x},${cell.y} is outside the grid`,
        );
      }
      const key = `${cell.x},${cell.y}`;
      const owner = seen.get(key);
      if (owner !== undefined) {
        errors.push(`${arrow.id}: cell ${key} already used by ${owner}`);
      } else {
        seen.set(key, arrow.id);
      }
      if (i > 0) {
        const prev = arrow.cells[i - 1];
        if (Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y) !== 1) {
          errors.push(`${arrow.id}: cells ${i - 1} and ${i} are not adjacent`);
        }
      }
    }
    const implied = directionFromCells(arrow.cells);
    if (implied !== null && implied !== arrow.direction) {
      errors.push(
        `${arrow.id}: stored direction ${arrow.direction} disagrees with path ${implied}`,
      );
    }
  }
  return errors;
}

/**
 * §8.4 — exact validation: greedily remove every free arrow until the board empties.
 * Monotonicity (§2.3) makes that greedy pass a proof rather than a heuristic.
 */
export function validate(
  level: Pick<Level, 'gridSize' | 'arrows'>,
): Validation {
  const result = analyse(level);
  const errors = structuralErrors(level.gridSize, level.arrows);
  return errors.length === 0
    ? result
    : {...result, errors: [...errors, ...result.errors]};
}

/**
 * The solve and its difficulty signals, without the structural audit.
 *
 * The generator's annealer calls this once per proposed reorientation — hundreds of
 * thousands of times per pack — and reorientation cannot change cell membership, so
 * re-running the O(n x cells) overlap and adjacency checks every iteration is pure
 * waste. Ship-time callers want validate(), which layers those checks back on.
 */
export function analyse(level: Pick<Level, 'gridSize' | 'arrows'>): Validation {
  const arrows = level.arrows;
  const errors: string[] = [];
  const detector = new CollisionDetector(level.gridSize, arrows);

  const initialFree = detector.freeIndices().length;
  const blockedStart =
    arrows.length === 0 ? 0 : 1 - initialFree / arrows.length;

  let spanTotal = 0;
  let spanCount = 0;
  for (let i = 0; i < arrows.length; i++) {
    const blocker = detector.firstBlocker(i);
    if (blocker >= 0) {
      const head = arrows[i].cells[arrows[i].cells.length - 1];
      let nearest = Number.POSITIVE_INFINITY;
      for (const cell of arrows[blocker].cells) {
        nearest = Math.min(
          nearest,
          Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y),
        );
      }
      spanTotal += nearest;
      spanCount++;
    }
  }
  const spanAvg = spanCount === 0 ? 0 : spanTotal / spanCount;
  const depth = dependencyDepth(detector);

  const order: string[] = [];
  const freeCounts: number[] = [];
  const blockers = new Int32Array(arrows.length);
  while (detector.activeCount > 0) {
    detector.blockerMap(blockers);
    const free: number[] = [];
    for (let i = 0; i < arrows.length; i++) {
      if (blockers[i] === -1) {
        free.push(i);
      }
    }
    if (free.length === 0) {
      return {
        solvable: false,
        order,
        freeCounts,
        signals: null,
        difficulty: 10,
        parTime: 0,
        errors: ['unsolvable: no free arrow remains'],
      };
    }
    freeCounts.push(free.length);
    const pick = canonicalPick(free, blockers);
    order.push(arrows[pick].id);
    detector.remove(pick);
  }

  let occupiedCells = 0;
  for (const arrow of arrows) {
    occupiedCells += arrow.cells.length;
  }

  const decision = decisionPhase(freeCounts);
  const signals: DifficultySignals = {
    n: arrows.length,
    depth,
    freeMinCount: decision.length ? Math.min(...decision) : 0,
    freeAvgCount: decision.length
      ? decision.reduce((a, b) => a + b, 0) / decision.length
      : 0,
    blockedStart,
    turns: meanTurns(arrows),
    occupancy: occupiedCells / (level.gridSize * level.gridSize),
    spanAvg,
  };
  const difficulty = roundTo(computeDifficulty(signals), 2);

  return {
    solvable: true,
    order,
    freeCounts,
    signals,
    difficulty,
    parTime: computeParTime(arrows.length, difficulty),
    errors,
  };
}

/**
 * Property check behind the "no reachable state is ever unsolvable" criterion (§20).
 * Plays random legal moves and re-proves solvability at every step.
 */
export function randomPlayStaysSolvable(
  level: Pick<Level, 'gridSize' | 'arrows'>,
  random: () => number,
): boolean {
  const detector = new CollisionDetector(level.gridSize, level.arrows);
  while (detector.activeCount > 0) {
    const free = detector.freeIndices();
    if (free.length === 0) {
      return false;
    }
    detector.remove(free[Math.floor(random() * free.length)]);
  }
  return true;
}
