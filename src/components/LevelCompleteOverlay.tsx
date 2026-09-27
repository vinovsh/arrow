import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Confetti} from './Confetti';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import type {ScoreBreakdown} from '../game/engine/ScoreManager';
import {formatDuration} from '../utils/time';
import {completeQuoteFor} from '../config/quotes';

const STAR_IMAGE = require('../../assets/art/star.png');

interface Props {
  visible: boolean;
  breakdown: ScoreBreakdown;
  newHighScore: boolean;
  levelId: number;
  /** Fastest solve of this level so far, this run included. */
  bestTime: number;
  newBestTime: boolean;
  levelsCompleted: number;
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
 * The reward screen, drawn after ref/reward model.png frame 4: trophy, title, the
 * earned stars (ref/star.png), a stats card and a quote.
 *
 *   0.00 completion chime · 0.15 trophy pops · 0.45 title · 0.60 earned stars pop
 *   in left to right, 300ms apart, each with a ding, glow and sparkle burst · 0.90
 *   stats card · 1.10 score counts up · 1.35 time · 1.70 NEXT LEVEL interactive
 *
 * All three star slots show as dim placeholders from the start, so the ones that
 * never fill still read as "missed" rather than absent. The last earned star gets a
 * bigger burst and nudges the whole row.
 *
 * Buttons render disabled-but-visible from the start, and tapping anywhere
 * fast-forwards to t=1.70 — a player on their fortieth level should never have to
 * watch the whole show.
 */
const T_TROPHY = 150;
const T_TITLE = 450;
const T_STARS = 600;
const STAR_STAGGER_MS = 300;
/** Pop-in time to the overshoot peak — the moment a star "lands". */
const STAR_POP_MS = 200;
const T_CARD = 900;
const T_SCORE = 1100;
const T_TIME = 1350;
const T_INTERACTIVE = 1700;
const SCORE_COUNT_MS = 700;

export function LevelCompleteOverlay({
  visible,
  breakdown,
  newHighScore,
  levelId,
  bestTime,
  newBestTime,
  levelsCompleted,
  onNext,
  onHome,
}: Props): React.JSX.Element | null {
  const [elapsed, setElapsed] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  /** Set by tap-to-skip: stars jump to their final state without dinging. */
  const [skipped, setSkipped] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trophy = useSharedValue(0);
  const title = useSharedValue(0);
  const card = useSharedValue(0);
  const timeIn = useSharedValue(0);
  const starRow = useSharedValue(1);

  const ready = elapsed >= T_INTERACTIVE;
  const rare = breakdown.speed.rare;
  const earned = Math.max(0, Math.min(3, breakdown.stars));

  // The show runs once per opening. Reading these through a ref keeps a re-render
  // with a fresh `breakdown` object from restarting it and replaying the chime.
  const latest = useRef({total: breakdown.total, rare, earned});
  latest.current = {total: breakdown.total, rare, earned};

  const finish = useCallback(() => {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current = [];
    setElapsed(T_INTERACTIVE);
    setSkipped(true);
    setDisplayScore(latest.current.total);
    trophy.value = 1;
    title.value = 1;
    card.value = 1;
    timeIn.value = 1;
    starRow.value = 1;
  }, [trophy, title, card, timeIn, starRow]);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      setDisplayScore(0);
      setSkipped(false);
      trophy.value = 0;
      title.value = 0;
      card.value = 0;
      timeIn.value = 0;
      starRow.value = 1;
      return;
    }

    const {total, rare: isRare, earned: starCount} = latest.current;

    Audio.duckMusic(true);
    Audio.play('level_complete');
    Haptics.medium();

    const schedule = (at: number, fn: () => void): void => {
      timers.current.push(setTimeout(fn, at));
    };

    trophy.value = withDelay(
      T_TROPHY,
      withTiming(1, {duration: 520, easing: Easing.out(Easing.back(1.8))}),
    );
    title.value = withDelay(T_TITLE, withTiming(1, {duration: 320}));
    card.value = withDelay(T_CARD, withTiming(1, {duration: 380}));

