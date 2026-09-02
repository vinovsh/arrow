/**
 * Per-level slot planning — §4.1 (grid/arrow table), §4.2 (path-length mixes) and
 * §3.1 (difficulty rhythm). This module is pure data + arithmetic: it decides what a
 * level must look like before any geometry is generated, so the curve is a design
 * decision rather than an emergent property of the generator.
 */
import type {Band} from '../../src/game/models/types.ts';

export interface BandRow {
  from: number;
  to: number;
  gridSize: number;
  minArrows: number;
  maxArrows: number;
  band: Band;
  /** Target average D for the band (§4.1). Blocks of 10 vary around this. */
  avgD: number;
}

/** §4.1 — adopted exactly. */
export const BAND_TABLE: readonly BandRow[] = [
  {
    from: 1,
    to: 1,
    gridSize: 5,
    minArrows: 3,
    maxArrows: 4,
    band: 'Tutorial',
    avgD: 1.0,
  },
  {
    from: 2,
    to: 2,
    gridSize: 5,
    minArrows: 4,
    maxArrows: 5,
    band: 'Tutorial',
    avgD: 1.0,
  },
  {
    from: 3,
    to: 3,
    gridSize: 6,
    minArrows: 5,
    maxArrows: 7,
    band: 'Tutorial',
    avgD: 1.2,
  },
  {
    from: 4,
    to: 10,
    gridSize: 7,
    minArrows: 8,
    maxArrows: 12,
    band: 'Easy',
    avgD: 1.8,
  },
  {
    from: 11,
    to: 25,
    gridSize: 8,
    minArrows: 16,
    maxArrows: 22,
    band: 'Easy',
    avgD: 2.3,
  },
  {
    from: 26,
    to: 50,
    gridSize: 9,
    minArrows: 20,
    maxArrows: 28,
    band: 'Medium',
    avgD: 2.9,
  },
  {
    from: 51,
    to: 100,
    gridSize: 10,
    minArrows: 26,
    maxArrows: 36,
    band: 'Medium+',
    avgD: 3.4,
  },
  {
    from: 101,
    to: 150,
    gridSize: 11,
    minArrows: 32,
    maxArrows: 42,
    band: 'Hard',
    avgD: 3.9,
  },
  {
    from: 151,
    to: 200,
    gridSize: 11,
    minArrows: 36,
    maxArrows: 48,
    band: 'Hard+',
    avgD: 4.2,
  },
  {
    from: 201,
    to: 250,
    gridSize: 12,
    minArrows: 42,
    maxArrows: 54,
    band: 'Very Hard',
    avgD: 4.5,
  },
  {
    from: 251,
    to: 300,
    gridSize: 12,
    minArrows: 46,
    maxArrows: 60,
    band: 'Expert',
    avgD: 4.8,
  },
  {
    from: 301,
    to: 350,
    gridSize: 13,
    minArrows: 52,
    maxArrows: 66,
    band: 'Expert+',
    avgD: 5.0,
  },
  {
    from: 351,
    to: 400,
    gridSize: 13,
    minArrows: 58,
    maxArrows: 72,
    band: 'Master',
    avgD: 5.2,
  },
  {
    from: 401,
    to: 450,
    gridSize: 14,
    minArrows: 64,
    maxArrows: 80,
    band: 'Extreme',
    avgD: 5.4,
  },
  {
    from: 451,
    to: 500,
    gridSize: 14,
    minArrows: 70,
    maxArrows: 90,
    band: 'Insane',
    avgD: 5.5,
  },
];

export function bandRowFor(levelId: number): BandRow {
  for (const row of BAND_TABLE) {
    if (levelId >= row.from && levelId <= row.to) {
      return row;
    }
  }
  throw new Error(`no band row for level ${levelId}`);
}

/**
 * §4.2 — path-length mix per band. Index 0 is length 1. The published table's
 * "len 5-8" bucket is spread 5 > 6 > 7 > 8 so long snaking accents stay rare.
 */
export interface LengthMix {
  /** Probability per length, index 0 = length 1 ... index 7 = length 8. */
  weights: number[];
  mean: number;
}

const spreadTail = (tail: number): number[] => [
  tail * 0.5,
  tail * 0.27,
  tail * 0.15,
  tail * 0.08,
];

function mix(
  l1: number,
  l2: number,
  l3: number,
  l4: number,
  tail: number,
): LengthMix {
  const weights = [l1, l2, l3, l4, ...spreadTail(tail)];
  const total = weights.reduce((a, b) => a + b, 0);
  const normalised = weights.map(w => w / total);
  const mean = normalised.reduce((sum, w, i) => sum + w * (i + 1), 0);
  return {weights: normalised, mean};
}

