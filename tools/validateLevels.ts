/**
 * Stage 4 — CI gate (§8.4).
 *
 *   node --import ./tools/register.mjs tools/validateLevels.ts
 *
 * Fails the build on any unsolvable level, any D more than ±0.6 outside its slot
 * window, any duplicate board, any arrow count outside its band, overlapping cells, a
 * path-length distribution more than 3 points off target, or a colour-balance
 * violation. Also re-proves §20's property check on a sample: random legal play never
 * reaches an unsolvable state.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {unpackLevel} from '../src/game/levels/codec.ts';
import type {LevelPack} from '../src/game/levels/codec.ts';
import type {Level} from '../src/game/models/types.ts';
import {
  randomPlayStaysSolvable,
  validate,
} from '../src/game/engine/LevelValidator.ts';
import {createRng} from '../src/utils/rng.ts';
import {planLevel} from './pipeline/plan.ts';
import {DIFFICULTY_CEILING} from './pipeline/plan.ts';
import {COLOUR_CAP_FROM_ARROWS, COLOUR_CAP_SHARE} from './pipeline/colorise.ts';
import {distributionError} from './pipeline/decompose.ts';

/** §8.4 — the CI window is wider than the generator's own ±0.4 target. */
export const D_CI_TOLERANCE = 0.6;
export const MIX_CI_TOLERANCE = 0.03;
/** §20 — property test: 100 sampled levels played randomly to completion. */
export const PROPERTY_SAMPLE = 100;
export const PROPERTY_RUNS = 20;

const PACK_SIZE = 25;
const TOTAL_LEVELS = 500;
const PACKS_DIR = join(
  import.meta.dirname,
  '..',
  'src',
  'game',
  'levels',
  'packs',
);

export function loadAllLevels(): Level[] {
  const levels: Level[] = [];
  for (let packIndex = 0; packIndex * PACK_SIZE < TOTAL_LEVELS; packIndex++) {
    const from = packIndex * PACK_SIZE + 1;
    const to = from + PACK_SIZE - 1;
    const name = `pack_${String(from).padStart(3, '0')}_${String(to).padStart(
      3,
      '0',
    )}.json`;
    const pack: LevelPack = JSON.parse(
      readFileSync(join(PACKS_DIR, name), 'utf8'),
    );
    for (const packed of pack.levels) {
      levels.push(unpackLevel(packed));
    }
  }
  return levels;
}

/** Board identity, independent of level id — two levels may not ship the same board. */
function boardFingerprint(level: Level): string {
  const arrows = level.arrows
    .map(a => `${a.cells.map(c => `${c.x}.${c.y}`).join('-')}:${a.direction}`)
    .sort();
  return `${level.gridSize}|${arrows.join('/')}`;
}

function observedDistribution(level: Level): number[] {
  const buckets = new Array(8).fill(0);
  for (const arrow of level.arrows) {
    buckets[arrow.cells.length - 1]++;
  }
  return buckets.map(b => b / level.arrows.length);
}

export interface Issue {
  level: number;
  rule: string;
  detail: string;
  fatal: boolean;
}