    if (starCount > 0) {
      // A small nudge of the whole row as the final earned star lands.
      starRow.value = withDelay(
        T_STARS + (starCount - 1) * STAR_STAGGER_MS + STAR_POP_MS,
        withSequence(
          withTiming(1.07, {duration: 130, easing: Easing.out(Easing.quad)}),
          withTiming(1, {duration: 220, easing: Easing.inOut(Easing.quad)}),
        ),
      );
    }

    schedule(T_SCORE, () => {
      const started = Date.now();
      const tick = (): void => {
        const t = Math.min(1, (Date.now() - started) / SCORE_COUNT_MS);
        // Ease-out so the number lands rather than stopping dead.
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayScore(Math.round(total * eased));
        if (t < 1) {
          timers.current.push(setTimeout(tick, 32));
        }
      };
      Audio.play('score_tick');
      tick();
    });
    schedule(T_TIME, () => {
      timeIn.value = isRare
        ? withSequence(
            withTiming(1.12, {duration: 200}),
            withTiming(1, {duration: 160}),
          )
        : withTiming(1, {duration: 240});
      if (isRare) {
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
  }, [visible, trophy, title, card, timeIn, starRow]);

  const starRowStyle = useAnimatedStyle(() => ({
    transform: [{scale: starRow.value}],
  }));

  const trophyStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, trophy.value * 1.5),
    transform: [{scale: 0.4 + trophy.value * 0.6}],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{translateY: (1 - title.value) * 10}],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{translateY: (1 - card.value) * 16}],
  }));

  const timeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, timeIn.value),
    transform: [{scale: 0.94 + Math.min(1.12, timeIn.value) * 0.06}],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...theme.reward.bg]}
        style={StyleSheet.absoluteFill}
      />
      <Hills />
      <Confetti startDelayMs={350} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* Tapping anywhere fast-forwards to t=1.60. */}
        <Pressable
          style={styles.content}
          onPress={ready ? undefined : finish}>
          <Animated.View style={trophyStyle}>
            <Trophy />
          </Animated.View>

          <Animated.View style={[styles.titleBlock, titleStyle]}>
            <Text style={styles.title}>
              Level {levelId}
              {'\n'}Completed!
            </Text>
            <Text style={styles.subtitle}>{breakdown.speed.blurb}</Text>
          </Animated.View>

          <Animated.View style={[styles.stars, starRowStyle]}>
            {[0, 1, 2].map(i => (
              <RewardStar
                key={i}
                filled={i < earned}
                final={i === earned - 1}
                index={i as 0 | 1 | 2}
                delayMs={T_STARS + i * STAR_STAGGER_MS}
                large={i === 1}
                skipped={skipped}
              />
            ))}
          </Animated.View>

          <Animated.View style={[styles.card, cardStyle]}>
            <StatRow
              icon={<Image source={STAR_IMAGE} style={styles.starIcon} />}
              label="Score"
              value={displayScore.toLocaleString()}
              valueColour={theme.reward.gold}
              isNew={ready && newHighScore}
            />
            <Divider />
            <Animated.View style={timeStyle}>
              <StatRow
                icon={<ClockIcon />}
                label={rare ? breakdown.speed.label : 'Time'}
                value={formatDuration(breakdown.elapsedSeconds)}
                valueColour={theme.reward.green}
              />
            </Animated.View>
            <Divider />
            <StatRow
              icon={<BoltIcon />}
              label="Best Time"
              value={formatDuration(bestTime)}
              valueColour={theme.reward.green}
              isNew={ready && newBestTime}
            />
            <Divider />
            <StatRow
              icon={<CupIcon />}
              label="Total Levels Completed"
              value={String(levelsCompleted)}
              valueColour={theme.reward.gold}
            />
          </Animated.View>

          <Animated.View style={[styles.quoteCard, cardStyle]}>
            <TargetIcon />
            <Text style={styles.quote}>“{completeQuoteFor(levelId)}”</Text>
          </Animated.View>

          <View style={styles.buttons}>
            <NextButton onPress={onNext} disabled={!ready} />
            <Pressable
              onPress={ready ? onHome : finish}
              accessibilityRole="button"
              accessibilityLabel="Home"
              style={[styles.home, !ready && styles.dimmed]}>
              <HomeIcon />
              <Text style={styles.homeLabel}>Home</Text>
            </Pressable>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * One star slot: a dim placeholder that is always visible, and — if earned — a gold
 * star that pops in over it with a slight overshoot, a soft glow and a sparkle burst.
 * The last earned star (`final`) bursts wider and longer.
 */
