import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from '../components/Button';
import {Wordmark} from '../components/Wordmark';
import {SaveStore} from '../storage/SaveStore';
import type {SaveData} from '../storage/SaveStore';
import {TOTAL_LEVELS, preloadAround} from '../game/levels';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** §5.2 — gear, wordmark, three buttons, progress line, How To Play. Nothing else. */
export function HomeScreen({navigation}: Props): React.JSX.Element {
  const [save, setSave] = useState<SaveData>(SaveStore.data);

  useEffect(() => SaveStore.subscribe(setSave), []);

  const level = Math.min(save.currentLevel, TOTAL_LEVELS);

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
