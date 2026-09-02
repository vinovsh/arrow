import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {SaveStore} from '../storage/SaveStore';

/**
 * §14 — haptics. The vibration toggle is checked *at the call site*, not only at
 * init, so switching it off in Settings silences the very next tap rather than the
 * next launch.
 */
export type HapticKind = 'selection' | 'impactLight' | 'impactMedium';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

class HapticServiceImpl {
  trigger(kind: HapticKind): void {
    if (!SaveStore.data.vibrationEnabled) {
      return;
    }
    try {
      ReactNativeHapticFeedback.trigger(kind, OPTIONS);
    } catch {
      // A device without a vibrator is not an error worth surfacing.
    }
  }

  selection(): void {
    this.trigger('selection');
  }

  light(): void {
    this.trigger('impactLight');
  }

  medium(): void {
    this.trigger('impactMedium');
  }
}

export const Haptics = new HapticServiceImpl();
