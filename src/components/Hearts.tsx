import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {MAX_HEARTS} from '../game/engine/GameEngine';

interface Props {
  hearts: number;
  /**
   * §5.4 — on levels 1-25 hearts do not exist, and even where they do they fade in
   * only after the first blocked tap, so a clean run never sees a fail affordance.
   */
  visible: boolean;
}

export function Hearts({hearts, visible}: Props): React.JSX.Element {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {duration: 220});
  }, [visible, opacity]);

  const style = useAnimatedStyle(() => ({opacity: opacity.value}));

  return (
    <Animated.View
      style={[styles.row, style]}
      accessibilityLabel={`${hearts} of ${MAX_HEARTS} hearts`}>
      {Array.from({length: MAX_HEARTS}, (_, i) => (
        <Heart key={i} full={i < hearts} />
      ))}
    </Animated.View>
  );
}

function Heart({full}: {full: boolean}): React.JSX.Element {
  const scale = useSharedValue(1);
  const wasFull = React.useRef(full);

  useEffect(() => {
    if (wasFull.current && !full) {
      // A lost heart is a pause, not a punishment (§3.2), so it deflates rather than
      // flashing red.
      scale.value = withSequence(
        withTiming(1.3, {duration: 110}),
        withTiming(1, {duration: 180}),
      );
    }
    wasFull.current = full;
  }, [full, scale]);

  const style = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}));

  return (
    <Animated.View style={style}>
      <View style={styles.slot}>
        <Text
          style={[
            styles.glyph,
            {color: full ? theme.state.heart : theme.state.heartEmpty},
          ]}>
          {full ? '♥' : '♡'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 2},
  slot: {width: 22, alignItems: 'center'},
  glyph: {fontSize: 18},
});
