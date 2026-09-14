import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {Confetti} from './Confetti';
import {Ribbon} from './Ribbon';
import {StarRow} from './StarRow';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import type {ScoreBreakdown} from '../game/engine/ScoreManager';
import {formatDuration} from '../utils/time';

interface Props {
  visible: boolean;
  breakdown: ScoreBreakdown;
  newHighScore: boolean;
  onNext: () => void;
  onHome: () => void;
}

/**
 * Rendered as an in-tree layer rather than in a `Modal`.
 *
 * On Android a Modal's content lives in its own window, which
 * `GestureHandlerRootView` does not wrap — react-native-gesture-handler then
 * swallows every touch inside it and the overlay is visible but completely inert.
 * These overlays are full-screen layers over the game screen anyway, so keeping them
 * in the same tree fixes the touches, avoids a second Modal window fighting the
 * first when one overlay hands over to another, and lets Fabric size them correctly.
 */

/**
 * §9.4 — the completion timeline, to the millisecond.
 *
 *   0.60 ribbon drops · 0.85 stars, 130ms apart · 1.10 praise · 1.20 score counts up
 *   1.60 high-score badge, NEXT LEVEL becomes interactive
 *
 * Buttons render disabled-but-visible from the start, and tapping anywhere
 * fast-forwards to t=1.60 — a player on their fortieth level should never have to
 * watch the whole show.
 */
const T_RIBBON = 600;
const T_STARS = 850;
const T_PRAISE = 1100;
const T_SCORE = 1200;
const T_TIME = 1400;
const T_INTERACTIVE = 1600;
const SCORE_COUNT_MS = 700;

export function LevelCompleteOverlay({
  visible,
  breakdown,
  newHighScore,
  onNext,
  onHome,
}: Props): React.JSX.Element | null {
  const [elapsed, setElapsed] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const praise = useSharedValue(0);
  // §9.4 — the clock arrives after the score, so the two numbers land one at a time
  // rather than competing. A rare award pops; an ordinary one simply fades up.
  const timeIn = useSharedValue(0);

  const ready = elapsed >= T_INTERACTIVE;
  const rare = breakdown.speed.rare;

  const finish = React.useCallback(() => {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current = [];
    setElapsed(T_INTERACTIVE);
    setDisplayScore(breakdown.total);
    praise.value = 1;
    timeIn.value = 1;
  }, [breakdown.total, praise, timeIn]);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      setDisplayScore(0);
      praise.value = 0;
      timeIn.value = 0;
      return;
    }

    Audio.duckMusic(true);
    Audio.play('level_complete');
    Haptics.medium();

    const schedule = (at: number, fn: () => void): void => {
      timers.current.push(setTimeout(fn, at));
    };

    schedule(T_PRAISE, () => {
      praise.value = withTiming(1, {duration: 260});
    });
    schedule(T_SCORE, () => {
      const started = Date.now();
      const tick = (): void => {
        const t = Math.min(1, (Date.now() - started) / SCORE_COUNT_MS);
        // Ease-out so the number lands rather than stopping dead.
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayScore(Math.round(breakdown.total * eased));
        if (t < 1) {
          timers.current.push(setTimeout(tick, 32));
        }
      };
      Audio.play('score_tick');
      tick();
    });
    schedule(T_TIME, () => {
      timeIn.value = rare
        ? withSequence(
            withTiming(1.12, {duration: 200}),
            withTiming(1, {duration: 160}),
          )
        : withTiming(1, {duration: 240});
      if (rare) {
        // The two sub-two-second awards are the only ones that get their own cue.
        Audio.play('score_tick');
        Haptics.light();
      }
    });
    schedule(T_INTERACTIVE, () => setElapsed(T_INTERACTIVE));

    return () => {
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
      timers.current = [];
      Audio.duckMusic(false);
    };
  }, [visible, breakdown.total, praise, timeIn, rare]);

  const praiseStyle = useAnimatedStyle(() => ({
    opacity: praise.value,
    transform: [{translateY: (1 - praise.value) * 8}],
  }));

  const timeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, timeIn.value),
    transform: [{scale: 0.94 + Math.min(1.12, timeIn.value) * 0.06}],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: withDelay(
      0,
      withTiming(ready && newHighScore ? 1 : 0, {duration: 220}),
    ),
  }));

  // Tapping anywhere fast-forwards to t=1.60: a player on their fortieth level
  // should never have to sit through the whole celebration.
  if (!visible) {
    return null;
  }

  return (
    <Pressable style={styles.scrim} onPress={ready ? undefined : finish}>
      <Confetti startDelayMs={450} />

      <Ribbon label="LEVEL COMPLETE!" delayMs={T_RIBBON} />

      <View style={styles.stars}>
        <StarRow
          stars={breakdown.stars}
          size={40}
          animate
          startDelayMs={T_STARS}
        />
      </View>

      <Animated.Text style={[styles.praise, praiseStyle]}>
        {breakdown.praise}
      </Animated.Text>

      <View style={styles.scoreBox}>
        <Text style={styles.scoreLabel}>SCORE</Text>
        <Text style={styles.scoreValue}>{displayScore.toLocaleString()}</Text>
      </View>

      <Animated.View
        style={[
          styles.timeBox,
          rare && {borderColor: theme.state.star},
          timeStyle,
        ]}>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>TIME</Text>
          <Text style={styles.timeValue}>
            {formatDuration(breakdown.elapsedSeconds)}
          </Text>
          <Text
            style={[
              styles.speedLabel,
              {color: rare ? theme.state.star : theme.brand.tagline},
            ]}>
            {breakdown.speed.label}
          </Text>
        </View>
        <Text style={styles.speedBlurb}>{breakdown.speed.blurb}</Text>
      </Animated.View>

      <Animated.Text style={[styles.highScore, badgeStyle]}>
        NEW HIGH SCORE!
      </Animated.Text>

      <View style={styles.buttons}>
        <Button
          label="NEXT LEVEL"
          variant="primary"
          onPress={onNext}
          disabled={!ready}
        />
        <Pressable onPress={ready ? onHome : finish} accessibilityRole="button">
          <Text style={[styles.home, !ready && styles.dimmed]}>HOME</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(2,5,12,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  stars: {marginTop: theme.space.md},
  praise: {
    ...typography.display(22),
    color: theme.brand.tagline,
    letterSpacing: 2,
  },
  scoreBox: {
    borderWidth: 1,
    borderColor: theme.bg.border,
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    alignItems: 'center',
    minWidth: 190,
  },
  scoreLabel: {
    ...typography.body(11),
    color: theme.text.dim,
    letterSpacing: 2.5,
  },
  scoreValue: {...typography.display(28), color: theme.state.star},
  timeBox: {
    borderWidth: 1,
    borderColor: theme.bg.border,
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    alignItems: 'center',
    gap: 2,
    maxWidth: 340,
  },
  timeRow: {flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm},
  timeLabel: {...typography.body(11), color: theme.text.dim, letterSpacing: 2.5},
  timeValue: {...typography.display(18), color: theme.text.primary},
  speedLabel: {...typography.ui(12), letterSpacing: 1.6},
  speedBlurb: {
    ...typography.body(11),
    color: theme.text.secondary,
    textAlign: 'center',
  },
  highScore: {
    ...typography.ui(14),
    color: theme.state.success,
    letterSpacing: 2,
    height: 20,
  },
  buttons: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: theme.space.md,
    maxWidth: 340,
    width: '100%',
    marginTop: theme.space.md,
  },
  home: {...typography.ui(13), color: theme.text.secondary, letterSpacing: 2},
  dimmed: {opacity: 0.4},
});
