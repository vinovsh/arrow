import React, {useEffect, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {MenuBackdrop} from '../components/MenuBackdrop';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {MenuHeader} from '../components/MenuHeader';
import {Button} from '../components/Button';
import {ClickPressable} from '../components/ClickPressable';
import {StarRow} from '../components/StarRow';
import {SaveStore} from '../storage/SaveStore';
import {
  getPageSummaries,
  TOTAL_LEVELS,
  TOTAL_PACKS,
  PACK_SIZE,
  packIndexForLevel,
} from '../game/levels';
type Props = NativeStackScreenProps<RootStackParamList, 'LevelSelection'>;
export function LevelSelectionScreen({navigation}: Props): React.JSX.Element {
  const [save, setSave] = useState(SaveStore.data);
  useEffect(() => SaveStore.subscribe(setSave), []);
  const {width} = useWindowDimensions();
  const tile = (Math.min(width, 480) - 48 - 36) / 4;
  const next = Math.min(save.currentLevel, TOTAL_LEVELS);
  const [page, setPage] = useState(() => packIndexForLevel(next));
  useEffect(() => setPage(packIndexForLevel(next)), [next]);
  const first = page * PACK_SIZE + 1;
  const last = Math.min(TOTAL_LEVELS, first + PACK_SIZE - 1);
  return (
    <SafeAreaView style={styles.root}>
      <MenuBackdrop />
      <MenuHeader
        title="Levels"
        subtitle={`Levels ${first}–${last} · ${TOTAL_LEVELS} total`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        key={page}
        data={getPageSummaries(page)}
        keyExtractor={s => String(s.id)}
        numColumns={4}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({item}) => {
          const unlocked = SaveStore.isUnlocked(item.id),
            current = item.id === next,
            stars = SaveStore.starsFor(item.id);
          return (
            <ClickPressable
              disabled={!unlocked}
              onPress={() => navigation.navigate('Game', {levelId: item.id})}
              accessibilityRole="button"
              accessibilityLabel={`Level ${item.id}${
                unlocked ? `, ${stars} stars` : ', locked'
              }`}
              style={[
                styles.tile,
                {width: tile, minHeight: Math.max(76, tile + 8)},
                unlocked &&
                  !current && {
                    backgroundColor: [
                      theme.pastel.sky,
                      theme.pastel.lavender,
                      theme.pastel.mint,
                      theme.pastel.peach,
                    ][(item.id - 1) % 4],
                  },
                !unlocked && styles.locked,
                current && styles.current,
              ]}>
              <Text
                style={[
                  styles.number,
                  current && styles.white,
                  !unlocked && styles.muted,
                ]}>
                {item.id}
              </Text>
              {unlocked ? (
                <StarRow stars={stars} size={13} />
              ) : (
                <Text style={styles.lock}>🔒</Text>
              )}
              {item.id === 1 && (
                <Text style={[styles.tutorial, current && styles.white]}>
                  Tutorial
                </Text>
              )}
            </ClickPressable>
          );
        }}
      />
      <View style={styles.footer}>
        <View style={styles.pageControls}>
          <Button
            compact
            label="Previous"
            variant="neutral"
            glow={false}
            disabled={page === 0}
            onPress={() => setPage(p => Math.max(0, p - 1))}
            style={styles.pageButton}
          />
          <Text style={styles.pageLabel}>
            {page + 1} / {TOTAL_PACKS}
          </Text>
          <Button
            compact
            label="Next"
            variant="neutral"
            glow={false}
            disabled={page === TOTAL_PACKS - 1}
            onPress={() => setPage(p => Math.min(TOTAL_PACKS - 1, p + 1))}
            style={styles.pageButton}
          />
        </View>
        <Button
          label={`Continue · Level ${next}`}
          variant="play"
          onPress={() => navigation.navigate('Game', {levelId: next})}
        />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  grid: {paddingVertical: 20, gap: 12},
  row: {justifyContent: 'center', gap: 12},
  tile: {
    backgroundColor: theme.bg.panel,
    borderColor: theme.bg.border,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  locked: {backgroundColor: '#F5F9FD'},
  current: {
    backgroundColor: theme.brand.tagline,
    borderColor: theme.brand.tagline,
    elevation: 3,
  },
  number: {...typography.ui(20)},
  white: {color: theme.bg.panel},
  muted: {color: theme.text.dim},
  lock: {fontSize: 14, opacity: 0.6},
  tutorial: {...typography.body(10)},
  pageControls: {flexDirection: 'row', alignItems: 'center', gap: 12},
  pageButton: {flex: 1},
  pageLabel: {...typography.body(12)},
  footer: {
    gap: 12,
    padding: 16,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
});
