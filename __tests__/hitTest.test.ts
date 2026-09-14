import {
  HitTester,
  HIT_RADIUS_DP,
  MAX_HIT_RADIUS_CELLS,
} from '../src/game/engine/HitTester';
import {GameEngine} from '../src/game/engine/GameEngine';
import {
  computeBoardMetrics,
  screenToBoard,
  clampPan,
} from '../src/utils/layout';
import type {ArrowPath, Level} from '../src/game/models/types';

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

const always = (): boolean => true;

describe('proximity hit-testing (§4.4)', () => {
  const arrows = [
    arrow(
      'a',
      [
        [1, 1],
        [2, 1],
      ],
      'R',
    ),
    arrow('b', [[4, 4]], 'D'),
  ];
  const tester = new HitTester(arrows);

  it('selects the nearest arrow rather than requiring a direct hit', () => {
    // Half a cell above the a-path: not on it, but well inside the slop radius.
    expect(tester.hitTest(1.5, 1.0, 0.8, always)).toBe(0);
  });

  it('finds single-cell arrows, which are a degenerate segment', () => {
    expect(tester.hitTest(4.5, 4.5, 0.8, always)).toBe(1);
  });

  it('returns -1 when nothing is within the radius', () => {
    expect(tester.hitTest(0, 4, 0.4, always)).toBe(-1);
  });

  it('never selects an arrow the predicate rejects, so escaped arrows stay untappable', () => {
    expect(tester.hitTest(4.5, 4.5, 0.8, i => i !== 1)).toBe(-1);
  });

  it('picks the closer of two candidates', () => {
    const pair = new HitTester([
      arrow('a', [[0, 0]], 'R'),
      arrow('b', [[2, 0]], 'R'),
    ]);
    expect(pair.hitTest(0.7, 0.5, 2, always)).toBe(0);
    expect(pair.hitTest(2.2, 0.5, 2, always)).toBe(1);
  });
});

describe('hit-testing under zoom (§4.4, Phase 5 exit criterion)', () => {
  const level: Level = {
    id: 1,
    gridSize: 10,
    theme: 'test',
    band: 'Medium+',
    difficulty: 3,
    parTime: 60,
    arrows: [arrow('a', [[1, 1]], 'R'), arrow('b', [[3, 1]], 'R')],
  };

  it('tightens the effective radius as the board is magnified', () => {
    const engine = new GameEngine(level);
    const cellSize = 32;

    // A touch 0.6 cells from arrow a: inside the slop at fit, outside it at 3x.
    const offBy = 0.6;
    const atFit = engine.hitTest(1.5 + offBy, 1.5, cellSize, 1);
    const atZoom = engine.hitTest(1.5 + offBy, 1.5, cellSize, 3.5);
    expect(atFit).toBe(0);
    expect(atZoom).toBe(-1);

    // Sanity: the radius really is HIT_RADIUS_DP scaled by cellSize x scale.
    expect(HIT_RADIUS_DP / (cellSize * 1)).toBeGreaterThan(offBy);
    expect(HIT_RADIUS_DP / (cellSize * 3.5)).toBeLessThan(offBy);
  });

  /**
   * §4.4 on a fine grid. Parallel paths are one cell apart at every grid size, so the
   * dp slop has to be capped in cell units or a 22x22 board hands taps to the
   * neighbouring path.
   */
  it('never reaches past the neighbouring path on a fine grid', () => {
    const engine = new GameEngine(level);
    const fineCell = 14; // a 22x22 board on a 328dp viewport

    // Unclamped, 22dp over a 14dp cell would be a 1.57-cell reach.
    expect(HIT_RADIUS_DP / fineCell).toBeGreaterThan(1);
    expect(MAX_HIT_RADIUS_CELLS).toBeLessThan(1);

    // A touch 0.9 cells away — nearer to a neighbouring row than to arrow a — misses.
    expect(engine.hitTest(1.5, 1.5 + 0.9, fineCell, 1)).toBe(-1);
    // A touch well inside the same cell still lands.
    expect(engine.hitTest(1.5, 1.5 + 0.3, fineCell, 1)).toBe(0);
  });

  it('maps a screen tap back to the same board point it was taken from', () => {
    const viewportWidth = 360;
    const viewportHeight = 500;
    const boardSize = 320;
    const cellSize = 32;

    for (const scale of [1, 1.8, 3.5]) {
      for (const [tx, ty] of [
        [0, 0],
        [40, -25],
      ]) {
        const boardX = 3.25;
        const boardY = 5.5;
        // Forward: board cell -> screen, the transform the container view applies.
        const screenX =
          viewportWidth / 2 + tx + (boardX * cellSize - boardSize / 2) * scale;
        const screenY =
          viewportHeight / 2 + ty + (boardY * cellSize - boardSize / 2) * scale;

        const back = screenToBoard(
          screenX,
          screenY,
          viewportWidth,
          viewportHeight,
          boardSize,
          cellSize,
          scale,
          tx,
          ty,
        );
        expect(back.x).toBeCloseTo(boardX, 6);
        expect(back.y).toBeCloseTo(boardY, 6);
      }
    }
  });
});

describe('board layout (§5.4, §5.5)', () => {
  it('floors the cell size so the dot grid lands on whole dp at scale 1', () => {
    const metrics = computeBoardMetrics(360, 600, 14);
    expect(Number.isInteger(metrics.cellSize)).toBe(true);
    expect(metrics.size).toBe(metrics.cellSize * 14);
    expect(metrics.size).toBeLessThanOrEqual(360 - 32);
  });

  it('fits to the narrower of width-32 and the available height', () => {
    // A tall, narrow screen is width-bound; a short, wide one is height-bound.
    expect(computeBoardMetrics(360, 900, 10).size).toBeLessThanOrEqual(328);
    expect(computeBoardMetrics(900, 300, 10).size).toBeLessThanOrEqual(300);
  });

  it('allows no pan at all at fit scale, because the whole board is visible', () => {
    expect(clampPan(200, 320, 360, 1)).toBeCloseTo(0, 10);
    expect(clampPan(-200, 320, 360, 1)).toBeCloseTo(0, 10);
  });

  it('clamps pan so a board edge never travels inside the viewport', () => {
    const boardSize = 320;
    const viewport = 360;
    const scale = 2;
    // Scaled board is 640 wide in a 360 viewport: 140 of slack on each side.
    expect(clampPan(1000, boardSize, viewport, scale)).toBe(140);
    expect(clampPan(-1000, boardSize, viewport, scale)).toBe(-140);
    expect(clampPan(50, boardSize, viewport, scale)).toBe(50);
  });

  it('permits rubber-band overshoot only when one is asked for', () => {
    expect(clampPan(1000, 320, 360, 2, 40)).toBe(180);
    expect(clampPan(1000, 320, 360, 2)).toBe(140);
  });
});
