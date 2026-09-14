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
  /** How long the solve took, paused time excluded (§5.11). */
  elapsedSeconds: number;
  speed: SpeedAccolade;
}

export type SpeedKey =
  | 'lightning'
  | 'blazing'
  | 'swift'
  | 'ahead'
  | 'steady';

export interface SpeedAccolade {
  key: SpeedKey;
  label: string;
  /** A sentence to the player. Never a scolding — the slow one encourages. */
  blurb: string;
  /** True for the two absolute-time awards, which are the rare ones. */
  rare: boolean;
}

/**
 * What to say about the clock.
 *
 * Two kinds of award, because one alone would be unfair in opposite directions.
 * The absolute ones — under a second, under two — are the headline the player asked
 * for, but only a small board can be cleared that fast, so on their own they would be
 * unreachable for most of the game. The par-relative ones scale with the level, so a
 * 22x22 board solved briskly is still recognised.
 *
 * The last tier is deliberately not a failure. A player who took their time has still
 * solved it, and the copy says so: the alternative teaches them that finishing slowly
 * is something the game disapproves of, which is a strange thing to tell someone who
 * just won.
 */
export function speedAccolade(
  elapsedSeconds: number,
  parTime: number,
): SpeedAccolade {
  if (elapsedSeconds < 1) {
    return {
      key: 'lightning',
      label: 'LIGHTNING!',
      blurb: 'Under a second. That was pure instinct.',
      rare: true,
    };
  }
  if (elapsedSeconds < 2) {
    return {
      key: 'blazing',
      label: 'BLAZING!',
      blurb: 'Two seconds flat — you barely touched the clock.',
      rare: true,
    };
  }
  const par = Math.max(1, parTime);
  if (elapsedSeconds <= par * 0.4) {
    return {
      key: 'swift',
      label: 'SWIFT!',
      blurb: 'Less than half of par. That is a serious pace.',
      rare: false,
    };
  }
  if (elapsedSeconds <= par) {
    return {
      key: 'ahead',
      label: 'AHEAD OF PAR',
      blurb: 'Beat the clock. Keep that rhythm going.',
      rare: false,
    };
  }
  return {
    key: 'steady',
    label: 'SOLVED',
    blurb: 'Cracked it. Speed comes on the next run.',
    rare: false,
  };
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
    elapsedSeconds,
    speed: speedAccolade(elapsedSeconds, parTime),
  };
}
