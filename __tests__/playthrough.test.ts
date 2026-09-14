import {GameEngine} from '../src/game/engine/GameEngine';
import {HintService} from '../src/game/engine/HintService';
import {computeScore} from '../src/game/engine/ScoreManager';
import {getLevel} from '../src/game/levels';
import {buildArrowGeometry} from '../src/game/renderer/arrowGeometry';
import {arrowHeadSizeFor, strokeWidthFor} from '../src/utils/layout';
import {createRng} from '../src/utils/rng';
import type {Level} from '../src/game/models/types';

/**
 * End-to-end play, driven the way the screen drives it: hit-test a point, resolve the
 * tap, act on the outcome. These are the §20 gameplay criteria that a unit test of any
 * single class cannot reach — that a real board, tapped at real coordinates, empties.
 */

/** Tap the arrow the way a player would: at the centre of its head cell. */
function tapCentreOf(
  engine: GameEngine,
  index: number,
  cellSize: number,
): number {
  const geometry = buildArrowGeometry(engine.level.arrows[index], cellSize);
  return engine.hitTest(
    geometry.headCentre.x / cellSize,
    geometry.headCentre.y / cellSize,
    cellSize,
    1,
  );
}

describe('playing a real level to completion', () => {
  const cellSize = 32;

  it('empties the board by tapping free arrows, on a level from each band', () => {
    for (const id of [
      1, 5, 12, 30, 70, 120, 180, 230, 275, 330, 380, 430, 500,
    ]) {
      const level = getLevel(id) as Level;
      const engine = new GameEngine(level);
      let guard = level.arrows.length + 5;

      while (engine.activeCount > 0 && guard-- > 0) {
        const free = engine.detector.freeIndices();
        expect(free.length).toBeGreaterThan(0);
        // Go through the hit-tester rather than calling resolveTap directly, so a
        // coordinate bug cannot hide behind a correct engine.
        const hit = tapCentreOf(engine, free[0], cellSize);
        expect(hit).toBe(free[0]);
        expect(engine.resolveTap(hit).kind).toBe('escaped');
      }

      expect(engine.activeCount).toBe(0);
      // §20 — win fires exactly at activeArrowCount === 0, with no blocked taps on a
      // run that only ever tapped free arrows.
      expect(engine.blockedTaps).toBe(0);
    }
  });

  it('awards three stars and the perfect bonus for a clean run', () => {
    const level = getLevel(42) as Level;
    const engine = new GameEngine(level);
    while (engine.activeCount > 0) {
      engine.resolveTap(engine.detector.freeIndices()[0]);
    }
    const breakdown = computeScore({
      n: level.arrows.length,
      blockedTaps: engine.blockedTaps,
      hintsUsed: engine.hintsUsed,
      elapsedSeconds: 1,
      parTime: level.parTime,
    });
    expect(breakdown.stars).toBe(3);
    expect(breakdown.perfectBonus).toBe(300);
    expect(breakdown.praise).toBe('AMAZING!');
  });

  it('survives a player who taps blindly and never gets stuck (§2.3, §20)', () => {
    const level = getLevel(310) as Level;
    const engine = new GameEngine(level);
    const rng = createRng(31);

    // Tap arrows completely at random, blocked or not, until the board is clear.
    let guard = level.arrows.length * 60;
    while (engine.activeCount > 0 && guard-- > 0) {
      const active = engine.detector.activeIndices();
      engine.resolveTap(active[rng.int(active.length)]);
    }
    expect(engine.activeCount).toBe(0);
    // A dead end is impossible, so blind play finishes — it just costs stars.
    expect(engine.blockedTaps).toBeGreaterThan(0);
  });

  it('always names a legal move when asked for a hint, at every state (§20)', () => {
    const level = getLevel(455) as Level;
    const engine = new GameEngine(level);
    const hints = new HintService();

    while (engine.activeCount > 0) {
      const suggestion = hints.suggest(engine.detector);
      expect(suggestion).toBeGreaterThanOrEqual(0);
      // The hint must be a move that actually works, not merely an active arrow.
      expect(engine.detector.isFree(suggestion)).toBe(true);
      engine.resolveTap(suggestion);
    }
    expect(engine.activeCount).toBe(0);
  });

  it('rations hints to three per level with an 8s cooldown (§3.4)', () => {
    const hints = new HintService();
    let now = 1_000_000;
    expect(hints.remaining).toBe(3);

    expect(hints.consume(now)).toBe(true);
    // A second hint inside the cooldown is refused without spending anything.
    expect(hints.consume(now + 1000)).toBe(false);
    expect(hints.remaining).toBe(2);

    now += 8000;
    expect(hints.consume(now)).toBe(true);
    now += 8000;
    expect(hints.consume(now)).toBe(true);
    now += 8000;
    // Out of hints, cooldown or not.
    expect(hints.consume(now)).toBe(false);

    hints.reset();
    expect(hints.remaining).toBe(3);
  });

  it('prefers the hint that unblocks the most other arrows', () => {
    const level = getLevel(200) as Level;
    const engine = new GameEngine(level);
    const hints = new HintService();
    const suggestion = hints.suggest(engine.detector);

    const unblocksFor = (index: number): number =>
      engine.detector
        .activeIndices()
        .filter(i => i !== index && engine.detector.firstBlocker(i) === index)
        .length;

    const best = Math.max(...engine.detector.freeIndices().map(unblocksFor));
    expect(unblocksFor(suggestion)).toBe(best);
  });

  it('keeps every arrow inside the board and off its neighbours, on a dense level', () => {
    const level = getLevel(500) as Level;
    const occupied = new Set<string>();
    for (const arrow of level.arrows) {
      for (const cell of arrow.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(level.gridSize);
        expect(cell.y).toBeLessThan(level.gridSize);
        const key = `${cell.x},${cell.y}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
  });

  it('renders geometry for every arrow shape, including single cells', () => {
    const CELL = 24;
    for (const id of [1, 250, 500]) {
      const level = getLevel(id) as Level;
      for (const arrow of level.arrows) {
        const geometry = buildArrowGeometry(arrow, CELL);
        // Every arrow is a line with a head on it — a single cell included, which
        // gets a stub of body rather than being left as a bare floating triangle.
        expect(geometry.head).toMatch(/^M /);
        expect(geometry.body).toMatch(/^M /);
      }
    }
  });

  /**
   * §10.2 — the arrow is a line, not a pipe, and the head terminates it rather than
   * replacing it. Both of those are ratios, so they are asserted as ratios: a future
   * tweak to the constants is free, going back to a tube is not.
   */
  it('draws a thin line with a small head at every grid size', () => {
    // Every cell size the fit calculation produces from 5x5 up to 14x14.
    for (const cell of [16, 24, 32, 46, 65]) {
      const stroke = strokeWidthFor(cell);
      expect(stroke).toBeLessThanOrEqual(cell * 0.16);
      expect(stroke).toBeGreaterThanOrEqual(2.5);

      const head = arrowHeadSizeFor(cell, stroke, 4);
      // The head is a terminator: a couple of line-widths across, nowhere near the
      // five-to-eight it becomes if it is sized off the cell instead.
      expect(head.halfWidth / stroke).toBeLessThanOrEqual(2);
      expect(head.length / stroke).toBeLessThanOrEqual(3);
      // ...and never wide enough to reach into the neighbouring path.
      expect(head.halfWidth * 2).toBeLessThan(cell * 0.6);
    }
  });
});
