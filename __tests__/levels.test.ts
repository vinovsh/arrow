import {
  PACK_SIZE,
  TOTAL_LEVELS,
  TOTAL_PACKS,
  getLevel,
  getPageSummaries,
  preloadAround,
} from '../src/game/levels';
import {packLevel, unpackLevel} from '../src/game/levels/codec';
import {
  validate,
  randomPlayStaysSolvable,
} from '../src/game/engine/LevelValidator';
import type {Level} from '../src/game/models/types';
import {createRng} from '../src/utils/rng';

describe('first 20 replacement levels', () => {
  it('loads exactly 20 levels in a partial 25-slot pack', () => {
    expect(TOTAL_LEVELS).toBe(20);
    expect(TOTAL_PACKS).toBe(1);
    expect(PACK_SIZE).toBe(25);
    expect(getPageSummaries(0).map(s => s.id)).toEqual(
      Array.from({length: 20}, (_, i) => i + 1),
    );
    expect(getPageSummaries(1)).toEqual([]);
    expect(getLevel(0)).toBeNull();
    expect(getLevel(21)).toBeNull();
    expect(() => preloadAround(1)).not.toThrow();
    expect(() => preloadAround(20)).not.toThrow();
  });
  it('round-trips, solves and remains solvable during random legal play', () => {
    const rng = createRng(909),
      seen = new Set<string>();
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
      const level = getLevel(id) as Level;
      expect(level.id).toBe(id);
      expect(unpackLevel(packLevel(level))).toEqual(level);
      const v = validate(level);
      expect(v.errors).toEqual([]);
      expect(v.solvable).toBe(true);
      expect(v.difficulty).toBe(level.difficulty);
      expect(level.arrows.length).toBeLessThanOrEqual(254);
      const key = level.arrows
        .map(a => JSON.stringify([a.cells, a.direction]))
        .sort()
        .join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      for (let run = 0; run < 30; run++)
        {expect(randomPlayStaysSolvable(level, () => rng.next())).toBe(true);}
    }
  });
  it('keeps teaching boards open and gives hard boards genuine dependencies', () => {
    for (let id = 1; id <= 2; id++)
      {expect(validate(getLevel(id) as Level).signals?.blockedStart).toBe(0);}
    for (let id = 3; id <= 20; id++) {
      const level = getLevel(id) as Level,
        s = validate(level).signals!;
      if (level.band === 'Hard') {
        expect(s.depth).toBeGreaterThanOrEqual(10);
        expect(s.blockedStart).toBeGreaterThanOrEqual(0.8);
      }
      if (level.band === 'Very Hard') {
        expect(s.depth).toBeGreaterThanOrEqual(16);
        expect(s.blockedStart).toBeGreaterThanOrEqual(0.9);
      }
    }
  });
});
