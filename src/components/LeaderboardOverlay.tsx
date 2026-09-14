import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
import {Button} from './Button';
import {TierProgress} from './TierBadge';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import type {BoardRow, Climb} from '../game/leaderboard/board';
import {windowAround} from '../game/leaderboard/board';

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
 *   0.00  the board is drawn exactly as it stood *before* the level
 *   0.45  the player's score counts up and the rows re-sort around them
 *   1.30  the tier bar fills; a new badge pops if one was earned
 *   1.75  NEXT LEVEL becomes interactive
 *
 * Tapping anywhere fast-forwards, the same as the level-complete overlay: a player on
 * their fortieth level should never be made to watch the whole thing.
 *
 * Rendered as an in-tree layer, not a `Modal` — on Android a Modal's content lives in
 * its own window outside `GestureHandlerRootView`, which swallows every touch inside
 * it (see the note in LevelCompleteOverlay).
 */
const T_CLIMB = 450;
const T_TIER = 1300;
const T_INTERACTIVE = 1750;
const CLIMB_MS = 780;
const COUNT_MS = 760;
const ROW_H = 46;
const WINDOW = 7;

export function LeaderboardOverlay({
  visible,
  climb,
  onNext,
  onHome,
  primaryLabel = 'NEXT LEVEL',
}: Props): React.JSX.Element | null {
  const from = climb.before.rows.find(row => row.isPlayer)?.score ?? 0;
  const to = climb.after.rows.find(row => row.isPlayer)?.score ?? 0;
  // Nothing was won, so there is nothing to play: the board opens settled and the
  // button works at once. This is the same component simply being read rather than
  // celebrated, which is what Home wants.
  const still = climb.gained === 0 && !climb.promoted && !climb.tierUpgraded;

  const [elapsed, setElapsed] = useState(still ? T_INTERACTIVE : 0);
  const [shownScore, setShownScore] = useState(from);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ready = elapsed >= T_INTERACTIVE;

  // The rows to draw, and where each of them started. A promotion has no climb to
  // show — the player is in a different field entirely — so the new league is drawn
  // at rest and the promotion banner carries the moment instead.
  const {rows, offsets} = useMemo(() => {
    const visibleRows = windowAround(
      climb.after,
      climb.promoted ? climb.after.playerRank : climb.before.playerRank,
      WINDOW,
    );
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
      shift.set(row.id, (wasRank - row.rank) * ROW_H);
    }
    return {rows: visibleRows, offsets: shift};
  }, [climb]);

  const finish = React.useCallback(() => {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current = [];
    setElapsed(T_INTERACTIVE);
    setShownScore(to);
  }, [to]);

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

  return (
    <Pressable style={styles.scrim} onPress={ready ? undefined : finish}>
      <View style={styles.header}>
        <Text style={styles.league}>{climb.after.leagueName} LEAGUE</Text>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.season}>
            SEASON ENDS IN {days}d {hours}h
          </Text>
        </View>
      </View>

      {climb.promoted && (
        <Banner
          label={`PROMOTED TO ${climb.after.leagueName}`}
          colour={theme.state.success}
          delayMs={T_TIER}
        />
      )}
      {!climb.promoted && climb.placesGained > 0 && (
        <Banner
          label={`UP ${climb.placesGained} PLACE${
            climb.placesGained === 1 ? '' : 'S'
          }`}
          colour={theme.brand.tagline}
          delayMs={T_CLIMB + 260}
        />
      )}
      {!climb.promoted && climb.placesGained === 0 && (
        <Banner
          label={
            still
              ? `RANK #${climb.after.playerRank} OF ${climb.after.rows.length}`
              : `RANK #${climb.after.playerRank} — HOLDING`
          }
          colour={theme.text.secondary}
          delayMs={still ? 0 : T_CLIMB + 260}
        />
      )}

      <View style={[styles.board, {height: rows.length * ROW_H}]}>
        {rows.map(row => (
          <LeagueRow
            key={row.id}
            row={row}
            top={(row.rank - rows[0].rank) * ROW_H}
            offset={still ? 0 : offsets.get(row.id) ?? 0}
            score={row.isPlayer ? shownScore : row.score}
            gained={row.isPlayer ? climb.gained : 0}
          />
        ))}
      </View>

      <View style={styles.tierBox}>
        <TierProgress
          tier={climb.after.tier.tier}
          next={climb.after.tier.next}
          progress={climb.after.tier.progress}
          remaining={climb.after.tier.remaining}
          celebrate={climb.tierUpgraded}
          celebrateDelayMs={T_TIER}
          fillDelayMs={T_TIER}
        />
        {climb.tierUpgraded && (
          <Text style={styles.tierUp}>
            BADGE UPGRADED — {climb.after.tier.tier.label}
          </Text>
        )}
      </View>

      <View style={styles.buttons}>
        <Button
          label={primaryLabel}
          variant="primary"
          onPress={onNext}
          disabled={!ready}
        />
        {onHome && (
          <Pressable
            onPress={ready ? onHome : finish}
            accessibilityRole="button">
            <Text style={[styles.home, !ready && styles.dimmed]}>HOME</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

/** One standings row, sliding from where it was to where it ended up. */
function LeagueRow({
  row,
  top,
  offset,
  score,
  gained,
}: {
  row: BoardRow;
  top: number;
  offset: number;
  score: number;
  gained: number;
}): React.JSX.Element {
  const shift = useSharedValue(offset);
  const lift = useSharedValue(0);

  useEffect(() => {
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
  }, [offset, row.isPlayer, shift, lift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      {translateY: shift.value},
      {scale: 1 + lift.value * 0.04},
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        {top},
        row.isPlayer && styles.playerRow,
        style,
      ]}>
      <Text style={[styles.rank, row.isPlayer && styles.rankPlayer]}>
        {row.rank}
      </Text>
      <View style={[styles.avatar, {borderColor: row.colour}]}>
        <Text style={styles.face}>{row.face}</Text>
        {row.playingNow && <View style={styles.onlineDot} />}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.name, row.isPlayer && styles.namePlayer]}>
        {row.name}
      </Text>
      {row.isPlayer && gained > 0 && (
        <Text style={styles.gain}>+{gained.toLocaleString()}</Text>
      )}
      <Text style={[styles.score, row.isPlayer && styles.scorePlayer]}>
        {score.toLocaleString()}
      </Text>
    </Animated.View>
  );
}

