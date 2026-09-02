import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
import type {ActiveCoachMark} from '../game/tutorial/TutorialController';

interface Props {
  mark: ActiveCoachMark;
  /** Spotlight centre in screen dp, or null for a board-wide mark. */
  spotlight: {x: number; y: number; radius: number} | null;
  /** Which half of the board the caption must avoid. */
  targetInTopHalf: boolean;
  onDismiss: () => void;
  onSkip?: () => void;
}

/** §6 — 55% dim, soft radial spotlight, 900ms ghost-hand loop fading after 3 loops. */
const DIM = 0.55;
const GHOST_LOOP_MS = 900;
const GHOST_LOOPS = 3;

export function CoachMark({
  mark,
  spotlight,
  targetInTopHalf,
  onDismiss,
  onSkip,
}: Props): React.JSX.Element {
  const ghost = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, {duration: 240});
    if (mark.step.gesture === 'none') {
      return;
    }
    ghost.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: GHOST_LOOP_MS / 2,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: GHOST_LOOP_MS / 2,
          easing: Easing.in(Easing.quad),
        }),
      ),
      GHOST_LOOPS * 2,
      false,
    );
  }, [mark, ghost, fade]);

  const overlay = useAnimatedStyle(() => ({opacity: fade.value}));

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - ghost.value * 0.4),
    transform: [
      {
        scale:
          mark.step.gesture === 'pinch'
            ? 1 + ghost.value * 0.35
            : 1 - ghost.value * 0.15,
      },
      {translateY: ghost.value * 6},
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlay]}>
      {/* The overlay never blocks the target's touch area (§6): the dim is drawn as
          four panels around the spotlight rather than as one sheet over everything.
          Each panel dismisses on press, because §6 also says every coach mark is
          dismissible by tapping anywhere — a dim panel that merely swallows the touch
          leaves the player poking at a screen that does not answer. */}
      {spotlight ? (
        <>
          <Pressable
            onPress={onDismiss}
            style={[styles.dim, {height: spotlight.y - spotlight.radius}]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dim,
              {
                top: spotlight.y + spotlight.radius,
                height: 2000,
              },
            ]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dimSide,
              {
                top: spotlight.y - spotlight.radius,
                height: spotlight.radius * 2,
                width: Math.max(0, spotlight.x - spotlight.radius),
                left: 0,
              },
            ]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dimSide,
              {
                top: spotlight.y - spotlight.radius,
                height: spotlight.radius * 2,
                left: spotlight.x + spotlight.radius,
                right: 0,
              },
            ]}
          />
          <View
            style={[
              styles.halo,
              {
                left: spotlight.x - spotlight.radius,
                top: spotlight.y - spotlight.radius,
                width: spotlight.radius * 2,
                height: spotlight.radius * 2,
                borderRadius: spotlight.radius,
              },
            ]}
            pointerEvents="none"
          />
          {mark.step.gesture !== 'none' && (
            <Animated.View
              style={[
                styles.ghost,
                {left: spotlight.x - 18, top: spotlight.y - 12},
                ghostStyle,
              ]}
              pointerEvents="none">
              <Text style={styles.ghostGlyph}>
                {mark.step.gesture === 'pinch' ? '👌' : '👆'}
              </Text>
            </Animated.View>
          )}
        </>
      ) : (
        <Pressable style={[styles.dim, styles.full]} onPress={onDismiss} />
      )}

      {mark.step.caption !== '' && (
        <Pressable
          style={[
            styles.captionSlot,
            targetInTopHalf ? styles.lower : styles.upper,
          ]}
          onPress={onDismiss}>
          <View style={styles.caption}>
            <Text style={styles.captionText}>{mark.step.caption}</Text>
          </View>
        </Pressable>
      )}

      {onSkip && (
        <Pressable
          style={styles.skip}
          onPress={onSkip}
          accessibilityRole="button">
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {zIndex: 30},
  full: {...StyleSheet.absoluteFillObject},
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: `rgba(2,5,12,${DIM})`,
  },
  dimSide: {position: 'absolute', backgroundColor: `rgba(2,5,12,${DIM})`},
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,211,74,0.55)',
  },
  ghost: {position: 'absolute'},
  ghostGlyph: {fontSize: 34},
  captionSlot: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  upper: {top: '18%'},
  lower: {bottom: '18%'},
  caption: {
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.bg.border,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  captionText: {...typography.ui(18), textAlign: 'center'},
  skip: {
    position: 'absolute',
    right: theme.space.md,
    bottom: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  skipText: {
    ...typography.body(13),
    color: theme.text.secondary,
    letterSpacing: 1.5,
  },
});
