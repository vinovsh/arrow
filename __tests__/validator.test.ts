import {
  computeDifficulty,
  computeParTime,
  randomPlayStaysSolvable,
  structuralErrors,
  validate,
} from '../src/game/engine/LevelValidator';
import type {ArrowPath, Level} from '../src/game/models/types';
import {createRng} from '../src/utils/rng';

const arrow = (
  id: string,
  cells: [number, number][],
  direction: ArrowPath['direction'],
): ArrowPath => ({
  id,
  color: 'cyan',
  cells: cells.map(([x, y]) => ({x, y})),
  direction,
});

describe('structural validation (§8.4)', () => {
  it('accepts a well-formed level', () => {
    expect(
      structuralErrors(5, [
        arrow(
          'a',
          [
            [0, 0],
            [1, 0],
          ],
          'R',
        ),
        arrow('b', [[3, 3]], 'D'),
      ]),
    ).toEqual([]);
  });

  it('rejects two arrows sharing a cell', () => {
    const errors = structuralErrors(5, [
      arrow('a', [[1, 1]], 'R'),
      arrow('b', [[1, 1]], 'D'),
    ]);
    expect(errors.some(e => e.includes('already used by'))).toBe(true);
  });

  it('rejects a cell outside the grid', () => {
    const errors = structuralErrors(5, [arrow('a', [[5, 1]], 'R')]);
    expect(errors.some(e => e.includes('outside the grid'))).toBe(true);
  });

  it('rejects non-adjacent consecutive cells', () => {
    const errors = structuralErrors(5, [
      arrow(
        'a',
        [
          [0, 0],
          [2, 0],
        ],
        'R',
      ),
    ]);
    expect(errors.some(e => e.includes('not adjacent'))).toBe(true);
  });

  it('rejects a stored direction that disagrees with the path', () => {
    const errors = structuralErrors(5, [
      arrow(
        'a',
        [
          [0, 0],
          [1, 0],
        ],
        'L',
      ),
    ]);
    expect(errors.some(e => e.includes('disagrees with path'))).toBe(true);
  });

  it('accepts any direction on a single-cell arrow, which has no implied one', () => {
    for (const d of ['U', 'D', 'L', 'R'] as const) {
      expect(structuralErrors(5, [arrow('a', [[2, 2]], d)])).toEqual([]);
    }
  });

  it('rejects a path longer than eight cells', () => {
    const cells: [number, number][] = Array.from({length: 9}, (_, i) => [i, 0]);
    const errors = structuralErrors(10, [arrow('a', cells, 'R')]);
    expect(errors.some(e => e.includes('outside 1..8'))).toBe(true);
  });
});

describe('solvability (§2.3, §8.4)', () => {
  it('proves a solvable board and returns a canonical order the length of the board', () => {
    const level = {
      gridSize: 5,
      arrows: [arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')],
    };
    const result = validate(level);
    expect(result.solvable).toBe(true);
    expect(result.order).toHaveLength(2);
    // b must leave before a, since b sits in a's corridor.
    expect(result.order[0]).toBe('b');
  });

  it('rejects a mutually blocking pair as unsolvable', () => {
    // Two arrows pointing into each other: neither corridor can ever clear.
    const level = {
      gridSize: 5,
      arrows: [arrow('a', [[1, 0]], 'R'), arrow('b', [[3, 0]], 'L')],
    };
    const result = validate(level);
    expect(result.solvable).toBe(false);
    expect(result.errors.some(e => e.includes('unsolvable'))).toBe(true);
  });

  it('rejects a three-arrow cycle', () => {
    const level = {
      gridSize: 4,
      arrows: [
        arrow('a', [[0, 0]], 'R'),
        arrow('b', [[2, 0]], 'D'),
        arrow('c', [[2, 2]], 'L'),
        arrow('d', [[0, 2]], 'U'),
      ],
    };
    expect(validate(level).solvable).toBe(false);
  });

  it('records the free count at every state', () => {
    const level = {
      gridSize: 6,
      arrows: [
        arrow('a', [[0, 0]], 'R'),
        arrow('b', [[3, 0]], 'D'),
        arrow('c', [[0, 5]], 'L'),
      ],
    };
    const result = validate(level);
    expect(result.freeCounts).toHaveLength(3);
    expect(result.freeCounts[0]).toBe(2);
  });

  it('holds solvability under random play, however the player chooses (§20)', () => {
    const level = {
      gridSize: 6,
      arrows: [
        arrow('a', [[0, 0]], 'R'),
        arrow('b', [[3, 0]], 'D'),
        arrow('c', [[3, 3]], 'L'),
        arrow('d', [[0, 5]], 'U'),
        arrow('e', [[5, 5]], 'R'),
      ],
    };
    const rng = createRng(7);
    for (let run = 0; run < 200; run++) {
      expect(randomPlayStaysSolvable(level, () => rng.next())).toBe(true);
    }
  });
});

describe('difficulty model (§7.2, §7.3)', () => {
  const signals = {
    n: 40,
    depth: 4,
    freeMinCount: 3,
    freeAvgCount: 6,
    blockedStart: 0.5,
    turns: 1,
    occupancy: 0.6,
    spanAvg: 2,
  };

  it('stays inside 1..10', () => {
    expect(computeDifficulty(signals)).toBeGreaterThanOrEqual(1);
    expect(computeDifficulty(signals)).toBeLessThanOrEqual(10);
  });

  it('rises as options shrink', () => {
    const roomy = computeDifficulty({...signals, freeAvgCount: 12});
    const tight = computeDifficulty({...signals, freeAvgCount: 1});
    expect(tight).toBeGreaterThan(roomy);
  });

  it('saturates freedom at six options, since perception of choice does (§7.2)', () => {
    expect(computeDifficulty({...signals, freeAvgCount: 6})).toBeCloseTo(
      computeDifficulty({...signals, freeAvgCount: 60}),
      10,
    );
  });

  it('weighs sheer arrow count lightly, so a long board is not a hard one (§4.3)', () => {
    const short = computeDifficulty({...signals, n: 10});
    const long = computeDifficulty({...signals, n: 90});
    expect(long - short).toBeLessThan(0.5);
  });

  it('clamps par time to 20..240 seconds', () => {
    expect(computeParTime(3, 1)).toBeGreaterThanOrEqual(20);
    expect(computeParTime(90, 7)).toBeLessThanOrEqual(240);
    // §7.3's own worked example: a 90-arrow level at D = 5.5 gives about 181s.
    expect(computeParTime(90, 5.5)).toBe(180);
  });
});

describe('difficulty signals are measured over the decision phase', () => {
  it('does not let the final one-arrow state pin freeMinCount to 1 forever', () => {
    // Every solve ends with a single free arrow. Read literally, "fewest free arrows
    // at any state" would therefore be 1 on every level ever made, which would make
    // §8.3's freeMinCount >= 3 gate unsatisfiable.
    const level: Pick<Level, 'gridSize' | 'arrows'> = {
      gridSize: 8,
      arrows: [
        arrow('a', [[0, 0]], 'U'),
        arrow('b', [[2, 0]], 'U'),
        arrow('c', [[4, 0]], 'U'),
        arrow('d', [[6, 0]], 'U'),
        arrow('e', [[0, 2]], 'L'),
        arrow('f', [[2, 2]], 'D'),
        arrow('g', [[4, 2]], 'D'),
      ],
    };
    const result = validate(level);
    expect(result.solvable).toBe(true);
    expect(result.signals?.freeMinCount).toBeGreaterThanOrEqual(3);
  });
});
