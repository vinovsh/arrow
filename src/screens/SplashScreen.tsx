import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
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
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Wordmark} from '../components/Wordmark';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
import {preloadAround} from '../game/levels';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * §5.1 — the brief says auto-advance in 1.5-2s, the storyboard shows TAP TO START.
 * Both ship: auto-advance at 1.8s, tap skips immediately, the label pulses. Packs,
 * save data and audio all preload behind the animation.
 */
const AUTO_ADVANCE_MS = 1800;
const DRIFTING_ARROWS = 9;

export function SplashScreen({navigation}: Props): React.JSX.Element {
  const {width, height} = useWindowDimensions();
  const advanced = useRef(false);
  const pulse = useSharedValue(0);

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
    const boot = async (): Promise<void> => {
      const data = await SaveStore.load();
      preloadAround(data.currentLevel);
      await Audio.preload();
      Audio.startMusic();
      if (!cancelled) {
        // Never advance before the work is done, even if 1.8s has already passed.
        go();
      }
    };
    const timer = setTimeout(() => {
      if (SaveStore.isLoaded) {
        go();
      }
    }, AUTO_ADVANCE_MS);
    void boot();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [go]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 700, easing: Easing.inOut(Easing.sin)}),
        withTiming(0, {duration: 700, easing: Easing.inOut(Easing.sin)}),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const promptStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
  }));

  const drifters = useMemo(
    () =>
      Array.from({length: DRIFTING_ARROWS}, (_, i) => ({
        key: i,
        x: (width / DRIFTING_ARROWS) * i + Math.random() * 30,
        y: Math.random() * height,
        colour: Object.values(theme.arrow)[i % 8],
        delay: i * 220,
        duration: 5200 + Math.random() * 2600,
        glyph: ['↑', '→', '↓', '←'][i % 4],
        size: 18 + Math.random() * 16,
      })),
    [width, height],
  );

  return (
    <Pressable style={styles.root} onPress={go} accessibilityRole="button">
      {drifters.map(({key, ...drifter}) => (
        <Drifter key={key} {...drifter} travel={height} />
      ))}

      <SafeAreaView style={styles.safe}>
        <View style={styles.centre}>
          <Wordmark size={46} tagline />
        </View>

        {/* §5.1 — faint dotted silhouettes at the base. */}
        <View style={styles.silhouettes} pointerEvents="none">
          <Text style={styles.silhouette}>⌁</Text>
          <Text style={styles.silhouette}>⬢</Text>
          <Text style={styles.silhouette}>◈</Text>
        </View>

        <Animated.Text style={[styles.prompt, promptStyle]}>
          TAP TO START »
        </Animated.Text>
      </SafeAreaView>
    </Pressable>
  );
}

function Drifter({
  x,
  y,
  colour,
  delay,
  duration,
  glyph,
  size,
  travel,
}: {
  x: number;
  y: number;
  colour: string;
  delay: number;
  duration: number;
  glyph: string;
  size: number;
  travel: number;
}): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, {duration, easing: Easing.linear}), -1, false),
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.18 + Math.sin(progress.value * Math.PI) * 0.22,
    transform: [
      {translateX: x},
      {translateY: y - progress.value * travel * 0.6},
    ],
  }));

  return (
    <Animated.Text
      style={[styles.drifter, {color: colour, fontSize: size}, style]}>
      {glyph}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  safe: {flex: 1, alignItems: 'center', justifyContent: 'space-between'},
  centre: {flex: 1, justifyContent: 'center'},
  drifter: {position: 'absolute', left: 0, top: 0},
  silhouettes: {flexDirection: 'row', gap: theme.space.xl, opacity: 0.12},
  silhouette: {fontSize: 46, color: theme.text.primary},
  prompt: {
    ...typography.ui(15),
    color: theme.text.secondary,
    letterSpacing: 2.5,
    marginBottom: theme.space.xl,
  },
});
