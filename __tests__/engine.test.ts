import {CollisionDetector} from '../src/game/engine/CollisionDetector';
import {GameEngine} from '../src/game/engine/GameEngine';
import type {ArrowPath, Level} from '../src/game/models/types';
import {blockedTapsPerHeart} from '../src/game/engine/ScoreManager';

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

const makeLevel = (arrows: ArrowPath[], gridSize = 5, id = 1): Level => ({
  id,
  gridSize,
  theme: 'test',
  band: 'Tutorial',
  difficulty: 2,
  parTime: 30,
  arrows,
});

describe('CollisionDetector', () => {
  it('reports an arrow free when nothing stands in its corridor', () => {
    const detector = new CollisionDetector(5, [arrow('a', [[2, 2]], 'R')]);
    expect(detector.isFree(0)).toBe(true);
    expect(detector.firstBlocker(0)).toBe(-1);
  });

  it('finds the first blocker along the corridor, not merely any occupied cell', () => {
    const detector = new CollisionDetector(5, [
      arrow('a', [[0, 2]], 'R'),
      arrow('b', [[2, 2]], 'U'),
      arrow('c', [[4, 2]], 'D'),
    ]);
    expect(detector.firstBlocker(0)).toBe(1);
  });

  it('never lets an arrow block itself, even when its own body lies ahead', () => {
    // An L-path whose tail sits directly in front of its own head: the whole path
    // slides at once, so those cells move out of the way at the same speed (§2.1).
    const detector = new CollisionDetector(5, [
      arrow(
        'a',
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 1],
        ],
        'U',
      ),
    ]);
    expect(detector.isFree(0)).toBe(true);
  });

  it('frees the blocked arrow once its blocker is removed', () => {
    const detector = new CollisionDetector(5, [
      arrow('a', [[0, 0]], 'R'),
      arrow('b', [[3, 0]], 'D'),
    ]);
    expect(detector.isFree(0)).toBe(false);
    detector.remove(1);
    expect(detector.isFree(0)).toBe(true);
  });

  it('is monotone: removing an arrow can only ever grow the free set (§2.3)', () => {
    const detector = new CollisionDetector(5, [
      arrow('a', [[0, 0]], 'R'),
      arrow('b', [[2, 0]], 'R'),
      arrow('c', [[4, 0]], 'D'),
      arrow('d', [[0, 4]], 'L'),
    ]);
    while (detector.activeCount > 0) {
      const before = new Set(detector.freeIndices());
      const pick = detector.freeIndices()[0];
      detector.remove(pick);
      for (const index of detector.freeIndices()) {
        // Everything free before must still be free, minus the one just removed.
        expect(before.has(index) || detector.firstBlocker(index) === -1).toBe(
          true,
        );
      }
    }
  });

  it('computes exit distance from the head to the board edge', () => {
    const detector = new CollisionDetector(5, [
      arrow('a', [[1, 1]], 'U'),
      arrow('b', [[1, 3]], 'D'),
      arrow('c', [[3, 3]], 'R'),
    ]);
    expect(detector.exitDistance(0)).toBe(2);
    expect(detector.exitDistance(1)).toBe(2);
    expect(detector.exitDistance(2)).toBe(2);
  });

  it('blockerMap agrees with firstBlocker for every arrow', () => {
    const arrows = [
      arrow('a', [[0, 0]], 'R'),
      arrow('b', [[2, 0]], 'D'),
      arrow('c', [[2, 3]], 'L'),
    ];
    const detector = new CollisionDetector(5, arrows);
    const map = detector.blockerMap();
    for (let i = 0; i < arrows.length; i++) {
      expect(map[i]).toBe(detector.firstBlocker(i));
    }
  });
});

