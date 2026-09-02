import type {ArrowPath} from '../models/types';
import {distanceToSegmentSquared} from '../../utils/math';

interface Segment {
  arrowIndex: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Touch slop in dp, before the current zoom scale is applied (§4.4). */
export const HIT_RADIUS_DP = 22;

/**
 * Proximity hit-testing (§4.4). Cell sizes at fit scale are all below the 44dp
 * touch-target guideline, so the nearest arrow within a radius wins rather than
 * requiring a direct hit. Arrows never overlap, so the answer is unambiguous.
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
