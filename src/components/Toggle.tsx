import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Haptics} from '../haptics/HapticService';

interface Props {
  icon: string;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

const TRACK_WIDTH = 52;
const KNOB = 24;

/** §5.9 — an icon row with a green toggle. List rows never glow (§10.2). */
export function Toggle({
  icon,
  label,
  value,
  onChange,
}: Props): React.JSX.Element {
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    position.value = withTiming(value ? 1 : 0, {duration: 160});
  }, [value, position]);

  const knob = useAnimatedStyle(() => ({
    transform: [{translateX: position.value * (TRACK_WIDTH - KNOB - 6)}],
  }));
  const track = useAnimatedStyle(() => ({
    backgroundColor:
      position.value > 0.5 ? theme.state.badge : theme.bg.panelAlt,
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: value}}
      accessibilityLabel={label}
      style={styles.row}
      onPress={() => {
        Haptics.selection();
        onChange(!value);
      }}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.spacer} />
      {/* The ON/OFF word matters: colour is never the sole signal for state (§10.2). */}
      <Text style={styles.state}>{value ? 'ON' : 'OFF'}</Text>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space.md,
    gap: theme.space.md,
  },
  icon: {fontSize: 18, width: 24, textAlign: 'center'},
  label: {...typography.ui(16)},
  spacer: {flex: 1},
  state: {...typography.body(12), color: theme.text.dim, letterSpacing: 1},
  track: {
    width: TRACK_WIDTH,
    height: KNOB + 6,
    borderRadius: theme.radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: theme.text.primary,
  },
});
