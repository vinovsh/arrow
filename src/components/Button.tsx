import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';

export type ButtonVariant =
  | 'play'
  | 'reward'
  | 'levels'
  | 'settings'
  | 'primary'
  | 'hint'
  | 'neutral';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
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
  trailingIcon,
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
    Audio.playClick();
    onPress();
  }, [onPress]);

  const gradient =
    variant === 'neutral'
      ? ([theme.button.neutral, theme.button.neutral] as const)
      : theme.button[variant];
  const filled = ['play', 'reward', 'primary', 'hint'].includes(variant);

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
          {filled && <View pointerEvents="none" style={styles.sheen} />}
          {typeof icon === 'string' ? (
            <Text style={[styles.icon, filled && styles.playText]}>{icon}</Text>
          ) : icon ? (
            <View style={styles.vectorIcon}>{icon}</View>
          ) : null}
          <Text
            style={[
              styles.label,
              filled && styles.playText,
              compact && styles.compactLabel,
            ]}
            numberOfLines={1}>
            {label}
          </Text>
          {/* A gradient alone is a colour signal; the icon and the pressed scale make
              the control legible without relying on colour (§10.2). */}
          {trailingIcon && (
            <View style={styles.trailingIcon}>{trailingIcon}</View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: BUTTON_HEIGHT,
    borderWidth: 1,
    borderColor: theme.bg.border,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  sheen: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    opacity: 0.12,
  },
  compact: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
  },
  compactLabel: {fontSize: 14},
  glow: {
    shadowColor: theme.brand.tagline,
    shadowOpacity: 0.18,
    shadowRadius: theme.glow.medium,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  disabled: {opacity: 0.45},
  icon: {...typography.ui(18), marginRight: theme.space.sm},
  label: {...typography.ui(17), color: theme.text.primary, flexShrink: 1},
  playText: {color: theme.bg.panel},
  vectorIcon: {marginRight: theme.space.sm},
  trailingIcon: {marginLeft: theme.space.sm},
});
