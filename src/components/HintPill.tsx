import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Haptics} from '../haptics/HapticService';

interface Props {
  remaining: number;
  onPress: () => void;
  disabled?: boolean;
  /** §3.3 / §6 — pulses once when the player is stuck, and on level 7's coach mark. */
  pulsing?: boolean;
}

/** §3.4 — three free hints per level, refilled on entry. The badge is the counter. */
export function HintPill({
  remaining,
  onPress,
  disabled = false,
  pulsing = false,
}: Props): React.JSX.Element {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulsing) {
      scale.value = withTiming(1, {duration: 150});
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, {duration: 420, easing: Easing.inOut(Easing.sin)}),
        withTiming(1, {duration: 420, easing: Easing.inOut(Easing.sin)}),
      ),
      3,
      false,
    );
  }, [pulsing, scale]);

  const style = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}));

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Use hint, ${remaining} left`}
        disabled={disabled || remaining === 0}
        onPress={() => {
          Haptics.selection();
          onPress();
        }}>
        <LinearGradient
          colors={[...theme.button.hint]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={[
            styles.pill,
            (disabled || remaining === 0) && styles.disabled,
          ]}>
          <Text style={styles.icon}>💡</Text>
          <Text style={styles.label}>HINT</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{remaining}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 48,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  disabled: {opacity: 0.4},
  icon: {fontSize: 16},
  label: {...typography.ui(15), color: '#2A1B00', letterSpacing: 1},
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: theme.state.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {...typography.ui(13), color: '#04240F'},
});