function RewardStar({
  filled,
  final,
  index,
  delayMs,
  large,
  skipped,
}: {
  filled: boolean;
  final: boolean;
  index: 0 | 1 | 2;
  delayMs: number;
  large: boolean;
  skipped: boolean;
}): React.JSX.Element {
  const pop = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (!filled) {
      return;
    }
    if (skipped) {
      cancelAnimation(pop);
      cancelAnimation(burst);
      pop.value = 1;
      burst.value = 0;
      return;
    }
    pop.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.25, {duration: STAR_POP_MS, easing: Easing.out(Easing.quad)}),
        withTiming(0.94, {duration: 110, easing: Easing.inOut(Easing.quad)}),
        withTiming(1, {duration: 120, easing: Easing.out(Easing.quad)}),
      ),
    );
    burst.value = withDelay(
      delayMs + STAR_POP_MS - 40,
      withTiming(1, {
        duration: final ? 650 : 480,
        easing: Easing.out(Easing.cubic),
      }),
    );
    // The ding lands with the star, just before the overshoot peak.
    const timer = setTimeout(() => {
      Audio.playStar(index);
      Haptics.light();
    }, delayMs + STAR_POP_MS - 60);
    return () => clearTimeout(timer);
  }, [filled, skipped, final, delayMs, index, pop, burst]);

  const size = large ? 58 : 46;

  const starStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 3),
    transform: [
      {scale: pop.value},
      {rotate: `${(1 - Math.min(1, pop.value)) * -30}deg`},
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    // Swells and fades across the burst, peaking half-way.
    opacity: 4 * burst.value * (1 - burst.value) * (final ? 0.75 : 0.55),
    transform: [{scale: 0.6 + burst.value * (final ? 1.1 : 0.8)}],
  }));

  const sparkles = final ? 10 : 6;
  const reach = size * (final ? 1.05 : 0.8);
  const glowSize = size * 1.4;

  return (
    <View style={[{width: size, height: size}, !large && styles.sideStar]}>
      <Image
        source={STAR_IMAGE}
        style={[styles.starLayer, {width: size, height: size}, styles.emptyStar]}
      />
      {filled ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.starGlow,
              {
                width: glowSize,
                height: glowSize,
                borderRadius: glowSize / 2,
                left: (size - glowSize) / 2,
                top: (size - glowSize) / 2,
              },
              glowStyle,
            ]}
          />
          <Animated.Image
            source={STAR_IMAGE}
            style={[styles.starLayer, {width: size, height: size}, starStyle]}
          />
          {Array.from({length: sparkles}, (_, i) => (
            <Sparkle
              key={i}
              burst={burst}
              angle={(i / sparkles) * 2 * Math.PI + index * 0.4}
              reach={reach * (i % 2 === 0 ? 1 : 0.72)}
              centre={size / 2}
              light={i % 2 === 0}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** A tiny diamond flung outward from a star's centre as `burst` runs 0 → 1. */
function Sparkle({
  burst,
  angle,
  reach,
  centre,
  light,
}: {
  burst: SharedValue<number>;
  angle: number;
  reach: number;
  centre: number;
  light: boolean;
}): React.JSX.Element {
  const dx = Math.cos(angle) * reach;
  const dy = Math.sin(angle) * reach;
  const style = useAnimatedStyle(() => {
    const b = burst.value;
    return {
      opacity: b <= 0 ? 0 : b < 0.15 ? b / 0.15 : (1 - b) / 0.85,
      transform: [
        {translateX: dx * b},
        {translateY: dy * b},
        {rotate: '45deg'},
        {scale: 1 - b * 0.55},
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        {
          left: centre - SPARKLE_SIZE / 2,
          top: centre - SPARKLE_SIZE / 2,
          backgroundColor: light ? theme.reward.title : theme.reward.goldLight,
        },
        style,
      ]}
    />
  );
}

const SPARKLE_SIZE = 7;

function StatRow({
  icon,
  label,
  value,
  valueColour,
  isNew = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColour: string;
  isNew?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, {color: valueColour}]}>{value}</Text>
      {isNew ? (
        <View style={styles.newBadge}>
          <Text style={styles.newText}>New!</Text>
        </View>
      ) : null}
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function NextButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{scale: 1 - pressed.value * 0.04}],
  }));
  return (
    <Animated.View style={[styles.nextWrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next Level"
        accessibilityState={{disabled}}
        disabled={disabled}
        onPressIn={() => {
          pressed.value = withTiming(1, {duration: 90});
          Haptics.selection();
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, {duration: 90});
        }}
        onPress={() => {
          Audio.play('ui_tap');
          onPress();
        }}>
        <LinearGradient
          colors={[...theme.reward.next]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[styles.next, disabled && styles.dimmed]}>
          <Text style={styles.nextLabel}>Next Level  →</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------------------ artwork

/** Gold cup between two blue laurel branches, gently glowing. */
function Trophy(): React.JSX.Element {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, {duration: 1300, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.35,
    transform: [{scale: 0.92 + glow.value * 0.12}],
  }));

  const leaves = (side: 1 | -1): React.JSX.Element => (
    <G transform={side === -1 ? 'translate(200 0) scale(-1 1)' : undefined}>
      <Path
        d="M58 42 C40 60 36 90 52 118 C62 132 78 140 96 142"
        stroke={theme.reward.laurel}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      {[
        [50, 52, -40],
        [42, 72, -20],
        [40, 94, 0],
        [46, 114, 25],
        [60, 130, 50],
        [78, 140, 75],
      ].map(([x, y, r], i) => (
        <Path
          key={i}
          d="M0 0 C-6 -10 -2 -20 6 -24 C10 -14 8 -6 0 0Z"
          fill={theme.reward.laurel}
          transform={`translate(${x} ${y}) rotate(${r - 90})`}
        />
      ))}
    </G>
  );

  return (
    <View style={styles.trophyBox}>
      <Animated.View style={[styles.trophyGlow, glowStyle]} />
      <Svg width={170} height={136} viewBox="0 0 200 160">
        <Defs>
          <SvgGradient id="cup" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.reward.goldLight} />
            <Stop offset="0.55" stopColor={theme.reward.gold} />
            <Stop offset="1" stopColor={theme.reward.goldDeep} />
          </SvgGradient>
        </Defs>
        {leaves(1)}
        {leaves(-1)}
        {/* Handles. */}
        <Path
          d="M68 36 C44 36 44 76 76 80 M132 36 C156 36 156 76 124 80"
          stroke="url(#cup)"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
        />
        {/* Bowl, stem, base. */}
        <Path d="M64 24 H136 C136 72 122 94 100 98 C78 94 64 72 64 24Z" fill="url(#cup)" />
        <Rect x={92} y={96} width={16} height={20} fill="url(#cup)" />
        <Rect x={74} y={114} width={52} height={10} rx={4} fill="url(#cup)" />
        <Rect x={66} y={124} width={68} height={14} rx={5} fill="url(#cup)" />
        {/* Star on the bowl and a gloss stripe. */}
        <Path
          d="M100 40 L106 53 L120 54 L109 63 L113 77 L100 69 L87 77 L91 63 L80 54 L94 53Z"
          fill={theme.reward.goldLight}
          opacity={0.9}
        />
        <Path
          d="M74 30 C74 58 80 76 90 86"
          stroke={theme.reward.title}
          strokeOpacity={0.5}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** Rolling hills and a pine line across the foot of the screen. */
function Hills(): React.JSX.Element {
  return (
    <View style={styles.hills} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none">
        <Path
          d="M0 80 C60 40 120 90 200 60 C280 30 340 80 400 50 V160 H0Z"
          fill={theme.reward.hills[0]}
        />
        <Path
          d="M0 120 C80 90 140 130 220 105 C300 80 350 120 400 100 V160 H0Z"
          fill={theme.reward.hills[1]}
        />
        {[18, 48, 330, 362, 388].map((x, i) => (
          <Path
            key={i}
            d={`M${x} ${150 - (i % 2) * 12} l12 -46 l12 46Z`}
            fill={theme.reward.hills[1]}
          />
        ))}
      </Svg>
    </View>
  );
}

function ClockIcon(): React.JSX.Element {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Circle cx={15} cy={15} r={12} fill={theme.reward.title} stroke={theme.reward.clock} strokeWidth={3.5} />
      <Path
        d="M15 8 V15 L20 18"
        stroke={theme.reward.clock}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function BoltIcon(): React.JSX.Element {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path d="M17 2 L6 17 H14 L12 28 L24 12 H16Z" fill={theme.reward.bolt} />
    </Svg>
  );
}

function CupIcon(): React.JSX.Element {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path
        d="M9 6 C4 6 4 13 10 14 M21 6 C26 6 26 13 20 14"
        stroke={theme.reward.goldDeep}
        strokeWidth={2.4}
        fill="none"
      />
      <Path d="M8 4 H22 C22 13 19 17 15 18 C11 17 8 13 8 4Z" fill={theme.reward.gold} />
      <Rect x={13} y={17} width={4} height={5} fill={theme.reward.gold} />
      <Rect x={9} y={22} width={12} height={4} rx={1.5} fill={theme.reward.goldDeep} />
    </Svg>
  );
}

