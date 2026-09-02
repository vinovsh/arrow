import {clamp} from '../../utils/math';

export interface ScoreInput {
  /** Level arrow count — every tolerance below scales with it (§11). */
  n: number;
  blockedTaps: number;
  hintsUsed: number;
  elapsedSeconds: number;
  parTime: number;
}

export interface ScoreBreakdown {
  levelScore: number;
  movesBonus: number;
  perfectBonus: number;
  speedBonus: number;
  total: number;
  stars: 1 | 2 | 3;
  praise: 'AMAZING!' | 'GREAT!' | 'NICE!';
}

/** §3.2 — a heart is spent every this-many blocked taps. */
export const blockedTapsPerHeart = (n: number): number =>
  Math.max(4, Math.round(n * 0.12));

/** §11 — mistake tolerance for two and three stars, scaled to board size. */
export const twoStarThreshold = (n: number): number =>
  Math.max(6, Math.round(n * 0.15));

export const threeStarThreshold = (n: number): number =>
  Math.max(2, Math.round(n * 0.05));

export function computeStars(
  n: number,
  blockedTaps: number,
  hintsUsed: number,
): 1 | 2 | 3 {
  if (blockedTaps <= threeStarThreshold(n) && hintsUsed === 0) {
    return 3;
  }
  if (blockedTaps <= twoStarThreshold(n)) {
    return 2;
  }
  return 1;
}

/** §11. Time only ever adds points and can never remove a star. */
export function computeScore(input: ScoreInput): ScoreBreakdown {
  const {n, blockedTaps, hintsUsed, elapsedSeconds, parTime} = input;

  const levelScore = 100;
  const movesBonus = Math.round(
    450 * clamp(1 - blockedTaps / Math.max(4, n * 0.5), 0, 1),
  );
  const perfectBonus = blockedTaps === 0 && hintsUsed === 0 ? 300 : 0;
  const speedBonus = Math.round(
    400 * clamp((parTime * 1.6 - elapsedSeconds) / parTime, 0, 1),
  );
  const total = levelScore + movesBonus + perfectBonus + speedBonus;

  // A hint forfeits three stars and the Perfect bonus, nothing else (§3.4).
  const stars = computeStars(n, blockedTaps, hintsUsed);
  const praise = stars === 3 ? 'AMAZING!' : stars === 2 ? 'GREAT!' : 'NICE!';

  return {
    levelScore,
    movesBonus,
    perfectBonus,
    speedBonus,
    total,
    stars,
    praise,
  };
}
