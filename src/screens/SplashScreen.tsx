import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
import {preloadAround} from '../game/levels';
import {nextQuote, type Quote} from '../config/quotes';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * The launch screen, drawn after ref/screens (2).png panel 6: a glowing brain over
 * a motivational line that changes every open. It holds for 5s — the dots along the
 * bottom fill as that time runs — while packs, save data and audio preload behind it.
 */
const HOLD_MS = 5000;
const DOTS = 4;
const BRAIN_SIZE = 220;

export function SplashScreen({navigation}: Props): React.JSX.Element {
  const advanced = useRef(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const go = useCallback(() => {
    if (advanced.current) {
      return;
    }
    advanced.current = true;
    // §6 — on a fresh install level 1 opens itself rather than making the player
    // find it. Everywhere else, Home.
    if (
      !SaveStore.data.tutorialCompleted &&
      SaveStore.data.completedLevels.length === 0
    ) {
      navigation.replace('Game', {levelId: 1});
    } else {
      navigation.replace('Home');
    }
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    void nextQuote().then(q => {
      if (!cancelled) {
        setQuote(q);
      }
    });
    // Leave once both the hold and the boot work are done, whichever is last.
    const held = new Promise<void>(resolve => setTimeout(resolve, HOLD_MS));
    const boot = (async () => {
      const data = await SaveStore.load();
      preloadAround(data.currentLevel);
      await Audio.preload();
      Audio.startMusic();
    })();
    void Promise.all([held, boot]).then(() => {
      if (!cancelled) {
        go();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [go]);

  return (
    <LinearGradient colors={[...theme.splash.bg]} style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.splash.bg[0]}
        translucent={false}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.centre}>
          <Brain />
          <QuoteText quote={quote} />
        </View>
        <ProgressDots />
      </SafeAreaView>
    </LinearGradient>
  );
}

function QuoteText({quote}: {quote: Quote | null}): React.JSX.Element {
  const shown = useSharedValue(0);

  useEffect(() => {
    if (quote) {
      shown.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [quote, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{translateY: (1 - shown.value) * 14}],
  }));

  return (
    <Animated.View style={[styles.quote, style]}>
      <Text style={styles.title}>{quote?.title ?? ' '}</Text>
      <Text style={styles.body}>{quote?.body ?? ' '}</Text>
    </Animated.View>
  );
}

/** Fills one dot per quarter of the hold, so the wait reads as progress. */
function ProgressDots(): React.JSX.Element {
  const [lit, setLit] = useState(1);

  useEffect(() => {
    const step = HOLD_MS / DOTS;
    const timer = setInterval(
      () => setLit(n => Math.min(DOTS, n + 1)),
      step,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.dots}>
      {Array.from({length: DOTS}, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < lit && styles.dotActive]}
        />
      ))}
    </View>
  );
}

/** Sparkles around the brain: [x, y, size, kind] in the 220-unit box. */
const SPARKLES: [number, number, number, 'star' | 'diamond'][] = [
  [110, 8, 16, 'star'],
  [34, 38, 9, 'diamond'],
  [188, 34, 12, 'star'],
  [10, 110, 8, 'diamond'],
  [210, 104, 9, 'diamond'],
  [30, 186, 12, 'star'],
  [196, 182, 8, 'diamond'],
  [112, 212, 7, 'diamond'],
];

function Brain(): React.JSX.Element {
  const float = useSharedValue(0);
  const breathe = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.6)),
    });
    float.value = withRepeat(
      withTiming(1, {duration: 1800, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
  }, [appear, breathe, float]);

  const brainStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      {translateY: -6 + float.value * 12},
      {scale: appear.value * (0.97 + breathe.value * 0.05)},
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + breathe.value * 0.45,
    transform: [{scale: 0.9 + breathe.value * 0.15}],
  }));

  return (
    <View style={styles.brainBox}>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={BRAIN_SIZE} height={BRAIN_SIZE} viewBox="0 0 220 220">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme.splash.glow} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.splash.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={110} cy={110} r={108} fill="url(#glow)" />
        </Svg>
      </Animated.View>

      {SPARKLES.map(([x, y, size, kind], i) => (
        <Sparkle
          key={i}
          x={x}
          y={y}
          size={size}
          kind={kind}
          colour={theme.splash.sparkle[i % theme.splash.sparkle.length]}
          delay={i * 180}
        />
      ))}

      <Animated.View style={[StyleSheet.absoluteFill, brainStyle]}>
        <Svg width={BRAIN_SIZE} height={BRAIN_SIZE} viewBox="0 0 220 220">
          <Defs>
            {/* One gradient in user space shared by every lobe, so the overlapping
                circles read as a single cloud with no seams. */}
            <SvgGradient
              id="lobe"
              x1="0"
              y1="50"
              x2="0"
              y2="170"
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={theme.splash.brainTop} />
              <Stop offset="1" stopColor={theme.splash.brainBottom} />
            </SvgGradient>
          </Defs>
          <G fill="url(#lobe)">
            <Circle cx={80} cy={88} r={34} />
            <Circle cx={118} cy={74} r={38} />
            <Circle cx={152} cy={96} r={30} />
            <Circle cx={60} cy={122} r={30} />
            <Circle cx={160} cy={130} r={28} />
            <Circle cx={96} cy={132} r={36} />
            <Circle cx={132} cy={136} r={32} />
          </G>
          {/* Brain folds. */}
          <G
            stroke={theme.splash.brainFold}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none">
            <Path d="M110 52 C100 70 120 80 108 98" />
            <Path d="M58 104 C70 98 78 110 90 104" />
            <Path d="M146 76 C140 90 156 98 150 110" />
            <Path d="M64 146 C76 140 84 152 96 146" />
            <Path d="M140 158 C150 150 162 158 170 150" />
          </G>
          {/* The two arrows at its heart: ← over →. */}
          <G
            stroke={theme.splash.arrow}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none">
            <Path d="M136 104 H84 M98 90 L84 104 L98 118" />
            <Path d="M84 138 H136 M122 124 L136 138 L122 152" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