export function lengthMixFor(levelId: number): LengthMix {
  if (levelId <= 3) {
    return mix(0.0, 0.1, 0.35, 0.35, 0.2);
  }
  if (levelId <= 10) {
    return mix(0.05, 0.25, 0.35, 0.25, 0.1);
  }
  if (levelId <= 100) {
    return mix(0.28, 0.36, 0.22, 0.1, 0.04);
  }
  if (levelId <= 300) {
    return mix(0.3, 0.36, 0.22, 0.09, 0.03);
  }
  return mix(0.32, 0.37, 0.21, 0.08, 0.02);
}

export const SHOWCASE_EVERY = 10;
export const MILESTONE_EVERY = 25;

export const isShowcase = (id: number): boolean => id % SHOWCASE_EVERY === 0;
export const isMilestone = (id: number): boolean => id % MILESTONE_EVERY === 0;

/**
 * §3.1 rhythm, as *relative* positions inside each block of ten rather than as
 * absolute D offsets: -1 is as easy as the band goes, +1 as hard. Three slots sit at
 * or below -0.85 (the §3.1 "at least 3 at blockAvg - 1.5"), one at +1 (at most two
 * spikes, never consecutive), and position 10 is the showcase.
 */
const BASE_OFFSETS = [-0.1, 0.15, -1.0, 0.32, 1.0, 0.05, -1.0, 0.28, 0.4, -1.0];

export const DIFFICULTY_CEILING = 7.0;
export const DIFFICULTY_FLOOR = 1.0;
/** §8.3 — annealing must land the level inside this window of its slot target. */
export const D_TOLERANCE = 0.4;

/**
 * Measured floor of §7.2's D for each grid size, taken from a full generation run
 * with every slot target pinned below the floor so the annealer drove each board as
 * easy as its geometry allows.
 *
 * The floor exists because D's terms do not all reach zero on a real board: a filled
 * silhouette carries a fixed occupancy cost, and a dense one genuinely starts with
 * most of its arrows blocked, which is exactly what §4.3 describes when it says a
 * 90-arrow board "scores around D = 4.5. That is intended."
 *
 * This matters because §4.1's band averages sit *below* those floors — 1.0 for the
 * tutorial, where the smallest legal board scores about 2.2. Left uncorrected, every
 * target in every band is unreachable, the annealer drives every level to the floor,
 * and the block-to-block spread that §3.1 asks for collapses to nothing: the curve
 * still rises across bands, but inside a block every level scores the same. Anchoring
 * the rhythm to the measured floor instead is what makes the showcase actually read
 * as a rest and the milestone as a spike.
 *
 * Re-measure with `curveReport` after the §7.2 refit and update this table.
 */
const MEASURED_FLOOR: Record<number, number> = {
  5: 2.2,
  6: 2.5,
  7: 2.2,
  8: 2.6,
  9: 3.0,
  10: 3.4,
  11: 3.9,
  12: 4.5,
  13: 5.0,
  14: 5.4,
};

/**
 * How far above its floor a band can actually be pushed. Beyond this the annealer
 * stops finding boards, so it is the usable half-range for the rhythm.
 */
const REACHABLE_SPAN = 3.0;

export interface BandWindow {
  floor: number;
  top: number;
  base: number;
}

export function bandWindow(levelId: number): BandWindow {
  const row = bandRowFor(levelId);
  const floor = MEASURED_FLOOR[row.gridSize] ?? row.avgD;
  const top = Math.min(DIFFICULTY_CEILING, floor + REACHABLE_SPAN);
  // Where the band sits on §4.1's own 1..7 design scale, carried across to the range
  // this grid can actually reach. An Easy band still lands near the bottom of its
  // window and an Insane band near the top, which is what §4.1 is really saying; what
  // it cannot say is *how far below 1.0* a board is allowed to score, because §7.2
  // has no answer below its floor.
  const position =
    (row.avgD - DIFFICULTY_FLOOR) / (DIFFICULTY_CEILING - DIFFICULTY_FLOOR);
  const base = floor + Math.min(1, Math.max(0, position)) * (top - floor);
  return {floor, top, base};
}

/** §6 — the scripted onboarding levels. */
export const TUTORIAL_LAST_LEVEL = 10;

