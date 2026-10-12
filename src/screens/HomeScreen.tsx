import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Button} from '../components/Button';
import {ClickPressable} from '../components/ClickPressable';
import {AppIcon} from '../components/AppIcon';
import {ArrowEmblem, MenuHero} from '../components/MenuArt';
import {Panel} from '../components/Panel';
import {LeaderboardOverlay} from '../components/LeaderboardOverlay';
import {climbFor, standingsFor} from '../game/leaderboard/board';
import {SaveStore} from '../storage/SaveStore';
import type {SaveData} from '../storage/SaveStore';
import {TOTAL_LEVELS, preloadAround} from '../game/levels';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({navigation}: Props): React.JSX.Element {
  const [save, setSave] = useState<SaveData>(SaveStore.data);
  const [boardOpen, setBoardOpen] = useState(false);
  useEffect(() => SaveStore.subscribe(setSave), []);
  const level = Math.min(save.currentLevel, TOTAL_LEVELS);
  const count = save.completedLevels.filter(id => id <= TOTAL_LEVELS).length;
  const standing = useMemo(
    () => standingsFor(save.bestScore, Date.now()),
    [save.bestScore],
  );
  const resting = useMemo(
    () => climbFor(save.bestScore, save.bestScore, Date.now()),
    [save.bestScore],
  );
  useEffect(() => {
    preloadAround(level);
  }, [level]);
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg.base} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <ArrowEmblem size={54} />
            <Text style={styles.brandTitle}>Arrow Escape</Text>
          </View>
          <MenuHero kind="happy" size={130} />
          <Text accessibilityRole="header" style={styles.title}>
            Ready for a{'\n'}challenge?
          </Text>
          <Button
            label={`Play · Level ${level}`}
            variant="play"
            icon={<AppIcon name="play" color={theme.bg.panel} />}
            onPress={() => navigation.navigate('Game', {levelId: level})}
            style={styles.full}
          />
          <View style={styles.menuRow}>
            <Button
              compact
              glow={false}
              label="Levels"
              variant="levels"
              icon={
                <AppIcon name="levels" color={theme.brand.tagline} size={19} />
              }
              onPress={() => navigation.navigate('LevelSelection')}
              style={styles.half}
            />
            <Button
              compact
              glow={false}
              label="Settings"
              variant="settings"
              icon={
                <AppIcon
                  name="settings"
                  color={theme.brand.tagline}
                  size={19}
                />
              }
              onPress={() => navigation.navigate('Settings')}
              style={styles.half}
            />
          </View>
          <Panel style={styles.progressCard}>
            <Text style={styles.progressText}>
              {count} / {TOTAL_LEVELS} completed
            </Text>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{min: 0, max: TOTAL_LEVELS, now: count}}>
              <View
                style={[
                  styles.fill,
                  {width: `${(count / TOTAL_LEVELS) * 100}%`},
                ]}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.scoreRow}>
              <Text style={styles.progressText}>Best score</Text>
              <Text style={styles.score}>
                🏆 {save.bestScore.toLocaleString()}
              </Text>
            </View>
          </Panel>
          <ClickPressable
            onPress={() => setBoardOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open leaderboard"
            style={styles.league}>
            <Text style={styles.leagueText}>
              Leaderboard · #{standing.playerRank}
            </Text>
            <AppIcon name="chevron" color={theme.brand.tagline} size={16} />
          </ClickPressable>
          <ClickPressable
            onPress={() => navigation.navigate('HowToPlay')}
            accessibilityRole="button"
            style={styles.help}>
            <AppIcon name="help" color={theme.brand.tagline} size={19} />
            <Text style={styles.helpText}>How to play</Text>
          </ClickPressable>
        </View>
      </ScrollView>
      <LeaderboardOverlay
        visible={boardOpen}
        climb={resting}
        onNext={() => setBoardOpen(false)}
        primaryLabel="Close"
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
  },
  brand: {alignItems: 'center', gap: 2},
  brandTitle: {...typography.ui(19)},
  title: {
    ...typography.display(30),
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 8,
  },
  full: {alignSelf: 'stretch'},
  menuRow: {flexDirection: 'row', gap: 12, alignSelf: 'stretch'},
  half: {flex: 1},
  progressCard: {alignSelf: 'stretch', padding: 18, gap: 12},
  progressText: {...typography.body(14)},
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.bg.border,
    overflow: 'hidden',
  },
  fill: {height: 8, borderRadius: 4, backgroundColor: theme.brand.tagline},
  divider: {height: 1, backgroundColor: theme.bg.border},
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  score: {...typography.ui(17)},
  league: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44},
  leagueText: {...typography.body(13)},
  help: {flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 44},
  helpText: {...typography.ui(14), color: theme.brand.tagline},
});
