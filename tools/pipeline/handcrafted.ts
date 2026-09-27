/**
 * Boards that are drawn rather than generated.
 *
 * Level 1 is the only one, and it is drawn for a reason: it is the first board a
 * player ever sees, and the reference treats it as a diagram rather than as a puzzle
 * — three long vertical arrows, two up and one down, an empty column between each
 * pair, sitting small in the middle of an otherwise blank page. None of that is
 * reachable from the generator's knobs. `fitMask` + `decompose` will happily draw
 * three paths on a small grid, but not *those* three, and a tutorial board that
 * changes shape whenever the carver is retuned is a tutorial board whose coach mark
 * has to be re-aimed every time it is.
 *
 * The geometry is measured off `ref/Arrow/Screenshot_20260914_210909.jpg`, at that
 * board's 63px dot pitch: the three columns sit two cells apart and centred on the
 * page (so the grid is 7 wide, with the arrows on columns 1, 3 and 5), and the middle
 * column shows exactly six dots once its arrow has left — see 210919.jpg — which is
 * both the path length and the row span.
 */
import type {ArrowColor, ArrowPath, Direction, Level} from '../../src/game/models/types.ts';
import {validate} from '../../src/game/engine/LevelValidator.ts';
import {distributionError} from './decompose.ts';
import type {LevelSlot} from './plan.ts';
import type {GenerationReport} from './generate.ts';

interface HandcraftedArrow {
  color: ArrowColor;
  /** Cells as "x,y x,y ...", tail first, exactly as the pack format writes them. */
  cells: string;
  direction: Direction;
}

export interface HandcraftedBoard {
  gridSize: number;
  theme: string;
  arrows: readonly HandcraftedArrow[];
}

export const HANDCRAFTED_BOARDS: Readonly<Record<number, HandcraftedBoard>> = {
  1: {
    gridSize: 7,
    theme: 'block',
    // The centre column is listed first on purpose: level 1's coach mark points at
    // the first free arrow (§6, `pick: 'first-free'`), and the reference points at
    // the middle of the three.
    arrows: [
      {color: 'blue', cells: '3,5 3,4 3,3 3,2 3,1 3,0', direction: 'U'},
      {color: 'yellow', cells: '1,5 1,4 1,3 1,2 1,1 1,0', direction: 'U'},
      {color: 'orange', cells: '5,0 5,1 5,2 5,3 5,4 5,5', direction: 'D'},
    ],
  },
  /**
   * Level 2 is the generated board with its left-hand corner re-carved.
   *
   * The carver left a single-cell path at (0,2) — a lone arrowhead sitting in a cell
   * with no body behind it, which is the one thing on the second board a player ever
   * sees that does not read as an arrow. It could not be lengthened where it stood:
   * the 12-cell arrow wrapped it on three sides and the board edge closed the fourth,
   * so the only cell a tail could have come from belonged to its neighbour.
   *
   * The neighbour therefore gives up the left column. It used to run down column 0 and
   * back up column 1 around the stub; now it starts at (1,1) and keeps the rest of its
   * route unchanged, and the stub becomes the whole left column below the arrow
   * already in the corner — five cells, pointing down and off the bottom edge.
   *
   * Down, and not left as it was, because a left-pointing head at (0,2) can only be
   * fed from (1,2), which is mid-path for the neighbour: feeding it would cut that
   * arrow in two. Every head on this board leaves the board directly, which is what
   * §6's "Any order works" caption needs — all five arrows start free.
   *
   * The other three arrows are exactly what `generateLevel` produced for this slot,
   * which is why this entry looks generated rather than drawn. Pinning the whole board
   * is what stops a regeneration putting the stub back.
   */
  2: {
    gridSize: 6,
    theme: 'block',
    arrows: [
      // Was: '0,1 1,1 1,2 1,3 0,3 0,4 0,5 1,5 2,5 2,4 3,4 4,4'.
      {color: 'blue', cells: '1,1 1,2 1,3 1,4 1,5 2,5 2,4 3,4 4,4', direction: 'R'},
      {color: 'yellow', cells: '3,5 4,5', direction: 'R'},
      // Was: '0,2', a single cell pointing left.
      {color: 'green', cells: '0,1 0,2 0,3 0,4 0,5', direction: 'D'},
      {color: 'cyan', cells: '3,3 4,3 4,2 4,1 4,0', direction: 'U'},
      {color: 'white', cells: '2,2 3,2 3,1 3,0 2,0 1,0 0,0', direction: 'L'},
    ],
  },
};

const parseCells = (cells: string): {x: number; y: number}[] =>
  cells.split(' ').map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return {x, y};
  });

export function handcraftedArrows(board: HandcraftedBoard): ArrowPath[] {
  return board.arrows.map((arrow, i) => ({
    id: `a${i}`,
    color: arrow.color,
    cells: parseCells(arrow.cells),
    direction: arrow.direction,
  }));
}

/** Observed path-length distribution, in the same buckets `decompose` reports. */
function distributionOf(arrows: readonly ArrowPath[]): number[] {
  const buckets = new Array(16).fill(0);
  for (const arrow of arrows) {
    buckets[arrow.cells.length - 1]++;
  }
  return buckets.map(b => b / arrows.length);
}

/**
 * The drawn board for this slot, packaged as a generation report so the pipeline,
 * the CI gate and the contact sheet all see it the way they see a generated one.
 */
export function handcraftedLevel(slot: LevelSlot): GenerationReport | null {
  const board = HANDCRAFTED_BOARDS[slot.id];
  if (!board) {
    return null;
  }
  const arrows = handcraftedArrows(board);
  const validation = validate({gridSize: board.gridSize, arrows});
  const level: Level = {
    id: slot.id,
    gridSize: board.gridSize,
    theme: board.theme,
    band: slot.band,
    difficulty: validation.difficulty,
    parTime: validation.parTime,
    arrows,
  };
  const distribution = distributionOf(arrows);
  return {
    level,
    validation,
    shape: board.theme,
    seed: 0,
    attempts: 1,
    maskCells: arrows.reduce((sum, a) => sum + a.cells.length, 0),
    distribution,
    distributionError: distributionError(distribution, slot.mix),
    colourMaxShare: 1 / arrows.length,
    featurePaths: 0,
  };
}