export function targetDifficulty(levelId: number): number {
  if (levelId <= TUTORIAL_LAST_LEVEL) {
    // §6 runs one idea per level with no failure possible, so the onboarding levels
    // are pinned to the easiest board their grid admits. The block rhythm starts at
    // level 11, where the game proper does.
    return bandWindow(levelId).floor;
  }
  const position = ((levelId - 1) % 10) + 1;
  let offset = BASE_OFFSETS[position - 1];

  if (isMilestone(levelId)) {
    // A milestone always reads as a spike, even when it lands on a showcase slot.
    offset = 1.0;
  } else if (position === 1 && isMilestone(levelId + 9)) {
    // That stolen showcase is repaid here so the block keeps three easy levels.
    offset = -1.0;
  }

  const window = bandWindow(levelId);
  const span =
    offset < 0 ? window.base - window.floor : window.top - window.base;
  const raw = window.base + offset * span;
  return Math.min(
    DIFFICULTY_CEILING,
    Math.max(DIFFICULTY_FLOOR, Number(raw.toFixed(2))),
  );
}

/** Scripted onboarding constraints (§6). Only levels 1-5 need geometric guarantees. */
export interface SlotHints {
  /** Level 1-2: every arrow must be free at the start. */
  allFree: boolean;
  /** Level 3: exactly one arrow starts blocked, so the shake teaches the rule once. */
  exactBlockedAtStart: number | null;
  /** Level 4: at least one path must turn, to teach "the head sets direction". */
  requireTurningPath: boolean;
  /** Level 5: a dependency chain of at least this depth. */
  minDepth: number | null;
}

export function slotHintsFor(levelId: number): SlotHints {
  switch (levelId) {
    case 1:
    case 2:
      return {
        allFree: true,
        exactBlockedAtStart: null,
        requireTurningPath: false,
        minDepth: null,
      };
    case 3:
      return {
        allFree: false,
        exactBlockedAtStart: 1,
        requireTurningPath: false,
        minDepth: null,
      };
    case 4:
      return {
        allFree: false,
        exactBlockedAtStart: null,
        requireTurningPath: true,
        minDepth: null,
      };
    case 5:
      return {
        allFree: false,
        exactBlockedAtStart: null,
        requireTurningPath: false,
        minDepth: 3,
      };
    default:
      return {
        allFree: false,
        exactBlockedAtStart: null,
        requireTurningPath: false,
        minDepth: null,
      };
  }
}

export interface LevelSlot {
  id: number;
  gridSize: number;
  band: Band;
  minArrows: number;
  maxArrows: number;
  targetArrows: number;
  targetD: number;
  mix: LengthMix;
  showcase: boolean;
  milestone: boolean;
  hints: SlotHints;
  /** §4.2 — decor is mandatory from level 100 onward. */
  decorRequired: boolean;
}

/**
 * Arrow count inside the band range. Showcase levels sit near the top of the range
 * (large and beautiful) while milestones sit mid-range so the spike reads as
 * dependency depth rather than sheer length (§4.3).
 */
function targetArrowCount(row: BandRow, id: number): number {
  const span = row.maxArrows - row.minArrows;
  if (span === 0) {
    return row.minArrows;
  }
  const position = ((id - 1) % 10) / 9;
  let t: number;
  if (isMilestone(id)) {
    t = 0.55;
  } else if (isShowcase(id)) {
    // A showcase reads as a reward, so it takes the low end of the count range: the
    // same big silhouette drawn from fewer, longer strokes stays open and unhurried.
    t = 0.25;
  } else {
    // A slow saw across each block keeps neighbouring levels visibly different, and
    // is tilted by the slot's own difficulty: occupancy carries real weight in §7.2,
    // so a sparser board is the cheapest way to make an easy slot actually easier.
    const window = bandWindow(id);
    const relative =
      (targetDifficulty(id) - window.floor) /
      Math.max(0.1, window.top - window.floor);
    t = 0.1 + 0.45 * position + 0.45 * relative;
  }
  return row.minArrows + Math.round(span * Math.min(1, Math.max(0, t)));
}

export function planLevel(id: number): LevelSlot {
  const row = bandRowFor(id);
  return {
    id,
    gridSize: row.gridSize,
    band: row.band,
    minArrows: row.minArrows,
    maxArrows: row.maxArrows,
    targetArrows: targetArrowCount(row, id),
    targetD: targetDifficulty(id),
    mix: lengthMixFor(id),
    showcase: isShowcase(id),
    milestone: isMilestone(id),
    hints: slotHintsFor(id),
    decorRequired: id >= 100,
  };
}

export function planAll(total: number): LevelSlot[] {
  const slots: LevelSlot[] = [];
  for (let id = 1; id <= total; id++) {
    slots.push(planLevel(id));
  }
  return slots;
}
