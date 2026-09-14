/**
 * How fast arrows move. This is the file to edit to retune arrow speed — nothing
 * else needs touching, and every number here is live at the next reload.
 *
 * The exit flight is expressed as a *duration window* rather than a speed in dp/ms,
 * because that is what the motion actually is: a short hop off the edge and a run
 * across a 22x22 board take different times, but not proportionally different ones.
 * A pure speed would make the long path crawl for well over a second; a single fixed
 * duration would make the long one look like a teleport. So travel picks a point
 * between `minDurationMs` and `maxDurationMs`, and `speedMultiplier` scales the whole
 * window at once.
 *
 * Shape of the flight — the easing curve, the rope stretch, the geometry — is not
 * here. That is `EscapingArrow` and `arrowGeometry`, and it is design rather than
 * tuning.
 */
export const ARROW_MOTION = {
  /**
   * The exit flight, §9.2.
   *
   * Defaults reproduce the original hard-coded 400-700ms window exactly, so changing
   * nothing here changes nothing on screen.
   */
  escape: {
    /** Shortest flight: an arrow one hop from the edge. Lower = faster. */
    minDurationMs: 400,
    /** Longest flight: an arrow crossing the full board. Lower = faster. */
    maxDurationMs: 700,
    /**
     * Scales both ends at once. 1 leaves the window as written; 2 halves every
     * duration (arrows twice as fast); 0.5 doubles them (half speed).
     *
     * This is the single dial to reach for first — it keeps the relationship between
     * short and long flights intact, which the two bounds above do not if you move
     * only one of them.
     */
    speedMultiplier: 1,
  },

  /** The blocked-tap bump, §9.3 — the arrow that cannot move shakes in place. */
  blockedShake: {
    /** Whole shake, start to rest. Lower = a quicker, sharper bump. */
    durationMs: 180,
    /** How far it travels each way, in dp. */
    amplitudeDp: 4,
  },
} as const;

/**
 * §9.2 — how long this arrow's exit flight should take.
 *
 * `travel` is the distance it has to cover before it is out of sight and `boardSize`
 * the board's own extent, so their ratio is "how much of the board does this crossing
 * span" — clamped, because an arrow's clearance can carry it past the far edge.
 */
export function escapeDurationMs(travel: number, boardSize: number): number {
  const {minDurationMs, maxDurationMs, speedMultiplier} = ARROW_MOTION.escape;
  const t = Math.min(1, travel / Math.max(1, boardSize));
  const span = minDurationMs + t * (maxDurationMs - minDurationMs);
  // Guarded so a zero or negative multiplier left in the config cannot divide the
  // duration to zero or below and freeze an arrow mid-flight.
  return Math.round(span / Math.max(0.01, speedMultiplier));
}
