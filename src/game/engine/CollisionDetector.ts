import type {ArrowPath, GridPoint} from '../models/types';
import {DIR_VECTORS, cellIndex} from '../models/types';

/**
 * Occupancy + corridor logic (§2.1, §2.2). Index-based and allocation-free on the
 * hot path: freedom is recomputed after every escape, O(n x gridSize) (§13).
 *
 * An arrow can never block itself — the whole path slides at once, so cells of its
 * own body that sit ahead of the head move out of the way at the same speed.
 */
export class CollisionDetector {
  readonly gridSize: number;
  readonly arrows: readonly ArrowPath[];
  /** gridSize^2 entries; 0 = empty, otherwise arrowIndex + 1. */
  readonly occupancy: Uint8Array;
  private readonly activeFlags: Uint8Array;
  private activeCountInternal: number;

  constructor(gridSize: number, arrows: readonly ArrowPath[]) {
    if (arrows.length > 254) {
      throw new Error(
        `CollisionDetector supports at most 254 arrows, got ${arrows.length}`,
      );
    }
    this.gridSize = gridSize;
    this.arrows = arrows;
    this.occupancy = new Uint8Array(gridSize * gridSize);
    this.activeFlags = new Uint8Array(arrows.length);
    this.activeCountInternal = 0;
    this.reset();
  }

  reset(): void {
    this.occupancy.fill(0);
    this.activeFlags.fill(1);
    this.activeCountInternal = this.arrows.length;
    for (let i = 0; i < this.arrows.length; i++) {
      for (const cell of this.arrows[i].cells) {
        this.occupancy[cellIndex(cell, this.gridSize)] = i + 1;
      }
    }
  }

  get activeCount(): number {
    return this.activeCountInternal;
  }

  isActive(index: number): boolean {
    return this.activeFlags[index] === 1;
  }

  /** Clears the arrow's cells from occupancy. Idempotent. */
  remove(index: number): void {
    if (this.activeFlags[index] === 0) {
      return;
    }
    this.activeFlags[index] = 0;
    this.activeCountInternal--;
    for (const cell of this.arrows[index].cells) {
      const at = cellIndex(cell, this.gridSize);
      if (this.occupancy[at] === index + 1) {
        this.occupancy[at] = 0;
      }
    }
  }

  /**
   * First active arrow standing in this arrow's corridor, or -1 when free.
   * The corridor runs from the head cell outward along `direction` to the edge.
   */
  firstBlocker(index: number): number {
    const arrow = this.arrows[index];
    const head = arrow.cells[arrow.cells.length - 1];
    const step = DIR_VECTORS[arrow.direction];
    let x = head.x + step.x;
    let y = head.y + step.y;
    while (x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize) {
      const occupant = this.occupancy[y * this.gridSize + x];
      if (occupant !== 0 && occupant - 1 !== index) {
        return occupant - 1;
      }
      x += step.x;
      y += step.y;
    }
    return -1;
  }

  isFree(index: number): boolean {
    return this.activeFlags[index] === 1 && this.firstBlocker(index) === -1;
  }

  /**
   * First blocker for every arrow in one pass: -1 free, -2 already escaped.
   *
   * The validator needs both the free set and "how many arrows does removing this one
   * unblock" at every state. Asking firstBlocker() per candidate makes that O(n^2 x
   * gridSize) per state and O(n^3 x gridSize) per solve, which at n = 90 is tens of
   * millions of steps and dominates the generator. One shared map per state brings the
   * whole solve back to O(n^2 x gridSize).
   */
  blockerMap(out?: Int32Array): Int32Array {
    const result = out ?? new Int32Array(this.arrows.length);
    for (let i = 0; i < this.arrows.length; i++) {
      result[i] = this.activeFlags[i] === 1 ? this.firstBlocker(i) : -2;
    }
    return result;
  }

  freeIndices(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.arrows.length; i++) {
      if (this.activeFlags[i] === 1 && this.firstBlocker(i) === -1) {
        result.push(i);
      }
    }
    return result;
  }

  activeIndices(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.arrows.length; i++) {
      if (this.activeFlags[i] === 1) {
        result.push(i);
      }
    }
    return result;
  }

  /** Cells the corridor covers, for the off-screen blocker chevron (§9.3). */
  corridorCells(index: number): GridPoint[] {
    const arrow = this.arrows[index];
    const head = arrow.cells[arrow.cells.length - 1];
    const step = DIR_VECTORS[arrow.direction];
    const cells: GridPoint[] = [];
    let x = head.x + step.x;
    let y = head.y + step.y;
    while (x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize) {
      cells.push({x, y});
      x += step.x;
      y += step.y;
    }
    return cells;
  }

  /** Cells the head must travel to leave the board — drives escape duration (§9.2). */
  exitDistance(index: number): number {
    const arrow = this.arrows[index];
    const head = arrow.cells[arrow.cells.length - 1];
    switch (arrow.direction) {
      case 'U':
        return head.y + 1;
      case 'D':
        return this.gridSize - head.y;
      case 'L':
        return head.x + 1;
      case 'R':
        return this.gridSize - head.x;
    }
  }
}
