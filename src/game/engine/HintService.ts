import {CollisionDetector} from './CollisionDetector';

export const HINTS_PER_LEVEL = 3;
export const HINT_COOLDOWN_MS = 8000;
/** Boards this size or larger auto-pan and zoom to the target first (§3.4). */
export const HINT_AUTOFOCUS_ARROWS = 40;
export const HINT_FOCUS_SCALE = 1.8;

/**
 * §3.4 — three free hints per level, refilled on every entry. A hint highlights the
 * next arrow; it never auto-plays. Monotonicity (§2.3) guarantees any free arrow is a
 * safe move, so the hint can be recomputed from the live state rather than replayed
 * from a stored solution.
 */
export class HintService {
  private remainingInternal = HINTS_PER_LEVEL;
  private lastUsedAt = 0;

  get remaining(): number {
    return this.remainingInternal;
  }

  reset(): void {
    this.remainingInternal = HINTS_PER_LEVEL;
    this.lastUsedAt = 0;
  }

  cooldownRemainingMs(now = Date.now()): number {
    return Math.max(0, HINT_COOLDOWN_MS - (now - this.lastUsedAt));
  }

  canUse(now = Date.now()): boolean {
    return this.remainingInternal > 0 && this.cooldownRemainingMs(now) === 0;
  }

  /**
   * Index of the arrow to highlight, or -1 if the board is already clear.
   * Prefers the free arrow that unblocks the most others, so a hint on a dense board
   * opens the game up rather than nibbling at an edge.
   */
  suggest(detector: CollisionDetector): number {
    const free = detector.freeIndices();
    if (free.length === 0) {
      return -1;
    }
    const active = detector.activeIndices();
    let best = free[0];
    let bestScore = -1;
    for (const index of free) {
      let unblocks = 0;
      for (const other of active) {
        if (other !== index && detector.firstBlocker(other) === index) {
          unblocks++;
        }
      }
      if (unblocks > bestScore) {
        bestScore = unblocks;
        best = index;
      }
    }
    return best;
  }

  /** Consumes a hint. Returns false when out of hints or still cooling down. */
  consume(now = Date.now()): boolean {
    if (!this.canUse(now)) {
      return false;
    }
    this.remainingInternal--;
    this.lastUsedAt = now;
    return true;
  }
}
