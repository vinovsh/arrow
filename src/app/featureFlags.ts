/**
 * Behaviour switches called out by name in the spec. Kept in one place so a
 * playtest tweak never means hunting through screens.
 */
export const FEATURES = {
  /** §3.2 — hearts are disabled entirely below this level. */
  livesFromLevel: 26,
  /** §6 — scripted coach marks run to level 10, plus the zoom and hearts marks. */
  tutorialLastScriptedLevel: 10,
  zoomCoachMarkLevel: 11,
  heartsCoachMarkLevel: 26,
  /** §16 — no ad SDK ships in v1; the rewarded life is granted immediately. */
  adsEnabled: false,
  /** §8.7 — 7 taps on the version string, and only in a debug build. */
  devMenuTapCount: 7,
  totalLevels: 500,
  levelsPerPack: 25,
} as const;

/** §13 — rendering is tiered by arrow count; a 90-arrow board cannot afford 3 layers. */
export interface RenderTier {
  layersPerArrow: 2 | 3;
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
  glowOpacityScale: number;
  /**
   * Above 60 arrows the per-arrow glow and casing collapse into a single underlay
   * <G>, and what gets baked there is the *casing*, not the glow: on a board that
   * dense, telling two neighbouring paths apart is worth far more than a bloom, and
   * eighty haloes is a haze over the picture rather than an effect.
   */
  bakedUnderlay: boolean;
}

export function renderTierFor(arrowCount: number): RenderTier {
  if (arrowCount <= 40) {
    return {
      layersPerArrow: 3,
      idleBreathing: false,
      glowOpacityScale: 1,
      bakedUnderlay: false,
    };
  }
  if (arrowCount <= 60) {
    return {
      layersPerArrow: 2,
      idleBreathing: false,
      glowOpacityScale: 0.6,
      bakedUnderlay: false,
    };
  }
  return {
    layersPerArrow: 2,
    idleBreathing: false,
    glowOpacityScale: 0.6,
    bakedUnderlay: true,
  };
}

/**
 * The tier an arrow should be drawn at once it has left the board's static layer.
 *
 * The baked underlay only covers arrows that are still resting and active, so the
 * moment one starts escaping or shaking it loses the casing every other arrow still
 * has — a visible pop at exactly the moment the player is watching that arrow. A
 * moving arrow is one path, not eighty, so it can simply carry its own.
 *
 * The tier is returned unchanged when it already draws per-arrow, so `ArrowShape`'s
 * memo still sees a stable reference.
 */
export function withOwnUnderlay(tier: RenderTier): RenderTier {
  return tier.bakedUnderlay ? {...tier, bakedUnderlay: false} : tier;
}
