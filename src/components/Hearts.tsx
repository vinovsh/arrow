import React, {useEffect, useRef} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {theme} from '../theme/theme';
import {MAX_HEARTS} from '../game/engine/GameEngine';

interface Props {
  hearts: number;
  visible: boolean;
}

export function Hearts({hearts, visible}: Props): React.JSX.Element {
  return (
    <Animated.View
      style={styles.row}
      accessible
      accessibilityLabel={`${hearts} of ${MAX_HEARTS} hearts`}>
      {Array.from({length: MAX_HEARTS}, (_, i) => (
        <Heart key={i} full={i < hearts} visible={visible} index={i} />
      ))}
    </Animated.View>
  );
}

function Heart({
  full,
  visible,
  index,
}: {
  full: boolean;
  visible: boolean;
  index: number;
}): React.JSX.Element {
  const scale = useSharedValue(1.6);
  const opacity = useSharedValue(0);
  const shake = useSharedValue(0);
  const wasFull = useRef(full);
  useEffect(() => {
    opacity.value = withDelay(
      visible ? 420 + index * 110 : 0,
      withTiming(visible ? 1 : 0, {duration: 220}),
    );
    scale.value = withDelay(420 + index * 110, withTiming(1, {duration: 260}));
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [visible, index, opacity, scale]);
  useEffect(() => {
    if (wasFull.current && !full) {
      scale.value = withSequence(
        withTiming(1.25, {duration: 90}),
        withTiming(1, {duration: 200}),
      );
      shake.value = withSequence(
        withTiming(-3, {duration: 50}),
        withTiming(3, {duration: 70}),
        withTiming(0, {duration: 80}),
      );
    } else if (!wasFull.current && full) {
      scale.value = withSequence(
        withTiming(1.2, {duration: 100}),
        withTiming(1, {duration: 180}),
      );
    }
    wasFull.current = full;
  }, [full, scale, shake]);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateX: shake.value}, {scale: scale.value}],
  }));
  return (
    <Animated.View style={animated}>
      <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M12 21S2 15 2 8.5C2 3.2 9 2 12 7C15 2 22 3.2 22 8.5C22 15 12 21 12 21Z"
          fill={full ? theme.state.heart : theme.state.heartEmpty}
        />
        {full && (
          <Path
            d="M5.5 8Q5.8 5.4 8.4 6"
            fill="none"
            stroke={theme.bg.panel}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.65}
          />
        )}
      </Svg>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});
