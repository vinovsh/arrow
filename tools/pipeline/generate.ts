/**
 * The generator itself: one slot in, one validated Level out.
 *
 * Stages run in the order given by §8: mask, decomposition, orientation search,
 * validation, then colour. Everything is driven from a seed derived from the level
 * id and the attempt number, so a failed attempt retries with different geometry
 * while the whole pack stays reproducible from `(shape, gridSize, seed)`.
 */
import type {DecorPath, Level} from '../../src/game/models/types.ts';
import type {Validation} from '../../src/game/engine/LevelValidator.ts';
import {createRng, hashSeed} from '../../src/utils/rng.ts';
import {SHAPES} from '../shapes/library.ts';
import type {ShapeDef} from '../shapes/library.ts';
import {fitMask} from './mask.ts';
import {decompose, distributionError} from './decompose.ts';
import type {Decomposition} from './decompose.ts';
import {searchOrientations} from './orient.ts';
import {assignColours} from './colorise.ts';
import {D_TOLERANCE, DIFFICULTY_CEILING} from './plan.ts';
import type {LevelSlot} from './plan.ts';

/** §8.4 — observed path-length mix may drift at most this far from the band target. */
export const DISTRIBUTION_TOLERANCE = 0.03;

export interface GenerationReport {
  level: Level;
  validation: Validation;
  shape: string;
  seed: number;
  attempts: number;
  maskCells: number;
  distribution: number[];
  distributionError: number;
  colourMaxShare: number;
  featurePaths: number;
}

/**
 * Shapes are dealt out with a stride that is coprime with the library size, so a
 * band never repeats a silhouette on consecutive levels and every shape gets used a
 * comparable number of times across the 500.
 */
export function shapeForLevel(slot: LevelSlot, offset = 0): ShapeDef | null {
  const usable = SHAPES.filter(
    s =>
      s.minGrid <= slot.gridSize &&
      (!slot.decorRequired || (s.decor?.length ?? 0) > 0),
  );
  if (usable.length === 0) {
    return null;
  }
  const stride = 7;
  const index = (slot.id * stride + offset) % usable.length;
  return usable[index];
}

/** Decor lives in normalised board coordinates and is cosmetic only (§10.2). */
function decorFor(shape: ShapeDef, slot: LevelSlot): DecorPath[] | undefined {
  if (!shape.decor || shape.decor.length === 0) {
    return undefined;
  }
  // Below level 100 decor is optional; showing it on the smallest boards crowds an
  // already tight grid, so it starts once the silhouette has room to carry it.
  if (!slot.decorRequired && slot.gridSize < 8) {
    return undefined;
  }
  return shape.decor;
}

function meanOf(weights: readonly number[]): number {
  return weights.reduce((sum, w, i) => sum + w * (i + 1), 0);
}

interface Attempt {
  decomposition: Decomposition;
  arrowCount: number;
  maskCells: number;
}

/**
 * Draw a decomposition for this slot. The arrow count is jittered inside the band
 * range and the mask is refitted to match, because the mask must contain
 * `arrowCount × meanPathLength` cells for the length mix to be reachable at all.
 */
function buildDecomposition(
  slot: LevelSlot,
  shape: ShapeDef,
  attempt: number,
  seed: number,
): Attempt | null {
  const rng = createRng(seed);
  const spread = attempt % 5;
  const jitter = [0, 1, -1, 2, -2][spread];
  const arrowCount = Math.min(
    slot.maxArrows,
    Math.max(slot.minArrows, slot.targetArrows + jitter),
  );
  const targetCells = Math.round(arrowCount * meanOf(slot.mix.weights));

  const fitted = fitMask(shape, slot.gridSize, targetCells, rng);
  if (!fitted) {
    return null;
  }

  const decomposition = decompose(
    fitted.mask,
    fitted.cells,
    arrowCount,
    slot.mix,
    rng,
  );
  if (!decomposition) {
    return null;
  }
  const count = decomposition.paths.length;
  if (count < slot.minArrows || count > slot.maxArrows) {
    return null;
  }
  return {decomposition, arrowCount: count, maskCells: fitted.cellCount};
}

