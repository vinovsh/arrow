import {NativeModules} from 'react-native';
import {Ads} from '../src/ads/AdService';

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
  NativeModules: {
    RewardedAds: {showRewarded: jest.fn(), showPrivacyOptions: jest.fn()},
  },
}));
const rewarded = NativeModules.RewardedAds.showRewarded as jest.Mock;

describe('Google rewarded life ads', () => {
  beforeEach(() => {
    rewarded.mockReset();
  });
  it('grants a heart only when the native earned-reward result is true', async () => {
    rewarded.mockResolvedValue(true);
    await expect(Ads.showRewarded('extra-life')).resolves.toBe(true);
  });
  it('does not grant a heart when the ad closes without earning the reward', async () => {
    rewarded.mockResolvedValue(false);
    await expect(Ads.showRewarded('extra-life')).resolves.toBe(false);
  });
  it('does not turn an invalid native result into a free reward', async () => {
    rewarded.mockResolvedValue('true');
    await expect(Ads.showRewarded('extra-life')).resolves.toBe(false);
  });
  it('reports ad failures instead of granting a fallback life', async () => {
    rewarded.mockRejectedValue(new Error('No ad available'));
    await expect(Ads.showRewarded('extra-life')).rejects.toThrow(
      'No ad available',
    );
  });
  it('does not use the rewarded-life placement for extra hints', async () => {
    await expect(Ads.showRewarded('extra-hint')).rejects.toThrow('unavailable');
    expect(rewarded).not.toHaveBeenCalled();
  });
});
