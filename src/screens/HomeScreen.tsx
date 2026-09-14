import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from '../components/Button';
import {Wordmark} from '../components/Wordmark';
import {TierBadge} from '../components/TierBadge';
import {climbFor} from '../game/leaderboard/board';
import {standingsFor} from '../game/leaderboard/board';
import {LeaderboardOverlay} from '../components/LeaderboardOverlay';
import {SaveStore} from '../storage/SaveStore';
import type {SaveData} from '../storage/SaveStore';
import {TOTAL_LEVELS, preloadAround} from '../game/levels';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** §5.2 — gear, wordmark, three buttons, progress line, How To Play. Nothing else. */
export function HomeScreen({navigation}: Props): React.JSX.Element {
  const [save, setSave] = useState<SaveData>(SaveStore.data);

  useEffect(() => SaveStore.subscribe(setSave), []);

  const level = Math.min(save.currentLevel, TOTAL_LEVELS);

  // Recomputed when the score changes, not on every render: the roster is 24 seeded
  // rivals and a sort. `Date.now()` is read here rather than inside so a rerender for
  // some other reason cannot quietly reshuffle the board under the player.
  const standing = useMemo(
    () => standingsFor(save.bestScore, Date.now()),
    [save.bestScore],
  );

  const [boardOpen, setBoardOpen] = useState(false);
  // The same score either side, so the overlay has no climb to play and simply shows
  // the table as it stands.
  const resting = useMemo(
    () => climbFor(save.bestScore, save.bestScore, Date.now()),
    [save.bestScore],
  );

  useEffect(() => {
    preloadAround(level);
  }, [level]);

  return (
    <SafeAreaView style={styles.root}>
      <Pressable
        style={styles.gear}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.gearGlyph}>⚙</Text>
      </Pressable>

      <View style={styles.header}>
        <Wordmark size={40} />
        <Text style={styles.progress}>LEVEL {level}</Text>
        <Text style={styles.best}>BEST {save.bestScore.toLocaleString()}</Text>

        {/* The ladder, kept in front of the player between sessions rather than only
            at the end of a level. Standings are a pure function of the lifetime score
            and the clock, so this costs a sort of 25 rows and no storage. */}
        <Pressable
          onPress={() => setBoardOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${standing.tier.tier.label} badge, rank ${standing.playerRank} in ${standing.leagueName} league`}
          style={styles.standing}>
          <TierBadge tier={standing.tier.tier} size={34} />
          <View>
            <Text
              style={[styles.tierLabel, {color: standing.tier.tier.colour}]}>
              {standing.tier.tier.label}
            </Text>
            <Text style={styles.leagueLine}>
              #{standing.playerRank} · {standing.leagueName} LEAGUE
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('HowToPlay')}>
          <Text style={styles.howTo}>HOW TO PLAY</Text>
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Button
          label="PLAY"
          icon="▶"
          variant="play"
          onPress={() => navigation.navigate('Game', {levelId: level})}
        />
        <Button
          label="LEVELS"
          icon="▦"
          variant="levels"
          onPress={() => navigation.navigate('LevelSelection')}
        />
        <Button
          label="SETTINGS"
          icon="⚙"
          variant="settings"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      {/* §5.2 — faint dotted silhouettes below as decoration, and nothing else: no
          store, no coins, no daily reward, no bottom navigation (§21). */}
      <View style={styles.decor} pointerEvents="none">
        <Text style={styles.silhouette}>◉</Text>
        <Text style={styles.silhouette}>⬟</Text>
        <Text style={styles.silhouette}>✦</Text>
        <Text style={styles.silhouette}>❤</Text>
      </View>
      <LeaderboardOverlay
        visible={boardOpen}
        climb={resting}
        onNext={() => setBoardOpen(false)}
        primaryLabel="CLOSE"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg.base,
    paddingHorizontal: theme.space.md,
  },
  gear: {
    position: 'absolute',
    left: theme.space.md,
    top: theme.space.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gearGlyph: {fontSize: 22, color: theme.text.secondary},
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  progress: {
    ...typography.ui(14),
    color: theme.text.secondary,
    letterSpacing: 2,
    marginTop: theme.space.lg,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.md,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.bg.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
  },
  tierLabel: {...typography.ui(12), letterSpacing: 2},
  leagueLine: {
    ...typography.body(11),
    color: theme.text.dim,
    letterSpacing: 1.1,
  },
  best: {...typography.body(13), color: theme.text.dim, letterSpacing: 1.5},
  howTo: {
    ...typography.ui(12),
    color: theme.brand.tagline,
    letterSpacing: 2,
    marginTop: theme.space.md,
  },
  buttons: {gap: 14, paddingBottom: theme.space.lg},
  decor: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    opacity: 0.08,
    paddingBottom: theme.space.lg,
  },
  silhouette: {fontSize: 40, color: theme.text.primary},
});