/**
 * §7.2's formula has a floor that rises with the board, and the floor is not a bug:
 * a dense silhouette genuinely starts with most of its arrows blocked, and §4.3 says
 * so outright — "a 90-arrow board with 20 free moves at every step scores around
 * D = 4.5. That is intended." A showcase slot in the Insane band asks for
 * blockAvg - 1.8 = 3.7, which is below that floor and therefore unreachable however
 * long the search runs. Rather than burn every attempt chasing it, the generator
 * stops once fresh geometry has stopped buying meaningful accuracy, keeps the closest
 * board it found, and lets curveReport surface the residual gap for the §7.2 refit.
 */
const STALL_EPSILON = 0.05;

/**
 * A solve costs O(n^2 x gridSize), so an attempt on a 7x7 board is two orders of
 * magnitude cheaper than one on a 14x14. Small boards can afford to keep looking;
 * large ones cannot, and are also the ones whose targets sit closest to the floor.
 */
function attemptBudget(targetArrows: number): {max: number; stall: number} {
  if (targetArrows <= 20) {
    return {max: 28, stall: 28};
  }
  if (targetArrows <= 40) {
    return {max: 20, stall: 9};
  }
  return {max: 12, stall: 5};
}

export function generateLevel(
  slot: LevelSlot,
  budget = attemptBudget(slot.targetArrows),
): GenerationReport | null {
  let fallback: GenerationReport | null = null;
  let fallbackScore = Infinity;
  let stalled = 0;

  for (let attempt = 0; attempt < budget.max; attempt++) {
    const shape = shapeForLevel(slot, Math.floor(attempt / 6));
    if (!shape) {
      return null;
    }
    const seed = hashSeed(
      `${shape.name}:${slot.gridSize}:${slot.id}:${attempt}`,
    );
    const drawn = buildDecomposition(slot, shape, attempt, seed);
    if (!drawn) {
      continue;
    }

    const rng = createRng(seed ^ 0x5bf03635);
    const result = searchOrientations(
      slot.gridSize,
      drawn.decomposition.paths,
      {
        targetD: slot.targetD,
        requireFreeMin3: slot.targetD < 5,
        requireMultipleOrders: !slot.milestone,
        allFree: slot.hints.allFree,
        exactBlockedAtStart: slot.hints.exactBlockedAtStart,
        minDepth: slot.hints.minDepth,
      },
      rng,
    );
    if (!result || !result.validation.solvable) {
      continue;
    }

    const colours = assignColours(result.arrows, slot.gridSize, rng);
    const arrows = result.arrows.map((arrow, i) => ({
      ...arrow,
      color: colours.colors[i],
    }));

    const level: Level = {
      id: slot.id,
      gridSize: slot.gridSize,
      theme: shape.name,
      band: slot.band,
      difficulty: result.validation.difficulty,
      parTime: result.validation.parTime,
      arrows,
      decor: decorFor(shape, slot),
    };

    const report: GenerationReport = {
      level,
      validation: result.validation,
      shape: shape.name,
      seed,
      attempts: attempt + 1,
      maskCells: drawn.maskCells,
      distribution: drawn.decomposition.distribution,
      distributionError: distributionError(
        drawn.decomposition.distribution,
        slot.mix,
      ),
      colourMaxShare: colours.maxShare,
      featurePaths: drawn.decomposition.paths.filter(p => p.feature).length,
    };

    const withinD =
      result.error <= D_TOLERANCE &&
      result.validation.difficulty <= DIFFICULTY_CEILING;
    const withinMix = report.distributionError <= DISTRIBUTION_TOLERANCE;
    if (withinD && withinMix) {
      return report;
    }
    // Keep the closest miss: a level that is 0.5 off target still ships far better
    // than a hole in the pack, and validateLevels reports the drift either way.
    const score = result.error + report.distributionError * 4;
    if (score < fallbackScore - STALL_EPSILON) {
      fallbackScore = score;
      fallback = report;
      stalled = 0;
    } else {
      if (score < fallbackScore) {
        fallbackScore = score;
        fallback = report;
      }
      stalled++;
      if (stalled >= budget.stall) {
        break;
      }
    }
  }

  return fallback;
}
