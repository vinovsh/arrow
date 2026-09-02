import {FEATURES} from '../app/featureFlags';

/**
 * §16 — monetisation architecture, deferred. **Nothing ships in v1.**
 *
 * This exists so that adding an ad SDK later is a binding change rather than a
 * redesign: the seams are named, the placement rules are encoded here rather than
 * scattered across screens, and `NoopAdService` is the only binding.
 *
 * The rules are not advisory. Ads may never appear during gameplay, during an arrow
 * animation, or during the completion sequence, and no screen anywhere reserves
 * permanent space for one (§16, §21).
 */

export type RewardKind = 'extra-life' | 'extra-hint';

export interface AdService {
  /**
   * Interstitial between levels. Never more often than every five levels and never on
   * levels 1-15 — the window where a player is still deciding whether this game is
   * worth their time.
   */
  maybeShowInterstitial(levelJustFinished: number): Promise<void>;
  /** Rewarded video. Resolves true when the reward should be granted. */
  showRewarded(kind: RewardKind): Promise<boolean>;
  readonly enabled: boolean;
}

export const INTERSTITIAL_MIN_GAP = 5;
export const INTERSTITIAL_FROM_LEVEL = 16;

/** Pure predicate, so the placement rules stay testable without an SDK present. */
export function interstitialAllowed(
  levelJustFinished: number,
  levelsSinceLastAd: number,
): boolean {
  if (levelJustFinished < INTERSTITIAL_FROM_LEVEL) {
    return false;
  }
  return levelsSinceLastAd >= INTERSTITIAL_MIN_GAP;
}

/**
 * The only binding in v1. Rewards are granted immediately and no ad is ever shown, so
 * `WATCH VIDEO +1 LIFE` reads `CONTINUE +1 LIFE` and costs the player nothing (§3.2).
 */
class NoopAdService implements AdService {
  readonly enabled = FEATURES.adsEnabled;

  async maybeShowInterstitial(): Promise<void> {
    // No SDK, no ad, no delay between levels.
  }

  async showRewarded(): Promise<boolean> {
    return true;
  }
}

export const Ads: AdService = new NoopAdService();
