import {NativeModules, Platform} from 'react-native';
import {FEATURES} from '../app/featureFlags';

export type RewardKind = 'extra-life' | 'extra-hint';
export interface AdService {
  maybeShowInterstitial(levelJustFinished: number): Promise<void>;
  showRewarded(kind: RewardKind): Promise<boolean>;
  showPrivacyOptions(): Promise<void>;
  readonly enabled: boolean;
}
interface RewardedBridge {
  showRewarded(): Promise<boolean>;
  showPrivacyOptions(): Promise<void>;
}
const bridge = (): RewardedBridge | undefined => NativeModules.RewardedAds;
export const INTERSTITIAL_MIN_GAP = 5;
export const INTERSTITIAL_FROM_LEVEL = 16;
export function interstitialAllowed(
  levelJustFinished: number,
  levelsSinceLastAd: number,
): boolean {
  return (
    levelJustFinished >= INTERSTITIAL_FROM_LEVEL &&
    levelsSinceLastAd >= INTERSTITIAL_MIN_GAP
  );
}

class GoogleAdService implements AdService {
  get enabled(): boolean {
    return FEATURES.adsEnabled && Platform.OS === 'android' && !!bridge();
  }
  async maybeShowInterstitial(): Promise<void> {
    // Only opt-in rewarded ads are enabled. Level transitions stay uninterrupted.
  }
  async showRewarded(kind: RewardKind): Promise<boolean> {
    if (!this.enabled || kind !== 'extra-life') {
      throw new Error(
        'Rewarded ads are unavailable. Please restart the level.',
      );
    }
    // Only Google's earned-reward callback can produce true; closing early returns false.
    return (await bridge()!.showRewarded()) === true;
  }
  async showPrivacyOptions(): Promise<void> {
    if (!this.enabled) {
      throw new Error('Ad privacy choices are unavailable on this build.');
    }
    await bridge()!.showPrivacyOptions();
  }
}
export const Ads: AdService = new GoogleAdService();
