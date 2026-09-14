import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import type {Tier} from '../game/leaderboard/tiers';

interface Props {
  tier: Tier;
  size?: number;
  /** Plays the earn-it animation: a pop with a ring flaring out behind it. */
  celebrate?: boolean;
  celebrateDelayMs?: number;
}

/**
 * The badge itself — a gradient shield in the tier's colours.
 *
 * Drawn rather than shipped as an image, so a new tier is a row in `TIERS` and not a
 * round of asset work, and so every badge scales to whatever size its caller needs
 * without a second file.
 */
export function TierBadge({
  tier,
  size = 64,
  celebrate = false,
  celebrateDelayMs = 0,
}: Props): React.JSX.Element {
  const pop = useSharedValue(celebrate ? 0 : 1);
  const flare = useSharedValue(0);

  useEffect(() => {
    if (!celebrate) {
      pop.value = 1;
      return;
    }
    pop.value = withDelay(
      celebrateDelayMs,
      // Overshoot and settle: a badge that simply fades in does not read as earned.
      withSequence(
        withTiming(1.25, {duration: 260, easing: Easing.out(Easing.back(2))}),
        withTiming(1, {duration: 180}),
      ),
    );
    flare.value = withDelay(
      celebrateDelayMs,
      withTiming(1, {duration: 620, easing: Easing.out(Easing.quad)}),
    );
  }, [celebrate, celebrateDelayMs, pop, flare]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{scale: pop.value}],
    opacity: Math.min(1, pop.value * 1.6),
  }));

  const flareStyle = useAnimatedStyle(() => ({
    opacity: (1 - flare.value) * 0.55,
    transform: [{scale: 1 + flare.value * 1.1}],
  }));

  return (
    <View style={{width: size, height: size}}>
      {celebrate && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flare,
            {
              borderRadius: size / 2,
              borderColor: tier.colour,
              borderWidth: Math.max(2, size * 0.05),
            },
            flareStyle,
          ]}
        />
      )}
      <Animated.View style={[styles.fill, badgeStyle]}>
        <LinearGradient
          colors={[tier.colour, tier.shade]}
          start={{x: 0.2, y: 0}}
          end={{x: 0.8, y: 1}}
          style={[
            styles.shield,
            {borderRadius: size * 0.28, padding: size * 0.09},
          ]}>
          <View style={[styles.inner, {borderRadius: size * 0.2}]}>
            <Text style={[styles.glyph, {fontSize: size * 0.42}]}>
              {tier.label.charAt(0)}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** The badge with its name and a bar showing how far into the tier the player is. */
export function TierProgress({
  tier,
  next,
  progress,
  remaining,
  celebrate,
  celebrateDelayMs,
  fillDelayMs = 0,
}: {
  tier: Tier;
  next: Tier | null;
  progress: number;
  remaining: number;
  celebrate?: boolean;
  celebrateDelayMs?: number;
  fillDelayMs?: number;
}): React.JSX.Element {
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      fillDelayMs,
      withTiming(progress, {duration: 720, easing: Easing.out(Easing.cubic)}),
    );
  }, [progress, fillDelayMs, fill]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(2, fill.value * 100)}%`,
  }));

  return (
    <View style={styles.progressRow}>
      <TierBadge
        tier={tier}
        size={54}
        celebrate={celebrate}
        celebrateDelayMs={celebrateDelayMs}
      />
      <View style={styles.progressBody}>
        <Text style={[styles.tierName, {color: tier.colour}]}>
          {tier.label}
        </Text>
        <View style={styles.track}>
          <Animated.View
            style={[styles.bar, {backgroundColor: tier.colour}, barStyle]}
          />
        </View>
        <Text style={styles.toNext}>
          {next
            ? `${remaining.toLocaleString()} to ${next.label}`
            : 'TOP OF THE LADDER'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  flare: {...StyleSheet.absoluteFillObject},
  shield: {width: '100%', height: '100%'},
  inner: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    ...typography.display(20),
    color: '#0A0F1C',
    lineHeight: undefined,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    alignSelf: 'stretch',
  },
  progressBody: {flex: 1, gap: 6},
  tierName: {...typography.ui(13), letterSpacing: 2.5},
  track: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  bar: {height: '100%', borderRadius: theme.radius.pill},
  toNext: {...typography.body(11), color: theme.text.dim, letterSpacing: 0.6},
});
