import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';

export type ButtonVariant =
  | 'play'
  | 'levels'
  | 'settings'
  | 'primary'
  | 'hint'
  | 'neutral';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  disabled?: boolean;
  /** §10.2 — only primary CTAs glow. Headers and list rows never do. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/** §10.2 — 56dp, radius.lg, gradient fill, left icon, 0.96 press over 90ms. */
export const BUTTON_HEIGHT = 56;
const PRESS_MS = 90;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  glow = true,
  style,
  compact = false,
}: Props): React.JSX.Element {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{scale: 1 - pressed.value * 0.04}],
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, {duration: PRESS_MS});
    Haptics.selection();
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, {duration: PRESS_MS});
  }, [pressed]);

  const handlePress = useCallback(() => {
    Audio.play('ui_tap');
    onPress();
  }, [onPress]);

  const gradient =
    variant === 'neutral'
      ? ([theme.button.neutral, theme.button.neutral] as const)
      : theme.button[variant];

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{disabled}}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}>
        <LinearGradient
          colors={[...gradient]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={[
            styles.surface,
            compact && styles.compact,
            glow && variant !== 'neutral' && styles.glow,
            disabled && styles.disabled,
          ]}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {/* A gradient alone is a colour signal; the icon and the pressed scale make
              the control legible without relying on colour (§10.2). */}
          <View style={styles.spacer} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: BUTTON_HEIGHT,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  compact: {height: 44, borderRadius: theme.radius.md},
  glow: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: theme.glow.medium,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  disabled: {opacity: 0.45},
  icon: {...typography.ui(18), marginRight: theme.space.sm},
  label: {...typography.ui(17), letterSpacing: 0.6},
  spacer: {width: 0},
});