function Banner({
  label,
  colour,
  delayMs,
}: {
  label: string;
  colour: string;
  delayMs: number;
}): React.JSX.Element {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(
      delayMs,
      withTiming(1, {duration: 280, easing: Easing.out(Easing.back(1.6))}),
    );
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{scale: 0.9 + shown.value * 0.1}],
  }));
  return (
    <Animated.Text style={[styles.banner, {color: colour}, style]}>
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    backgroundColor: 'rgba(2,5,12,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  header: {alignItems: 'center', gap: 4},
  league: {
    ...typography.display(20),
    color: theme.text.primary,
    letterSpacing: 3,
  },
  liveRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.state.success,
  },
  season: {...typography.body(11), color: theme.text.dim, letterSpacing: 1.4},
  banner: {...typography.ui(14), letterSpacing: 2.4, height: 20},
  board: {
    alignSelf: 'stretch',
    maxWidth: 380,
    width: '100%',
    marginHorizontal: 'auto',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H - 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.bg.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
  },
  playerRow: {
    backgroundColor: theme.bg.panelAlt,
    borderColor: theme.state.currentLevel,
  },
  rank: {
    ...typography.ui(12),
    color: theme.text.dim,
    width: 24,
    textAlign: 'center',
  },
  rankPlayer: {color: theme.state.currentLevel},
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  face: {fontSize: 16},
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.state.success,
    borderWidth: 1.5,
    borderColor: theme.bg.panel,
  },
  name: {...typography.body(13), color: theme.text.secondary, flex: 1},
  namePlayer: {...typography.ui(13), color: theme.text.primary},
  gain: {...typography.ui(11), color: theme.state.success},
  score: {...typography.ui(12), color: theme.text.secondary},
  scorePlayer: {color: theme.state.star},
  tierBox: {
    alignSelf: 'stretch',
    maxWidth: 380,
    width: '100%',
    gap: 6,
    marginTop: theme.space.sm,
  },
  tierUp: {
    ...typography.ui(11),
    color: theme.state.success,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  buttons: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: theme.space.md,
    maxWidth: 340,
    width: '100%',
    marginTop: theme.space.sm,
  },
  home: {...typography.ui(13), color: theme.text.secondary, letterSpacing: 2},
  dimmed: {opacity: 0.4},
});
