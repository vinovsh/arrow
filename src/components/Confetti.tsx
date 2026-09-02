import React, {useMemo} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';

interface Props {
  /** §9.4 — confetti begins at t=0.45 and lives 3.5s before fading. */
  startDelayMs?: number;
  count?: number;
}

const LIFE_MS = 3500;
const DEFAULT_COUNT = 34;

/**
 * §5.7 / §9.4 — the completion confetti.
 *
 * Every piece is a plain View with one Reanimated style, spawned once and never
 * remounted: the celebration runs on the UI thread while the JS thread is busy
 * settling scores and writing the save (§15).
 */
export function Confetti({
  startDelayMs = 0,
  count = DEFAULT_COUNT,
}: Props): React.JSX.Element {
  const {width, height} = useWindowDimensions();
  const palette = useMemo(() => Object.values(theme.arrow), []);

  const pieces = useMemo(
    () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: startDelayMs + Math.random() * 700,
        duration: LIFE_MS * (0.7 + Math.random() * 0.5),
        size: 6 + Math.random() * 7,
        colour: palette[i % palette.length],
        spin: (Math.random() - 0.5) * 900,
      })),
    [count, width, startDelayMs, palette],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(({key, ...piece}) => (
        <Piece key={key} {...piece} fallTo={height + 60} />
      ))}
    </View>
  );
}

function Piece({
  x,
  drift,
  delay,
  duration,
  size,
  colour,
  spin,
  fallTo,
}: {
  x: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
  colour: string;
  spin: number;
  fallTo: number;
}): React.JSX.Element {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {duration, easing: Easing.linear}),
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity:
      progress.value === 0 ? 0 : 1 - Math.max(0, progress.value - 0.75) * 4,
    transform: [
      {translateX: x + drift * progress.value},
      {translateY: -30 + fallTo * progress.value},
      {rotate: `${spin * progress.value}deg`},
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {width: size, height: size * 0.55, backgroundColor: colour},
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {position: 'absolute', left: 0, top: 0, borderRadius: 2},
});
