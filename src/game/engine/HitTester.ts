import type {ArrowPath} from '../models/types';
import {distanceToSegmentSquared} from '../../utils/math';

interface Segment {
  arrowIndex: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/**
 * Touch slop in dp, before the current zoom scale is applied (§4.4) — a 44dp target
 * around a line drawn at 3-7dp.
 *
 * This is deliberately unrelated to how the arrow is drawn, and that is what lets the
 * arrow be thin at all: the visual weight came down by roughly four times in §10.2 and
 * nothing here moved, because the player was never tapping the stroke. They tap near
 * it, and the nearest arrow answers.
 */
export const HIT_RADIUS_DP = 22;

/**
 * Ceiling on that radius in *cell units*, which is what actually binds on a fine grid.
 *
 * Parallel paths sit exactly one cell apart, so a radius approaching a full cell puts
 * the touch point within reach of a path the player was not aiming at. On a 22x22
 * board a cell is about 14dp and the 22dp slop above spans one and a half of them —
 * generous slop stops being forgiving and starts being wrong.
 *
 * Capping below the pitch means an ambiguous tap resolves to nothing rather than to
 * the neighbour, which on this game is the safer failure: a wrong arrow leaving is a
 * board state the player cannot undo, while a tap that does nothing costs a moment.
 * Zoom is the intended answer on the big boards (§5.5), and the radius scales with it.
 */
export const MAX_HIT_RADIUS_CELLS = 0.7;

/**
 * Proximity hit-testing (§4.4). Cell sizes at fit scale are all below the 44dp
 * touch-target guideline, and the drawn line is far below it, so the nearest arrow
 * within a radius wins rather than requiring a direct hit. Arrows never overlap, so
 * the answer is unambiguous.
 *
 * Everything is computed in *board space* (1 unit = 1 cell). Zooming in shrinks the
 * effective radius, which tightens precision exactly as a player expects.
 */
export class HitTester {
  private readonly segments: Segment[] = [];

  constructor(arrows: readonly ArrowPath[]) {
    for (let i = 0; i < arrows.length; i++) {
      const cells = arrows[i].cells;
      if (cells.length === 1) {
        // Degenerate segment: a single-cell arrow is still a tappable point.
        const c = cells[0];
        this.segments.push({
          arrowIndex: i,
          ax: c.x + 0.5,
          ay: c.y + 0.5,
          bx: c.x + 0.5,
          by: c.y + 0.5,
        });
        continue;
      }
      for (let k = 1; k < cells.length; k++) {
        this.segments.push({
          arrowIndex: i,
          ax: cells[k - 1].x + 0.5,
          ay: cells[k - 1].y + 0.5,
          bx: cells[k].x + 0.5,
          by: cells[k].y + 0.5,
        });
      }
    }
  }

  /**
   * @param bx,@param by touch point in board space (cell units)
   * @param radiusCells search radius in cell units — HIT_RADIUS_DP / cellSize / scale
   * @param isActive predicate so escaped arrows are never selected
   * @returns arrow index, or -1
   */
  hitTest(
    bx: number,
    by: number,
    radiusCells: number,
    isActive: (index: number) => boolean,
  ): number {
    let best = -1;
    let bestDistance = radiusCells * radiusCells;
    for (const s of this.segments) {
      if (!isActive(s.arrowIndex)) {
        continue;
      }
      const d = distanceToSegmentSquared(bx, by, s.ax, s.ay, s.bx, s.by);
      if (d < bestDistance) {
        bestDistance = d;
        best = s.arrowIndex;
      }
    }
    return best;
  }
}
