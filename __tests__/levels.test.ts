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
import {DIR_VECTORS} from '../src/game/models/types';
import {createRng} from '../src/utils/rng';

describe('500-level campaign', () => {
  it('loads 500 consecutive levels in twenty complete packs', () => {
    expect(TOTAL_LEVELS).toBe(500);
    expect(TOTAL_PACKS).toBe(20);
    expect(PACK_SIZE).toBe(25);
    expect(getPageSummaries(0).map(s => s.id)).toEqual(
      Array.from({length: 25}, (_, i) => i + 1),
    );
    expect(getPageSummaries(1)[0].id).toBe(26);
    expect(getPageSummaries(19).map(s => s.id)).toEqual(
      Array.from({length: 25}, (_, i) => i + 476),
    );
    expect(getPageSummaries(20)).toEqual([]);
    expect(getLevel(0)).toBeNull();
    expect(getLevel(501)).toBeNull();
    expect(() => preloadAround(1)).not.toThrow();
    expect(() => preloadAround(25)).not.toThrow();
    expect(() => preloadAround(26)).not.toThrow();
    expect(() => preloadAround(500)).not.toThrow();
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
      for (
        let run = 0;
        run < (id % 25 === 0 || id === 1 || id === 21 ? 5 : 0);
        run++
      ) {
        expect(randomPlayStaysSolvable(level, () => rng.next())).toBe(true);
      }
    }
  });
  it('mixes short, medium and long arrows, with blocking after the tutorial', () => {
    for (let id = 2; id <= 20; id++) {
      const level = getLevel(id) as Level;
      const s = validate(level).signals!;
      const lengths = level.arrows.map(a => a.cells.length);
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(4);
      expect(
        lengths.filter(n => n <= 7).length / lengths.length,
      ).toBeGreaterThanOrEqual(0.2);
      expect(
        lengths.filter(n => n >= 8 && n <= 19).length / lengths.length,
      ).toBeGreaterThanOrEqual(0.25);
      const longShare = lengths.filter(n => n >= 20).length / lengths.length;
      expect(longShare).toBeGreaterThanOrEqual(0.25);
      expect(longShare).toBeLessThanOrEqual(0.5);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(64);
      expect(
        lengths.reduce((a, b) => a + b, 0) / lengths.length,
      ).toBeGreaterThanOrEqual(12);
      expect(s.occupancy).toBeGreaterThanOrEqual(0.94);
      expect(s.depth).toBeGreaterThanOrEqual(
        id === 1 ? 3 : id === 2 ? 5 : id < 10 ? 8 : 12,
      );
      expect(s.blockedStart).toBeGreaterThanOrEqual(
        id === 1 ? 0.55 : id === 2 ? 0.65 : id < 10 ? 0.75 : 0.8,
      );
      expect(level.decor ?? []).toEqual([]);
    }
  });
  it('keeps each complete forward exit lane clear of that arrow’s own body', () => {
    for (let id = 1; id <= 20; id++) {
      const level = getLevel(id) as Level;
      for (const arrow of level.arrows) {
        const head = arrow.cells[arrow.cells.length - 1];
        const step = DIR_VECTORS[arrow.direction];
        for (
          let x = head.x + step.x, y = head.y + step.y;
          x >= 0 && y >= 0 && x < level.gridSize && y < level.gridSize;
          x += step.x, y += step.y
        ) {
          expect(arrow.cells.some(p => p.x === x && p.y === y)).toBe(false);
        }
      }
    }
  });
  it('starts with four isolated straight practice arrows', () => {
    const level = getLevel(1) as Level;
    expect(level.band).toBe('Tutorial');
    expect(level.arrows).toHaveLength(4);
    expect(validate(level).freeCounts[0]).toBe(4);
    for (const arrow of level.arrows) {
      expect(arrow.cells).toHaveLength(5);
      expect(new Set(arrow.cells.map(p => p.x)).size).toBe(1);
    }
  });
});
