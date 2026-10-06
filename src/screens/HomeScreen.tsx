import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ClickPressable} from '../components/ClickPressable';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from '../components/Button';
import {AppIcon} from '../components/AppIcon';
import {ArrowBuddy} from '../components/ArrowBuddy';
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
      <ClickPressable
        style={styles.gear}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => navigation.navigate('Settings')}>
        <AppIcon name="settings" size={23} color={theme.brand.tagline} />
      </ClickPressable>

      <View style={styles.header}>
        <Text style={styles.welcome}>A LITTLE PUZZLE. A HAPPY BREAK.</Text>
        <ArrowBuddy />
        <Wordmark size={34} />
        <Text style={styles.progress}>Your next adventure · Level {level}</Text>
        <Text style={styles.best}>BEST {save.bestScore.toLocaleString()}</Text>

        {/* The ladder, kept in front of the player between sessions rather than only
            at the end of a level. Standings are a pure function of the lifetime score
            and the clock, so this costs a sort of 25 rows and no storage. */}
        <ClickPressable
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
          <AppIcon name="chevron" size={18} color={theme.brand.tagline} />
        </ClickPressable>
        <ClickPressable
          style={styles.helpLink}
          accessibilityRole="button"
          accessibilityLabel="How to play"
          onPress={() => navigation.navigate('HowToPlay')}>
          <AppIcon name="help" size={18} color={theme.brand.tagline} />
          <Text style={styles.howTo}>HOW TO PLAY</Text>
        </ClickPressable>
      </View>

      <View style={styles.buttons}>
        <Button
          label="Let's play"
          icon={<AppIcon name="play" color={theme.bg.panel} />}
          variant="play"
          onPress={() => navigation.navigate('Game', {levelId: level})}
        />
        <Button
          label="Explore levels"
          icon={<AppIcon name="levels" />}
          variant="levels"
          onPress={() => navigation.navigate('LevelSelection')}
        />
        <Button
          label="Make it yours"
          icon={<AppIcon name="settings" />}
          variant="settings"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      {/* §5.2 — faint dotted silhouettes below as decoration, and nothing else: no
          store, no coins, no daily reward, no bottom navigation (§21). */}
      <View style={styles.decor} pointerEvents="none">
        <AppIcon name="sparkle" size={18} color={theme.button.play[0]} />
        <AppIcon name="heart" size={20} color={theme.button.levels[1]} />
        <AppIcon name="sparkle" size={18} color={theme.button.play[0]} />
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
    paddingHorizontal: theme.space.lg,
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
    backgroundColor: theme.bg.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.bg.border,
  },
  welcome: {
    ...typography.ui(10),
    color: theme.brand.tagline,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: theme.space.sm,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  progress: {
    ...typography.ui(14),
    color: theme.text.secondary,
    letterSpacing: 0.2,
    marginTop: theme.space.md,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.md,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
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
    letterSpacing: 0.8,
  },
  buttons: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 12,
    paddingBottom: theme.space.lg,
  },
  decor: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    opacity: 0.65,
    paddingBottom: theme.space.lg,
  },
});
