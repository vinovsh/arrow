import React, {useEffect, useRef} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {Reaction} from '../game/celebration/reactions';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';

/** A pop, happy wiggle and bounce, with an opaque caption and no dimming veil. */
export function EmojiReaction({
  reaction,
  onFinish,
}: {
  reaction: Reaction;
  onFinish: () => void;
}): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    progress.setValue(0);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (!alive) {
          return;
        }
        if (reduce) {
          progress.setValue(1);
          timer = setTimeout(() => {
            if (alive) {
              finish.current();
            }
          }, 1200);
          return;
        }
        const timing = (toValue: number, duration: number) =>
          Animated.timing(progress, {
            toValue,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          });
        animation = Animated.sequence([
          timing(1, 230),
          timing(1.18, 140),
          timing(0.94, 140),
          timing(1.08, 140),
          timing(1, 140),
          Animated.delay(reaction.kind === 'complete' ? 650 : 400),
          timing(0, 200),
        ]);
        animation.start(({finished}) => {
          if (alive && finished) {
            finish.current();
          }
        });
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        progress.setValue(1);
        timer = setTimeout(() => {
          if (alive) {
            finish.current();
          }
        }, 1200);
      });
    return () => {
      alive = false;
      animation?.stop();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [progress, reaction.kind]);
  const halfway = reaction.kind === 'halfway';
  const rotate = progress.interpolate({
    inputRange: [0, 0.94, 1, 1.08, 1.18],
    outputRange: ['-12deg', '-7deg', '0deg', '7deg', '-8deg'],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.7, 1.2],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, halfway && styles.halfway]}
      accessibilityLiveRegion="polite">
      <Animated.View
        style={[styles.content, {opacity, transform: [{scale: progress}]}]}>
        <Animated.Text
          accessible={false}
          style={[
            styles.emoji,
            halfway && styles.smallEmoji,
            {transform: [{rotate}]},
          ]}>
          {reaction.emoji}
        </Animated.Text>
        <View style={styles.bubble}>
          <Text style={styles.caption}>{reaction.caption}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  halfway: {justifyContent: 'flex-start', paddingTop: 12},
  content: {alignItems: 'center'},
  emoji: {fontSize: 76, lineHeight: 94},
  smallEmoji: {fontSize: 48, lineHeight: 62},
  bubble: {
    backgroundColor: theme.board.bg,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: theme.board.ink,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  caption: {...typography.body(20), color: theme.board.escaping},
});
