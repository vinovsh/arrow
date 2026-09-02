import {
  blockedTapsPerHeart,
  computeScore,
  computeStars,
  threeStarThreshold,
  twoStarThreshold,
} from '../src/game/engine/ScoreManager';

/** §9 exit criterion — the §11 formulas are unit-tested at n=12 and n=90. */
describe('scoring (§11)', () => {
  it('matches the storyboard ceiling of 1,250 on a perfect fast run', () => {
    const result = computeScore({
      n: 12,
      blockedTaps: 0,
      hintsUsed: 0,
      elapsedSeconds: 0,
      parTime: 40,
    });
    expect(result).toMatchObject({
      levelScore: 100,
      movesBonus: 450,
      perfectBonus: 300,
      speedBonus: 400,
      total: 1250,
      stars: 3,
      praise: 'AMAZING!',
    });
  });

  it('floors at 100 when the player was slow, messy and used hints', () => {
    const result = computeScore({
      n: 12,
      blockedTaps: 40,
      hintsUsed: 3,
      elapsedSeconds: 600,
      parTime: 40,
    });
    expect(result.total).toBe(100);
    expect(result.stars).toBe(1);
    expect(result.praise).toBe('NICE!');
  });

  it('never lets time remove a star, however slow the run', () => {
    const fast = computeScore({
      n: 12,
      blockedTaps: 0,
      hintsUsed: 0,
      elapsedSeconds: 5,
      parTime: 40,
    });
    const slow = computeScore({
      n: 12,
      blockedTaps: 0,
      hintsUsed: 0,
      elapsedSeconds: 5000,
      parTime: 40,
    });
    expect(slow.speedBonus).toBe(0);
    expect(slow.stars).toBe(fast.stars);
    expect(slow.stars).toBe(3);
  });

  it('forfeits three stars and the perfect bonus when a hint was used (§3.4)', () => {
    const result = computeScore({
      n: 12,
      blockedTaps: 0,
      hintsUsed: 1,
      elapsedSeconds: 10,
      parTime: 40,
    });
    expect(result.stars).toBe(2);
    expect(result.perfectBonus).toBe(0);
    // The moves bonus is untouched: a hint costs stars, nothing else.
    expect(result.movesBonus).toBe(450);
  });

  it('scales star tolerances with arrow count so 3 stars stay reachable at n=90', () => {
    // §11 — on a 12-arrow level that is 2 and 6 mistakes; at 90, 5 and 14.
    expect(threeStarThreshold(12)).toBe(2);
    expect(twoStarThreshold(12)).toBe(6);
    expect(threeStarThreshold(90)).toBe(5);
    expect(twoStarThreshold(90)).toBe(14);

    // The same five mistakes are a one-star run at n=12 and a three-star run at n=90.
    expect(computeStars(12, 5, 0)).toBe(2);
    expect(computeStars(90, 5, 0)).toBe(3);
  });

  it('keeps the moves bonus proportional to board size', () => {
    const small = computeScore({
      n: 12,
      blockedTaps: 6,
      hintsUsed: 0,
      elapsedSeconds: 20,
      parTime: 40,
    });
    const large = computeScore({
      n: 90,
      blockedTaps: 6,
      hintsUsed: 0,
      elapsedSeconds: 20,
      parTime: 180,
    });
    expect(large.movesBonus).toBeGreaterThan(small.movesBonus);
  });

  it('never returns a total outside 100..1250 across the whole parameter space', () => {
    for (const n of [3, 12, 40, 90]) {
      for (const blockedTaps of [0, 1, 5, 20, 200]) {
        for (const hintsUsed of [0, 3]) {
          for (const elapsedSeconds of [0, 30, 300, 5000]) {
            const total = computeScore({
              n,
              blockedTaps,
              hintsUsed,
              elapsedSeconds,
              parTime: 60,
            }).total;
            expect(total).toBeGreaterThanOrEqual(100);
            expect(total).toBeLessThanOrEqual(1250);
          }
        }
      }
    }
  });

  it('scales the heart cost with arrow count (§3.2)', () => {
    expect(blockedTapsPerHeart(9)).toBe(4);
    expect(blockedTapsPerHeart(90)).toBe(11);
  });
});