describe('GameEngine tap resolution', () => {
  it('escapes a free arrow and clears the board when it was the last one', () => {
    const engine = new GameEngine(makeLevel([arrow('a', [[2, 2]], 'R')]));
    const outcome = engine.resolveTap(0);
    expect(outcome.kind).toBe('escaped');
    if (outcome.kind === 'escaped') {
      expect(outcome.boardCleared).toBe(true);
    }
    expect(engine.activeCount).toBe(0);
  });

  it('reports the blocker so the board can flash it, and never removes the arrow', () => {
    const engine = new GameEngine(
      makeLevel([arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')]),
    );
    const outcome = engine.resolveTap(0);
    expect(outcome.kind).toBe('blocked');
    if (outcome.kind === 'blocked') {
      expect(outcome.blockerIndex).toBe(1);
    }
    // §20 — blocked arrows always shake and never vanish.
    expect(engine.activeCount).toBe(2);
    expect(engine.blockedTaps).toBe(1);
  });

  it('ignores taps on an already-escaped arrow', () => {
    const engine = new GameEngine(makeLevel([arrow('a', [[2, 2]], 'R')]));
    engine.resolveTap(0);
    expect(engine.resolveTap(0).kind).toBe('ignored');
  });

  it('disables lives below level 26 however many mistakes are made (§3.2)', () => {
    const engine = new GameEngine(
      makeLevel([arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')], 5, 25),
    );
    for (let i = 0; i < 20; i++) {
      engine.resolveTap(0);
    }
    expect(engine.livesEnabled).toBe(false);
    expect(engine.hearts).toBe(3);
  });

  it('spends a heart every max(4, n * 0.12) blocked taps from level 26 (§3.2)', () => {
    const arrows = [arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')];
    const engine = new GameEngine(makeLevel(arrows, 5, 26));
    const per = blockedTapsPerHeart(arrows.length);
    expect(per).toBe(4);

    for (let i = 0; i < per - 1; i++) {
      engine.resolveTap(0);
    }
    expect(engine.hearts).toBe(3);
    const outcome = engine.resolveTap(0);
    expect(outcome.kind === 'blocked' && outcome.heartLost).toBe(true);
    expect(engine.hearts).toBe(2);
  });

  it('restores the board, hearts and counters on restart at no cost (§3.2)', () => {
    const engine = new GameEngine(
      makeLevel([arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')], 5, 30),
    );
    engine.resolveTap(1);
    engine.resolveTap(0);
    engine.hintsUsed = 2;
    engine.restart();
    expect(engine.activeCount).toBe(2);
    expect(engine.blockedTaps).toBe(0);
    expect(engine.hintsUsed).toBe(0);
    expect(engine.hearts).toBe(3);
  });

  it('stops the clock while paused (§5.11)', async () => {
    const engine = new GameEngine(makeLevel([arrow('a', [[2, 2]], 'R')]));
    engine.pause();
    const frozen = engine.elapsedSeconds;
    await new Promise<void>(resolve => setTimeout(resolve, 40));
    expect(engine.elapsedSeconds).toBeCloseTo(frozen, 3);
    engine.resume();
  });

  it('offers the silent assist after four consecutive blocked taps (§3.3)', () => {
    const engine = new GameEngine(
      makeLevel([arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')], 5, 30),
    );
    for (let i = 0; i < 3; i++) {
      engine.resolveTap(0);
    }
    expect(engine.shouldOfferSilentAssist()).toBe(false);
    engine.resolveTap(0);
    expect(engine.shouldOfferSilentAssist()).toBe(true);
  });

  it('resets the consecutive-blocked run on a successful move', () => {
    const engine = new GameEngine(
      makeLevel([arrow('a', [[0, 0]], 'R'), arrow('b', [[3, 0]], 'D')], 5, 30),
    );
    engine.resolveTap(0);
    engine.resolveTap(0);
    expect(engine.consecutiveBlockedTaps).toBe(2);
    engine.resolveTap(1);
    expect(engine.consecutiveBlockedTaps).toBe(0);
  });
});
