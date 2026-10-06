import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {ClickPressable} from './ClickPressable';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {TierBadge} from './TierBadge';
import {Hills} from './LevelCompleteOverlay';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import type {BoardRow, Climb} from '../game/leaderboard/board';
import type {Tier} from '../game/leaderboard/tiers';

interface Props {
  visible: boolean;
  climb: Climb;
  onNext: () => void;
  /** Omitted when there is nowhere else to go — browsing from Home, say. */
  onHome?: () => void;
  /** Defaults to NEXT LEVEL; 'CLOSE' when the board is simply being looked at. */
  primaryLabel?: string;
}

/**
 * §9.4 — the standings, and the player moving through them.
 *
 * The timeline, which is the whole design:
 *
 *   0.00  the board enters (see INTRO), drawn as it stood *before* the level
 *   0.95  the player's score counts up and the rows re-sort around them
 *   1.80  the tier bar fills; a new badge pops if one was earned
 *   2.25  NEXT LEVEL becomes interactive, and starts gently pulsing
 *
 * Tapping anywhere fast-forwards, the same as the level-complete overlay: a player on
 * their fortieth level should never be made to watch the whole thing.
 *
 * The look follows the leaderboard mock: a copper trophy over an arched wooden plank
 * carrying the league name, a season pill and a ribbon, the standings as navy cards
 * with the player's row lit gold, the badge with its crown and bar, and a green
 * NEXT LEVEL pill over HOME — on the same night-sky-and-hills ground as the
 * level-complete screen it follows.
 *
 * Rendered as an in-tree layer, not a `Modal` — on Android a Modal's content lives in
 * its own window outside `GestureHandlerRootView`, which swallows every touch inside
 * it (see the note in LevelCompleteOverlay).
 */
/**
 * The entrance, before any of that: one clock (`intro`, 0 → 1 over INTRO_MS) that
 * every piece reads its own window from, so tap-to-skip finishes all of it by setting
 * one value.
 *
 *   0.00 header drops in · 0.15 season pill · 0.25-0.80 rows slide in, 45ms apart
 *   0.55 badge block · 0.65 buttons — and only then does the climb start
 */
const INTRO_MS = 900;
const INTRO = {
  header: [0, 0.5],
  pill: [0.17, 0.5],
  rows: [0.28, 0.6],
  rowStagger: 0.05,
  tier: [0.6, 0.9],
  buttons: [0.7, 1],
} as const;
const T_CLIMB = 950;
const T_TIER = 1800;
const T_INTERACTIVE = 2250;
const CLIMB_MS = 780;
const COUNT_MS = 760;
const ROW_H = 60;
const CARD_H = ROW_H - 6;