function Sparkle({
  x,
  y,
  size,
  kind,
  colour,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  kind: 'star' | 'diamond';
  colour: string;
  delay: number;
}): React.JSX.Element {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, {duration: 700, easing: Easing.inOut(Easing.sin)}),
          withTiming(0.2, {duration: 700, easing: Easing.inOut(Easing.sin)}),
        ),
        -1,
        false,
      ),
    );
  }, [delay, twinkle]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + twinkle.value * 0.7,
    transform: [{scale: 0.7 + twinkle.value * 0.4}],
  }));

  const s = size;
  // A four-point star, or a rhombus, centred in its own box.
  const d =
    kind === 'star'
      ? `M${s} 0 Q${s * 1.12} ${s * 0.88} ${s * 2} ${s} Q${s * 1.12} ${s * 1.12} ${s} ${s * 2} Q${s * 0.88} ${s * 1.12} 0 ${s} Q${s * 0.88} ${s * 0.88} ${s} 0Z`
      : `M${s} 0 L${s * 1.6} ${s} L${s} ${s * 2} L${s * 0.4} ${s}Z`;

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {left: x - s, top: y - s, width: s * 2, height: s * 2},
        style,
      ]}>
      <Svg width={s * 2} height={s * 2}>
        <Path d={d} fill={colour} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  safe: {flex: 1, alignItems: 'center'},
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  brainBox: {width: BRAIN_SIZE, height: BRAIN_SIZE},
  sparkle: {position: 'absolute'},
  quote: {alignItems: 'center', marginTop: theme.space.xl},
  title: {
    ...typography.display(32),
    color: theme.splash.title,
    textAlign: 'center',
    lineHeight: 40,
  },
  body: {
    ...typography.body(16),
    color: theme.splash.body,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: theme.space.md,
  },
  dots: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginBottom: theme.space.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.splash.dot,
  },
  dotActive: {backgroundColor: theme.splash.dotActive},
});
