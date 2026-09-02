import React, {useEffect} from 'react';
import {StyleSheet, Text} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';

interface Props {
  label: string;
  /** §9.4 — the banner drops in at t=0.60. */
  delayMs?: number;
}

/** §5.7 — the purple LEVEL COMPLETE! ribbon. */
export function Ribbon({label, delayMs = 0}: Props): React.JSX.Element {
  const drop = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    drop.value = withDelay(
      delayMs,
      withSpring(0, {damping: 12, stiffness: 140}),
    );
    opacity.value = withDelay(
      delayMs,
      withTiming(1, {duration: 200, easing: Easing.out(Easing.quad)}),
    );
  }, [delayMs, drop, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: drop.value}],
  }));

  return (
    <Animated.View style={style}>
      <LinearGradient
        colors={[...theme.button.levels]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.ribbon}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: theme.glow.strong,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  label: {...typography.display(22), letterSpacing: 1.2, textAlign: 'center'},
});
