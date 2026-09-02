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
  /** §5.8 — Score Summary is shown selectively so it never taxes fast play. */
  scoreSummaryOnMilestones: true,
  milestoneEvery: 25,
  showcaseEvery: 10,
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
  idleBreathing: boolean;
  particlesMin: number;
  particlesMax: number;
  glowOpacityScale: number;
  /** Above 60 arrows the static glow is baked into a single underlay <G>. */
  bakedGlowUnderlay: boolean;
}

export function renderTierFor(arrowCount: number): RenderTier {
  if (arrowCount <= 40) {
    return {
      layersPerArrow: 3,
      idleBreathing: true,
      particlesMin: 12,
      particlesMax: 18,
      glowOpacityScale: 1,
      bakedGlowUnderlay: false,
    };
  }
  if (arrowCount <= 60) {
    return {
      layersPerArrow: 2,
      idleBreathing: false,
      particlesMin: 8,
      particlesMax: 12,
      glowOpacityScale: 0.6,
      bakedGlowUnderlay: false,
    };
  }
  return {
    layersPerArrow: 2,
    idleBreathing: false,
    particlesMin: 6,
    particlesMax: 10,
    glowOpacityScale: 0.6,
    bakedGlowUnderlay: true,
  };
}
