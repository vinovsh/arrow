/**
 * Behaviour switches called out by name in the spec. Kept in one place so a
 * playtest tweak never means hunting through screens.
 */
export const FEATURES = {
  /** Each blocked arrow costs one heart, starting with the first level. */
  livesFromLevel: 1,
  /** §6 — scripted coach marks run to level 10, plus the zoom and hearts marks. */
  tutorialLastScriptedLevel: 10,
  zoomCoachMarkLevel: 11,
  heartsCoachMarkLevel: 26,
  /** Google rewarded ads are offered only from the out-of-lives popup. */
  adsEnabled: true,
  /** §8.7 — 7 taps on the version string, and only in a debug build. */
  devMenuTapCount: 7,
  totalLevels: 20,
  levelsPerPack: 25,
} as const;

/**
 * §13 — what the board is allowed to spend per arrow, by arrow count.
 *
 * There used to be a lot more here: a layer count, a glow scale, and a flag that
 * collapsed every arrow's casing into one baked underlay above 60 arrows. All three
 * described a five-layer arrow, and §10.2 now draws two — a stroke and a filled
 * triangle, one ink, nothing underneath — so an 116-arrow board costs less than a
 * 40-arrow one used to. There is nothing left to tier.
 *
 * `idleBreathing` survives because it is the one thing here that still has teeth, and
 * the comment on it is the reason it is off everywhere.
 */
export interface RenderTier {
  /**
   * §9.1 — the idle shimmer, and currently off on every board.
   *
   * It was on below 40 arrows and off above, which made the *sparse* boards the slow
   * ones: level 39 (24 arrows) answered a tap noticeably later than level 500 (80),
   * because 24 arrows breathing means 24 Reanimated animations writing an `opacity`
   * prop into the board's single <Svg> every frame, for as long as the level is open.
   * Each write invalidates that surface, so the board was being re-rasterised
   * continuously and a tap's commit had to wait for a gap that never came. Level 500
   * has the shimmer off, is three times the arrows, and was the responsive one.
   */
  idleBreathing: boolean;
}

const STILL: RenderTier = {idleBreathing: false};

export function renderTierFor(_arrowCount: number): RenderTier {
  // One object for every board, so `ArrowRenderer`'s memo sees a stable reference
  // and a level with more arrows does not re-render the ones it shares.
  return STILL;
}
