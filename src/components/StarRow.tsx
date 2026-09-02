import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {Audio} from '../audio/AudioService';

interface Props {
  stars: 0 | 1 | 2 | 3;
  size?: number;
  /** §9.4 — stars pop in one at a time, 130ms apart, at rising pitch. */
  animate?: boolean;
  /** Delay before the first star lands, so it can be slotted into the win timeline. */
  startDelayMs?: number;
}

const STAR_STAGGER_MS = 130;

export function StarRow({
  stars,
  size = 28,
  animate = false,
  startDelayMs = 0,
}: Props): React.JSX.Element {
  return (
    <View style={styles.row}>
      {[0, 1, 2].map(index => (
        <Star
          key={index}
          filled={index < stars}
          size={size}
          animate={animate && index < stars}
          delayMs={startDelayMs + index * STAR_STAGGER_MS}
          pitchIndex={index as 0 | 1 | 2}
        />
      ))}
    </View>
  );
}

function Star({
  filled,
  size,
  animate,
  delayMs,
  pitchIndex,
}: {
  filled: boolean;
  size: number;
  animate: boolean;
  delayMs: number;
  pitchIndex: 0 | 1 | 2;
}): React.JSX.Element {
  const scale = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      return;
    }
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.25, {duration: 160, easing: Easing.out(Easing.back(2))}),
        withTiming(1, {duration: 120}),
      ),
    );
    const timer = setTimeout(() => Audio.playStar(pitchIndex), delayMs);
    return () => clearTimeout(timer);
  }, [animate, delayMs, pitchIndex, scale]);

  const style = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}));

  return (
    <Animated.View style={style}>
      <Text
        style={[
          styles.star,
          {
            fontSize: size,
            color: filled ? theme.state.star : theme.bg.panelAlt,
          },
        ]}>
        {filled ? '★' : '☆'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 4},
  star: {textAlign: 'center'},
});