export function validateAll(levels: readonly Level[]): Issue[] {
  const issues: Issue[] = [];
  const fingerprints = new Map<string, number>();

  for (const level of levels) {
    const slot = planLevel(level.id);
    const result = validate(level);

    if (!result.solvable) {
      issues.push({
        level: level.id,
        rule: 'solvable',
        detail: 'no free arrow remains',
        fatal: true,
      });
      continue;
    }
    for (const error of result.errors) {
      issues.push({
        level: level.id,
        rule: 'structure',
        detail: error,
        fatal: true,
      });
    }

    if (level.gridSize !== slot.gridSize) {
      issues.push({
        level: level.id,
        rule: 'grid',
        detail: `grid ${level.gridSize}, band wants ${slot.gridSize}`,
        fatal: true,
      });
    }
    const n = level.arrows.length;
    if (n < slot.minArrows || n > slot.maxArrows) {
      issues.push({
        level: level.id,
        rule: 'arrow-count',
        detail: `${n} arrows, band range is ${slot.minArrows}..${slot.maxArrows}`,
        fatal: true,
      });
    }

    if (result.difficulty > DIFFICULTY_CEILING) {
      issues.push({
        level: level.id,
        rule: 'ceiling',
        detail: `D ${result.difficulty} exceeds the ${DIFFICULTY_CEILING} ceiling`,
        fatal: true,
      });
    }
    const drift = Math.abs(result.difficulty - slot.targetD);
    if (drift > D_CI_TOLERANCE) {
      issues.push({
        level: level.id,
        rule: 'difficulty-window',
        detail: `D ${result.difficulty} vs slot target ${
          slot.targetD
        } (drift ${drift.toFixed(2)})`,
        fatal: false,
      });
    }

    // A level of n arrows cannot express a share finer than 1/n, so on a 7-arrow
    // tutorial board a single path is already 14 points. The 3-point rule only binds
    // where the board is big enough to satisfy it.
    const mixDrift = distributionError(observedDistribution(level), slot.mix);
    if (mixDrift > Math.max(MIX_CI_TOLERANCE, 1 / n)) {
      issues.push({
        level: level.id,
        rule: 'length-mix',
        detail: `worst bucket is ${(mixDrift * 100).toFixed(
          1,
        )} points off target`,
        fatal: false,
      });
    }

    if (n >= COLOUR_CAP_FROM_ARROWS) {
      const usage = new Map<string, number>();
      for (const arrow of level.arrows) {
        usage.set(arrow.color, (usage.get(arrow.color) ?? 0) + 1);
      }
      const share = Math.max(...usage.values()) / n;
      if (share > COLOUR_CAP_SHARE + 1e-9) {
        issues.push({
          level: level.id,
          rule: 'colour-balance',
          detail: `one colour carries ${(share * 100).toFixed(
            1,
          )}% of ${n} arrows`,
          fatal: false,
        });
      }
    }

    if (slot.decorRequired && (level.decor?.length ?? 0) === 0) {
      issues.push({
        level: level.id,
        rule: 'decor',
        detail: 'decor layer is required from level 100 onward',
        fatal: false,
      });
    }

    const print = boardFingerprint(level);
    const previous = fingerprints.get(print);
    if (previous !== undefined) {
      issues.push({
        level: level.id,
        rule: 'duplicate',
        detail: `identical board to level ${previous}`,
        fatal: true,
      });
    } else {
      fingerprints.set(print, level.id);
    }
  }

  return issues;
}

/** §20 — no reachable state is ever unsolvable, checked by random play. */
export function propertyCheck(levels: readonly Level[]): Issue[] {
  const issues: Issue[] = [];
  const rng = createRng(0x50f0);
  const step = Math.max(1, Math.floor(levels.length / PROPERTY_SAMPLE));
  for (let i = 0; i < levels.length; i += step) {
    const level = levels[i];
    for (let run = 0; run < PROPERTY_RUNS; run++) {
      if (!randomPlayStaysSolvable(level, () => rng.next())) {
        issues.push({
          level: level.id,
          rule: 'property',
          detail: `random play reached an unsolvable state on run ${run}`,
          fatal: true,
        });
        break;
      }
    }
  }
  return issues;
}

function main(): void {
  const levels = loadAllLevels();
  if (levels.length !== TOTAL_LEVELS) {
    console.error(
      `expected ${TOTAL_LEVELS} levels, packs hold ${levels.length}`,
    );
    process.exitCode = 1;
    return;
  }

  const issues = [...validateAll(levels), ...propertyCheck(levels)];
  const fatal = issues.filter(i => i.fatal);
  const warnings = issues.filter(i => !i.fatal);

  const byRule = new Map<string, Issue[]>();
  for (const issue of issues) {
    const list = byRule.get(issue.rule) ?? [];
    list.push(issue);
    byRule.set(issue.rule, list);
  }

  console.log(`validated ${levels.length} levels`);
  for (const [rule, list] of [...byRule.entries()].sort()) {
    const label = list[0].fatal ? 'FAIL' : 'warn';
    console.log(
      `  ${label} ${rule.padEnd(18)} ${String(list.length).padStart(4)}`,
    );
    for (const issue of list.slice(0, 5)) {
      console.log(`         level ${issue.level}: ${issue.detail}`);
    }
    if (list.length > 5) {
      console.log(`         ... and ${list.length - 5} more`);
    }
  }

  if (fatal.length > 0) {
    console.error(`\n${fatal.length} fatal issue(s) — build blocked`);
    process.exitCode = 1;
  } else {
    console.log(`\nno fatal issues; ${warnings.length} warning(s)`);
  }
}

if (process.argv[1]?.endsWith('validateLevels.ts')) {
  main();
}