export function LeaderboardOverlay({
  visible,
  climb,
  onNext,
  onHome,
  primaryLabel = 'NEXT LEVEL',
}: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const {height, fontScale} = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(height);
  const usableHeight =
    Math.min(height, layoutHeight) - insets.top - insets.bottom;
  const showDetails = usableHeight >= 400 && fontScale <= 1.5;
  const showTier = usableHeight >= 560 && fontScale <= 1.3;
  const rowHeight = Math.max(ROW_H, Math.ceil(40 * fontScale));
  // Reserve the title, ribbon, column labels, controls and optional tier card.
  const rowCount = Math.max(
    1,
    Math.min(
      7,
      Math.floor(
        (usableHeight -
          (showDetails ? 230 : 150) * Math.max(1, fontScale) -
          (showTier ? 112 : 0)) /
          rowHeight,
      ),
    ),
  );
  const from = climb.before.rows.find(row => row.isPlayer)?.score ?? 0;
  const to = climb.after.rows.find(row => row.isPlayer)?.score ?? 0;
  // Nothing was won, so there is nothing to play: the board opens settled and the
  // button works at once. This is the same component simply being read rather than
  // celebrated, which is what Home wants.
  const still = climb.gained === 0 && !climb.promoted && !climb.tierUpgraded;

  const [elapsed, setElapsed] = useState(still ? T_INTERACTIVE : 0);
  const [shownScore, setShownScore] = useState(from);
  /** Set by tap-to-skip: every piece jumps to where it would have ended up. */
  const [skipped, setSkipped] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intro = useSharedValue(0);
  const ready = elapsed >= T_INTERACTIVE;

  // The rows to draw, and where each of them started. A promotion has no climb to
  // show — the player is in a different field entirely — so the new league is drawn
  // at rest and the promotion banner carries the moment instead.
  const {rows, offsets} = useMemo(() => {
    // Keep the player's final rank visible even after a large climb.
    const first = Math.max(
      0,
      Math.min(
        climb.after.playerRank - 1 - Math.floor(rowCount / 2),
        climb.after.rows.length - rowCount,
      ),
    );
    const visibleRows = climb.after.rows.slice(first, first + rowCount);
    const beforeRankById = new Map(
      climb.before.rows.map(row => [row.id, row.rank]),
    );
    const shift = new Map<string, number>();
    for (const row of visibleRows) {
      const wasRank = climb.promoted
        ? row.rank
        : beforeRankById.get(row.id) ?? row.rank;
      // Distance in rows between where it sat and where it ends up. Every row is
      // rendered at its *after* position and pushed back by this, so the board opens
      // in its old shape and settles into the new one.
      const initialIndex = Math.max(
        0,
        Math.min(visibleRows.length - 1, wasRank - visibleRows[0].rank),
      );
      shift.set(
        row.id,
        (initialIndex - (row.rank - visibleRows[0].rank)) * rowHeight,
      );
    }
    return {rows: visibleRows, offsets: shift};
  }, [climb, rowCount, rowHeight]);

  const finish = React.useCallback(() => {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current = [];
    setElapsed(T_INTERACTIVE);
    setShownScore(to);
    setSkipped(true);
    cancelAnimation(intro);
    intro.value = 1;
  }, [to, intro]);

  // The entrance plays every time the board opens — from Home too, where there is
  // no climb after it.
  useEffect(() => {
    if (!visible) {
      intro.value = 0;
      setSkipped(false);
      return;
    }
    intro.value = 0;
    intro.value = withTiming(1, {duration: INTRO_MS, easing: Easing.linear});
  }, [visible, intro]);

  useEffect(() => {
    if (!visible || still) {
      setElapsed(still ? T_INTERACTIVE : 0);
      setShownScore(still ? to : from);
      return;
    }

    setShownScore(from);
    const schedule = (at: number, fn: () => void): void => {
      timers.current.push(setTimeout(fn, at));
    };

    schedule(T_CLIMB, () => {
      Audio.play('score_tick');
      const started = Date.now();
      const tick = (): void => {
        const t = Math.min(1, (Date.now() - started) / COUNT_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setShownScore(Math.round(from + (to - from) * eased));
        if (t < 1) {
          timers.current.push(setTimeout(tick, 32));
        }
      };
      tick();
      Haptics.light();
    });

    if (climb.promoted || climb.tierUpgraded) {
      schedule(T_TIER, () => {
        Audio.play('level_complete');
        Haptics.medium();
      });
    }

    schedule(T_INTERACTIVE, () => setElapsed(T_INTERACTIVE));

    return () => {
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
      timers.current = [];
    };
  }, [visible, still, from, to, climb.promoted, climb.tierUpgraded]);

  if (!visible) {
    return null;
  }

  const days = Math.floor(climb.after.season.msRemaining / 86400000);
  const hours = Math.floor(
    (climb.after.season.msRemaining % 86400000) / 3600000,
  );

  const ribbon: RibbonProps = climb.promoted
    ? {
        label: `PROMOTED TO ${climb.after.leagueName}`,
        kind: 'promoted',
        delayMs: T_TIER,
      }
    : climb.placesGained > 0
    ? {
        label: `UP ${climb.placesGained} PLACE${
          climb.placesGained === 1 ? '' : 'S'
        }`,
        kind: 'up',
        delayMs: T_CLIMB + 260,
      }
    : {
        label: still
          ? `RANK #${climb.after.playerRank} OF ${climb.after.rows.length}`
          : `RANK #${climb.after.playerRank} — HOLDING`,
        kind: 'hold',
        delayMs: still ? 0 : T_CLIMB + 260,
      };

  const standing = climb.after.tier;

  return (
    <View
      style={styles.root}
      onLayout={event => setLayoutHeight(event.nativeEvent.layout.height)}>
      <LinearGradient
        colors={[...theme.reward.bg]}
        style={StyleSheet.absoluteFill}
      />
      <Hills />
      <View
        style={[
          styles.scroll,
          {
            paddingTop: insets.top + theme.space.sm,
            paddingBottom: insets.bottom + theme.space.md,
          },
        ]}>
        <Pressable style={styles.content} onPress={ready ? undefined : finish}>
          <Reveal intro={intro} range={INTRO.header} kind="drop">
            <LeagueHeader league={climb.after.leagueName} />
          </Reveal>
          {showDetails && (
            <Reveal
              intro={intro}
              range={INTRO.pill}
              kind="up"
              style={styles.seasonPill}>
              <PinIcon />
              <Text style={styles.season}>
                SEASON ENDS IN {days}d {hours}h
              </Text>
            </Reveal>
          )}

          {showDetails && (
            <Ribbon
              {...ribbon}
              delayMs={still ? INTRO_MS * 0.55 : ribbon.delayMs}
              skipped={skipped}
            />
          )}

          <View style={styles.tableHeading}>
            <Text style={styles.tableLabel}>THE LEAGUE</Text>
            <Text style={styles.tableLabel}>POINTS</Text>
          </View>
          <View style={[styles.board, {height: rows.length * rowHeight}]}>
            {rows.map((row, i) => (
              <LeagueRow
                key={row.id}
                row={row}
                intro={intro}
                index={i}
                skipped={skipped}
                top={(row.rank - rows[0].rank) * rowHeight}
                rowHeight={rowHeight}
                offset={still ? 0 : offsets.get(row.id) ?? 0}
                score={row.isPlayer ? shownScore : row.score}
                gained={row.isPlayer ? climb.gained : 0}
              />
            ))}
          </View>

          {showTier && (
            <TierBlock
              intro={intro}
              fillDelayMs={still ? INTRO_MS : T_TIER}
              skipped={skipped}
              tier={standing.tier}
              next={standing.next}
              progress={standing.progress}
              remaining={standing.remaining}
              celebrate={climb.tierUpgraded}
            />
          )}
          {showTier && climb.tierUpgraded && (
            <Text style={styles.tierUp}>
              BADGE UPGRADED — {standing.tier.label}
            </Text>
          )}

          <Reveal
            intro={intro}
            range={INTRO.buttons}
            kind="up"
            style={styles.buttons}>
            <NextButton
              label={primaryLabel}
              arrow={primaryLabel !== 'CLOSE'}
              onPress={onNext}
              disabled={!ready}
            />
            {onHome && (
              <ClickPressable
                onPress={ready ? onHome : finish}
                accessibilityRole="button"
                accessibilityLabel="Home"
                style={[styles.home, !ready && styles.dimmed]}>
                <HomeIcon />
                <Text style={styles.homeLabel}>HOME</Text>
              </ClickPressable>
            )}
          </Reveal>
        </Pressable>
      </View>
    </View>
  );
}

/** Ease-out with a small overshoot (easeOutBack), as a worklet. */
function backOut(t: number): number {
  'worklet';
  const c1 = 1.70158;
  const u = t - 1;
  return 1 + (c1 + 1) * u * u * u + c1 * u * u;
}

function cubicOut(t: number): number {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

/** Local 0..1 progress of `intro` through the window [a, b]. */
function windowOf(intro: number, a: number, b: number): number {
  'worklet';
  return interpolate(intro, [a, b], [0, 1], Extrapolation.CLAMP);
}

/**
 * One piece of the entrance: `drop` falls in from above with a bounce, `up` rises
 * into place.
 */
function Reveal({
  intro,
  range,
  kind,
  style,
  children,
}: {
  intro: SharedValue<number>;
  range: readonly [number, number];
  kind: 'drop' | 'up';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}): React.JSX.Element {
  const [a, b] = range;
  const animated = useAnimatedStyle(() => {
    const t = windowOf(intro.value, a, b);
    if (kind === 'drop') {
      const e = backOut(t);
      return {
        opacity: Math.min(1, t * 2.5),
        transform: [{translateY: (1 - e) * -50}, {scale: 0.85 + e * 0.15}],
      };
    }
    const e = cubicOut(t);
    return {opacity: t, transform: [{translateY: (1 - e) * 18}]};
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** One standings row, sliding from where it was to where it ended up. */
function LeagueRow({
  row,
  intro,
  index,
  skipped,
  top,
  rowHeight,
  offset,
  score,
  gained,
}: {
  row: BoardRow;
  intro: SharedValue<number>;
  index: number;
  skipped: boolean;
  top: number;
  rowHeight: number;
  offset: number;
  score: number;
  gained: number;
}): React.JSX.Element {
  const shift = useSharedValue(offset);
  const lift = useSharedValue(0);
  const glow = useSharedValue(0);

  // The player's row breathes: a gold halo swelling and fading, for as long as the
  // board is up.
  useEffect(() => {
    if (!row.isPlayer) {
      return;
    }
    glow.value = withRepeat(
      withTiming(1, {duration: 1100, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
    return () => cancelAnimation(glow);
  }, [row.isPlayer, glow]);

  useEffect(() => {
    if (skipped) {
      cancelAnimation(shift);
      cancelAnimation(lift);
      shift.value = 0;
      lift.value = 0;
      return;
    }
    shift.value = offset;
    shift.value = withDelay(
      T_CLIMB,
      withTiming(0, {duration: CLIMB_MS, easing: Easing.inOut(Easing.cubic)}),
    );
    if (row.isPlayer && offset !== 0) {
      // The player's row lifts slightly as it moves, so the eye follows it rather
      // than the rows sliding the other way.
      lift.value = withDelay(
        T_CLIMB,
        withSequence(
          withTiming(1, {duration: CLIMB_MS * 0.45}),
          withTiming(0, {duration: CLIMB_MS * 0.55}),
        ),
      );
    }
  }, [offset, skipped, row.isPlayer, shift, lift]);

  const [a, b] = INTRO.rows;
  const delay = index * INTRO.rowStagger;
  const style = useAnimatedStyle(() => {
    // Rows slide in from the right one after another, overshooting a touch.
    const t = windowOf(intro.value, a + delay, b + delay);
    const e = backOut(t);
    return {
      opacity: Math.min(1, t * 2),
      transform: [
        {translateX: (1 - e) * 80},
        {translateY: shift.value},
        {scale: 1 + lift.value * 0.04},
      ],
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.32,
    transform: [
      {scaleX: 1 + glow.value * 0.015},
      {scaleY: 1 + glow.value * 0.08},
    ],
  }));

  const body = (
    <>
      <View style={[styles.rankChip, row.isPlayer && styles.rankChipPlayer]}>
        <Text style={[styles.rank, row.isPlayer && styles.rankPlayer]}>
          {row.rank <= 3 && !row.isPlayer
            ? ['🥇', '🥈', '🥉'][row.rank - 1]
            : row.rank}
        </Text>
      </View>
      <View style={[styles.avatar, {borderColor: row.colour}]}>
        <Text style={styles.face}>{row.face}</Text>
        {row.playingNow && (
          <View
            style={[styles.onlineDot, row.isPlayer && styles.onlineDotPlayer]}
          />
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.name, row.isPlayer && styles.namePlayer]}>
        {row.name}
      </Text>
      <View style={styles.scoreColumn}>
        {row.isPlayer && gained > 0 && (
          <View style={styles.gainBox}>
            <UpArrow size={14} />
            <Text style={styles.gain}>+{gained.toLocaleString()}</Text>
          </View>
        )}
        <Text style={[styles.score, row.isPlayer && styles.scorePlayer]}>
          {score.toLocaleString()}
        </Text>
      </View>
    </>
  );

  if (!row.isPlayer) {
    return (
      <Animated.View
        style={[styles.row, styles.card, {top, height: rowHeight - 6}, style]}>
        {body}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.playerWrap, {top, height: rowHeight - 6}, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.playerHalo, haloStyle]}
      />
      <LinearGradient
        colors={[theme.bg.panelAlt, '#FCE8EF', '#FFF5E9']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[styles.row, styles.playerCard, {height: rowHeight - 6}]}>
        {body}
      </LinearGradient>
      <Sparkle style={styles.sparkTL} size={16} phase={0} />
      <Sparkle style={styles.sparkBL} size={10} phase={500} />
      <Sparkle style={styles.sparkTR} size={16} phase={250} />
      <Sparkle style={styles.sparkBR} size={10} phase={750} />
    </Animated.View>
  );
}

interface RibbonProps {
  label: string;
  kind: 'up' | 'promoted' | 'hold';
  delayMs: number;
  skipped?: boolean;
}

const RIBBON_COLOURS = {
  up: theme.button.play,
  promoted: ['#75B6A7', '#458D7C'],
  hold: ['#AF92D4', '#8961CB'],
} as const;

/** The swallow-tailed ribbon under the season pill: blue for a climb. */
function Ribbon({
  label,
  kind,
  delayMs,
  skipped = false,
}: RibbonProps): React.JSX.Element {
  const shown = useSharedValue(0);
  useEffect(() => {
    if (skipped) {
      cancelAnimation(shown);
      shown.value = 1;
      return;
    }
    // Unfurls from the centre: stretched in wide, overshooting, then settling.
    shown.value = withDelay(
      delayMs,
      withTiming(1, {duration: 420, easing: Easing.out(Easing.back(2.2))}),
    );
  }, [delayMs, skipped, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value * 2),
    transform: [
      {scaleX: 0.3 + shown.value * 0.7},
      {scaleY: 0.7 + shown.value * 0.3},
    ],
  }));
  const [light, dark] = RIBBON_COLOURS[kind];
  // An absolutely-filled Svg without explicit dimensions sizes itself from its
  // viewBox rather than the ribbon, so the shape is drawn at the measured size.
  const [size, setSize] = useState({width: 0, height: 0});
  return (
    <Animated.View
      style={[styles.ribbon, style]}
      onLayout={event => {
        const {width, height} = event.nativeEvent.layout;
        setSize({width, height});
      }}>
      <Svg
        style={styles.ribbonShape}
        width={size.width}
        height={size.height}
        viewBox="0 0 240 44"
        preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="ribbonFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="1" stopColor={dark} />
          </SvgGradient>
        </Defs>
        <Path
          d="M2 4 H238 L228 22 L238 40 H2 L12 22Z"
          fill="url(#ribbonFill)"
        />
        <Path
          d="M16 8 H224"
          stroke="#FFFFFF"
          strokeOpacity={0.3}
          strokeWidth={2}
        />
      </Svg>
      {kind !== 'hold' && <UpArrow size={20} />}
      <Text style={styles.ribbonLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** The badge with a crown and laurels, its name, and the bar to the next tier. */
function TierBlock({
  intro,
  fillDelayMs,
  skipped,
  tier,
  next,
  progress,
  remaining,
  celebrate,
}: {
  intro: SharedValue<number>;
  fillDelayMs: number;
  skipped: boolean;
  tier: Tier;
  next: Tier | null;
  progress: number;
  remaining: number;
  celebrate: boolean;
}): React.JSX.Element {
  const fill = useSharedValue(0);
  const shine = useSharedValue(0);
  const badgeBob = useSharedValue(0);

  useEffect(() => {
    if (skipped) {
      cancelAnimation(fill);
      fill.value = progress;
      return;
    }
    fill.value = withDelay(
      fillDelayMs,
      withTiming(progress, {duration: 720, easing: Easing.out(Easing.cubic)}),
    );
  }, [progress, fillDelayMs, skipped, fill]);

  // A glint that runs along the bar once it has filled, then every few seconds;
  // and the badge floats gently the whole time.
  useEffect(() => {
    shine.value = withDelay(
      fillDelayMs + 700,
      withRepeat(
        withSequence(
          withTiming(1, {duration: 750, easing: Easing.inOut(Easing.quad)}),
          withDelay(2200, withTiming(0, {duration: 0})),
        ),
        -1,
      ),
    );
    badgeBob.value = withRepeat(
      withTiming(1, {duration: 1600, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
    return () => {
      cancelAnimation(shine);
      cancelAnimation(badgeBob);
    };
  }, [fillDelayMs, shine, badgeBob]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(3, fill.value * 100)}%`,
  }));
  const shineStyle = useAnimatedStyle(() => ({
    left: `${-40 + shine.value * 150}%`,
    opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
  }));
  const [a, b] = INTRO.tier;
  const enterStyle = useAnimatedStyle(() => {
    const e = cubicOut(windowOf(intro.value, a, b));
    return {opacity: e, transform: [{translateX: (1 - e) * -40}]};
  });
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -3 * badgeBob.value}],
  }));

  return (
    <Animated.View style={[styles.tierRow, enterStyle]}>
      <View style={styles.badgeBox}>
        <Svg
          width={80}
          height={80}
          viewBox="0 0 96 96"
          style={StyleSheet.absoluteFill}>
          {/* Laurels cupping the badge from below. */}
          {[1, -1].map(side => (
            <G
              key={side}
              transform={
                side === -1 ? 'translate(96 0) scale(-1 1)' : undefined
              }>
              {[
                [12, 60, -40],
                [16, 74, -10],
                [28, 86, 25],
              ].map(([x, y, r], i) => (
                <Path
                  key={i}
                  d="M0 0 C-5 -9 -2 -17 5 -20 C8 -12 7 -5 0 0Z"
                  fill={i % 2 ? LEAF_DARK : LEAF_LIGHT}
                  transform={`translate(${x} ${y}) rotate(${r - 90})`}
                />
              ))}
            </G>
          ))}
        </Svg>
        <Animated.View style={bobStyle}>
          <TierBadge
            tier={tier}
            size={54}
            celebrate={celebrate}
            celebrateDelayMs={T_TIER}
          />
        </Animated.View>
        <Svg width={26} height={20} viewBox="0 0 32 24" style={styles.crown}>
          <Path
            d="M3 21 L5 7 L11 13 L16 3 L21 13 L27 7 L29 21Z"
            fill="#FFC53D"
            stroke="#B7790A"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={styles.tierBody}>
        <Text style={[styles.tierName, {color: tier.colour}]}>
          {tier.label}
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, barStyle]}>
            <LinearGradient
              colors={['#FFE27A', '#FFC53D', '#F59E0B']}
              start={{x: 0, y: 0}}
              end={{x: 0, y: 1}}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.shine, shineStyle]} />
          </Animated.View>
        </View>
        <Text style={[styles.toNext, {color: tier.colour}]}>
          {next
            ? `${remaining.toLocaleString()} to ${next.label}`
            : 'TOP OF THE LADDER'}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Green pill with spark strokes either side, pressed down 4% on touch. */
function NextButton({
  label,
  arrow,
  onPress,
  disabled,
}: {
  label: string;
  arrow: boolean;
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  const pressed = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Once it can be pressed, it invites the press: a slow swell, and the sparks
  // either side flicker in time with it.
  useEffect(() => {
    if (disabled) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, {duration: 150});
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {duration: 700, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [disabled, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [
      {scale: (1 + pulse.value * 0.045) * (1 - pressed.value * 0.05)},
    ],
  }));
  return (
    <View style={styles.nextRow}>
      <Sparks pulse={pulse} />
      <Animated.View style={[styles.nextWrap, style]}>
        <ClickPressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{disabled}}
          disabled={disabled}
          onPressIn={() => {
            pressed.value = withTiming(1, {duration: 90});
            Haptics.selection();
          }}
          onPressOut={() => {
            pressed.value = withTiming(0, {duration: 90});
          }}
          onPress={onPress}>
          <LinearGradient
            colors={[...theme.button.play]}
            start={{x: 0, y: 0}}
            end={{x: 0, y: 1}}
            style={[styles.next, disabled && styles.dimmed]}>
            <View style={styles.nextGloss} />
            <Text style={styles.nextLabel}>{label}</Text>
            {arrow && <NextArrow />}
          </LinearGradient>
        </ClickPressable>
      </Animated.View>
      <Sparks pulse={pulse} flipped />
    </View>
  );
}

// ------------------------------------------------------------------ artwork

const LEAF_LIGHT = theme.button.settings[0];
const LEAF_DARK = theme.button.settings[1];

/** Copper trophy between laurels, over an arched wooden plank bearing the name. */
function LeagueHeader({league}: {league: string}): React.JSX.Element {
  return (
    <View style={styles.compactHeader}>
      <Text style={styles.headerTitle}>Leaderboard</Text>
      <Text style={styles.headerSubtitle}>{league} league</Text>
    </View>
  );
}

/** A four-point twinkle centred on (x, y). */
function sparklePath(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return (
    `M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} ` +
    `Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} ` +
    `Q${x - k} ${y - k} ${x} ${y - r}Z`
  );
}

/** A twinkle that keeps twinkling: grows, turns a little, shrinks, out of phase. */
function Sparkle({
  style,
  size,
  phase,
}: {
  style: StyleProp<ViewStyle>;
  size: number;
  phase: number;
}): React.JSX.Element {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      phase,
      withRepeat(
        withTiming(1, {duration: 900, easing: Easing.inOut(Easing.sin)}),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [phase, t]);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [{scale: 0.55 + t.value * 0.55}, {rotate: `${t.value * 45}deg`}],
  }));
  return (
    <Animated.View
      style={[styles.sparkle, style, animated]}
      pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d={sparklePath(10, 10, 10)} fill="#FFD34A" />
      </Svg>
    </Animated.View>
  );
}

function Sparks({
  pulse,
  flipped = false,
}: {
  pulse: SharedValue<number>;
  flipped?: boolean;
}): React.JSX.Element {
  const animated = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [
      {scaleX: flipped ? -1 : 1},
      {translateX: -pulse.value * 3},
      {scale: 0.9 + pulse.value * 0.15},
    ],
  }));
  return (
    <Animated.View style={animated}>
      <Svg width={28} height={48} viewBox="0 0 28 48">
        {['M22 8 L14 14', 'M24 24 H12', 'M22 40 L14 34'].map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke="#FFD34A"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

function PinIcon(): React.JSX.Element {
  return (
    <Svg width={14} height={18} viewBox="0 0 14 18">
      <Path
        d="M7 0 C3 0 0 3 0 7 C0 12 7 18 7 18 C7 18 14 12 14 7 C14 3 11 0 7 0Z"
        fill="#3DDC84"
      />
      <Rect x={4.5} y={4.5} width={5} height={5} rx={2.5} fill="#15245A" />
    </Svg>
  );
}

function UpArrow({size}: {size: number}): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 1 L19 11 H13.5 V19 H6.5 V11 H1Z" fill="#3DDC84" />
    </Svg>
  );
}

function NextArrow(): React.JSX.Element {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d="M3 10 H13 V4 L23 13 L13 22 V16 H3Z"
        fill="#FFFFFF"
        stroke="#1B7A36"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HomeIcon(): React.JSX.Element {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M12 2 L23 12 H20 V22 H14.5 V15.5 H9.5 V22 H4 V12 H1Z"
        fill="#8FB8FF"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tableHeading: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tableLabel: {
    ...typography.ui(10),
    color: theme.text.secondary,
    letterSpacing: 1.4,
  },
  compactHeader: {alignItems: 'center', paddingVertical: 4},
  headerTitle: {...typography.display(24)},
  headerSubtitle: {...typography.ui(12), color: theme.brand.tagline},
  root: {...StyleSheet.absoluteFillObject, zIndex: 45},
  scroll: {flex: 1},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: theme.space.md,
  },
  header: {width: '100%', maxWidth: 250, aspectRatio: 340 / 190},
  seasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: theme.space.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.bg.panelAlt,
    borderWidth: 1.5,
    borderColor: theme.bg.border,
  },
  season: {...typography.ui(11), color: theme.text.primary, letterSpacing: 1},
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    minWidth: 210,
    paddingHorizontal: 34,
    marginVertical: 6,
  },
  ribbonShape: {position: 'absolute', left: 0, top: 0},
  ribbonLabel: {
    ...typography.display(18),
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(8,20,70,0.6)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 1,
  },
  board: {width: '100%', maxWidth: 400},
  row: {
    height: CARD_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 22,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.bg.panel,
    borderWidth: 1.5,
    borderColor: theme.bg.border,
  },
  playerWrap: {position: 'absolute', left: -4, right: -4, height: CARD_H},
  playerHalo: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -6,
    bottom: -6,
    borderRadius: 22,
    backgroundColor: theme.button.levels[0],
  },
  playerCard: {
    borderWidth: 2.5,
    borderColor: theme.button.play[0],
    shadowColor: theme.brand.tagline,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 0},
    elevation: 10,
  },
  rankChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.bg.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankChipPlayer: {backgroundColor: theme.button.play[1]},
  rank: {...typography.display(15), color: theme.text.secondary},
  rankPlayer: {color: '#FFF4DC'},
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF0FF',
  },
  face: {fontSize: 18},
  onlineDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3DDC84',
    borderWidth: 2,
    borderColor: theme.bg.panel,
  },
  onlineDotPlayer: {borderColor: theme.bg.panelAlt},
  name: {...typography.ui(14), color: theme.text.primary, flex: 1},
  namePlayer: {...typography.display(16), color: theme.text.primary},
  scoreColumn: {alignItems: 'flex-end', gap: 2},
  gainBox: {flexDirection: 'row', alignItems: 'center', gap: 2},
  gain: {...typography.display(11), color: '#458D7C'},
  score: {...typography.display(16), color: theme.text.primary},
  scorePlayer: {fontSize: 17, color: theme.button.play[1]},
  sparkle: {position: 'absolute'},
  sparkTL: {left: -9, top: -9},
  sparkBL: {left: 4, bottom: -7},
  sparkTR: {right: -9, top: -9},
  sparkBR: {right: 4, bottom: -7},
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    width: '100%',
    maxWidth: 380,
    marginTop: 8,
    padding: 8,
    borderRadius: 24,
    backgroundColor: theme.bg.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
  },
  badgeBox: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crown: {
    position: 'absolute',
    left: 6,
    top: 2,
    transform: [{rotate: '-20deg'}],
  },
  tierBody: {flex: 1, gap: 6},
  tierName: {...typography.display(18), letterSpacing: 1.5},
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.bg.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
    overflow: 'hidden',
  },
  bar: {height: '100%', borderRadius: 7, overflow: 'hidden'},
  shine: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{skewX: '-20deg'}],
  },
  toNext: {...typography.ui(14), opacity: 0.9},
  tierUp: {
    ...typography.ui(12),
    color: theme.state.success,
    letterSpacing: 1.8,
    textAlign: 'center',
    marginTop: 4,
  },
  buttons: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 8,
  },
  nextRow: {
    flex: 1,
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextWrap: {flex: 1},
  next: {
    height: 56,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: theme.button.play[0],
    shadowColor: theme.brand.tagline,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  nextGloss: {
    position: 'absolute',
    top: 5,
    left: 28,
    right: 28,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  nextLabel: {
    ...typography.display(17),
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: theme.button.play[1],
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 1,
  },
  home: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.bg.panelAlt,
    borderWidth: 1.5,
    borderColor: theme.bg.border,
  },
  homeLabel: {
    ...typography.display(17),
    color: theme.text.primary,
    letterSpacing: 1,
  },
  dimmed: {opacity: 0.45},
});