function TargetIcon(): React.JSX.Element {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <G stroke={theme.reward.icon} strokeWidth={2.6} fill="none">
        <Circle cx={18} cy={22} r={14} />
        <Circle cx={18} cy={22} r={8.5} />
      </G>
      <Circle cx={18} cy={22} r={3} fill={theme.reward.icon} />
      <Path
        d="M18 22 L34 6 M28 6 H34 V12"
        stroke={theme.reward.icon}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function HomeIcon(): React.JSX.Element {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M3 11 L12 3 L21 11 M6 9 V21 H10 V15 H14 V21 H18 V9"
        stroke={theme.reward.icon}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject, zIndex: 40},
  scroll: {flexGrow: 1},
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xl + theme.space.md,
    paddingBottom: theme.space.lg,
  },
  hills: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 160},
  trophyBox: {alignItems: 'center', justifyContent: 'center'},
  trophyGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: theme.reward.gold,
    shadowColor: theme.reward.gold,
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  titleBlock: {alignItems: 'center', marginTop: theme.space.xs},
  title: {
    ...typography.display(32),
    color: theme.reward.title,
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    ...typography.ui(14),
    color: theme.reward.subtitle,
    textAlign: 'center',
    marginTop: theme.space.sm,
    maxWidth: 320,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
    marginVertical: theme.space.md,
  },
  sideStar: {marginBottom: 2},
  emptyStar: {opacity: 0.22},
  starLayer: {position: 'absolute', left: 0, top: 0},
  starGlow: {
    position: 'absolute',
    backgroundColor: theme.reward.goldLight,
    shadowColor: theme.reward.gold,
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  sparkle: {
    position: 'absolute',
    width: SPARKLE_SIZE,
    height: SPARKLE_SIZE,
    borderRadius: 1.5,
  },
  card: {
    maxWidth: 380,
    width: '100%',
    backgroundColor: theme.reward.card,
    borderColor: theme.reward.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: theme.space.md,
  },
  rowIcon: {width: 30, alignItems: 'center'},
  starIcon: {width: 30, height: 30},
  rowLabel: {...typography.ui(14), color: theme.reward.label, flex: 1},
  rowValue: {...typography.display(18)},
  newBadge: {
    backgroundColor: theme.reward.newBadge,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
  },
  newText: {...typography.ui(11), color: theme.reward.title},
  divider: {height: 1, backgroundColor: theme.reward.divider},
  quoteCard: {
    maxWidth: 380,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    marginTop: theme.space.md,
    backgroundColor: theme.reward.card,
    borderColor: theme.reward.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
  },
  quote: {
    ...typography.ui(14),
    color: theme.reward.subtitle,
    flex: 1,
    lineHeight: 20,
  },
  buttons: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: theme.space.md,
    marginTop: theme.space.lg,
  },
  nextWrap: {maxWidth: 380, width: '100%'},
  next: {
    height: 56,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.reward.next[1],
    shadowOpacity: 0.6,
    shadowRadius: theme.glow.strong,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  nextLabel: {...typography.display(18), color: theme.reward.title},
  home: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    height: 50,
    paddingHorizontal: theme.space.xl + theme.space.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.reward.homeBorder,
  },
  homeLabel: {...typography.ui(16), color: theme.reward.title},
  dimmed: {opacity: 0.45},
});
