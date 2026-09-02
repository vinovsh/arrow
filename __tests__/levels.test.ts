import {
  PACK_SIZE,
  TOTAL_LEVELS,
  TOTAL_PACKS,
  getLevel,
  getPageSummaries,
  packIndexForLevel,
  preloadAround,
} from '../src/game/levels';
import {packLevel, unpackLevel} from '../src/game/levels/codec';
import {validate} from '../src/game/engine/LevelValidator';
import {randomPlayStaysSolvable} from '../src/game/engine/LevelValidator';
import {createRng} from '../src/utils/rng';
import type {Level} from '../src/game/models/types';

/**
 * These run against the committed packs, so they are the app's own copy of the CI gate
 * in tools/validateLevels.ts: whatever the pipeline produced, the shipping bundle has
 * to be able to load and play it.
 */
describe('level packs', () => {
  it('exposes 500 levels across 20 packs of 25 (§8.5)', () => {
    expect(TOTAL_LEVELS).toBe(500);
    expect(PACK_SIZE).toBe(25);
    expect(TOTAL_PACKS).toBe(20);
    expect(packIndexForLevel(1)).toBe(0);
    expect(packIndexForLevel(25)).toBe(0);
    expect(packIndexForLevel(26)).toBe(1);
    expect(packIndexForLevel(500)).toBe(19);
  });

  it('loads every level in the set', () => {
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
      const level = getLevel(id);
      expect(level).not.toBeNull();
      expect(level?.id).toBe(id);
    }
  });

  it('returns null outside the level range rather than throwing', () => {
    expect(getLevel(0)).toBeNull();
    expect(getLevel(501)).toBeNull();
  });

  it('round-trips a level through the pack codec unchanged', () => {
    const level = getLevel(137) as Level;
    const again = unpackLevel(packLevel(level));
    expect(again.gridSize).toBe(level.gridSize);
    expect(again.arrows).toHaveLength(level.arrows.length);
    for (let i = 0; i < level.arrows.length; i++) {
      expect(again.arrows[i].direction).toBe(level.arrows[i].direction);
      expect(again.arrows[i].color).toBe(level.arrows[i].color);
      expect(again.arrows[i].cells).toEqual(level.arrows[i].cells);
    }
  });

  it('lists 25 summaries per page without unpacking arrows', () => {
    const summaries = getPageSummaries(3);
    expect(summaries).toHaveLength(25);
    expect(summaries[0].id).toBe(76);
    expect(summaries[24].id).toBe(100);
    expect(summaries[0].arrowCount).toBeGreaterThan(0);
  });

  it('preloads without error at either end of the set', () => {
    expect(() => preloadAround(1)).not.toThrow();
    expect(() => preloadAround(500)).not.toThrow();
  });
});

describe('every shipped level is playable (§20)', () => {
  const all: Level[] = [];
  beforeAll(() => {
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
      all.push(getLevel(id) as Level);
    }
  });

  it('is solvable and structurally sound, all 500 of them', () => {
    const broken: string[] = [];
    for (const level of all) {
      const result = validate(level);
      if (!result.solvable) {
        broken.push(`level ${level.id} is unsolvable`);
      }
      for (const error of result.errors) {
        broken.push(`level ${level.id}: ${error}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never exceeds the D = 7.0 ceiling (§3.1)', () => {
    const over = all
      .filter(l => l.difficulty > 7.0)
      .map(l => `${l.id}:${l.difficulty}`);
    expect(over).toEqual([]);
  });

  it('matches the §4.1 grid and arrow-count table exactly', () => {
    const rows: [number, number, number, number, number][] = [
      // from, to, grid, minArrows, maxArrows
      [1, 1, 5, 3, 4],
      [2, 2, 5, 4, 5],
      [3, 3, 6, 5, 7],
      [4, 10, 7, 8, 12],
      [11, 25, 8, 16, 22],
      [26, 50, 9, 20, 28],
      [51, 100, 10, 26, 36],
      [101, 150, 11, 32, 42],
      [151, 200, 11, 36, 48],
      [201, 250, 12, 42, 54],
      [251, 300, 12, 46, 60],
      [301, 350, 13, 52, 66],
      [351, 400, 13, 58, 72],
      [401, 450, 14, 64, 80],
      [451, 500, 14, 70, 90],
    ];
    const wrong: string[] = [];
    for (const [from, to, grid, min, max] of rows) {
      for (const level of all.slice(from - 1, to)) {
        if (level.gridSize !== grid) {
          wrong.push(
            `level ${level.id} grid ${level.gridSize}, expected ${grid}`,
          );
        }
        const n = level.arrows.length;
        if (n < min || n > max) {
          wrong.push(
            `level ${level.id} has ${n} arrows, expected ${min}..${max}`,
          );
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('ships no duplicate boards (§8.4)', () => {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    for (const level of all) {
      const key =
        `${level.gridSize}|` +
        level.arrows
          .map(
            a =>
              `${a.cells.map(c => `${c.x}.${c.y}`).join('-')}:${a.direction}`,
          )
          .sort()
          .join('/');
      const previous = seen.get(key);
      if (previous !== undefined) {
        duplicates.push(`level ${level.id} duplicates level ${previous}`);
      } else {
        seen.set(key, level.id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('balances colour on boards of 40+ arrows (§4.2)', () => {
    const offenders: string[] = [];
    for (const level of all) {
      const n = level.arrows.length;
      if (n < 40) {
        continue;
      }
      const usage = new Map<string, number>();
      for (const a of level.arrows) {
        usage.set(a.color, (usage.get(a.color) ?? 0) + 1);
      }
      const share = Math.max(...usage.values()) / n;
      if (share > 0.25 + 1e-9) {
        offenders.push(`level ${level.id}: ${(share * 100).toFixed(1)}%`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('carries a decor layer from level 100 onward (§4.2)', () => {
    const missing = all
      .filter(l => l.id >= 100 && (l.decor?.length ?? 0) === 0)
      .map(l => l.id);
    expect(missing).toEqual([]);
  });

  it('never reaches an unsolvable state under random play, on 100 sampled levels (§20)', () => {
    const rng = createRng(0xa17);
    const failures: number[] = [];
    for (let id = 1; id <= TOTAL_LEVELS; id += 5) {
      const level = all[id - 1];
      for (let run = 0; run < 20; run++) {
        if (!randomPlayStaysSolvable(level, () => rng.next())) {
          failures.push(level.id);
          break;
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
