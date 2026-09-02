import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {ListRenderItemInfo} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {StarRow} from '../components/StarRow';
import {SaveStore} from '../storage/SaveStore';
import {
  PACK_SIZE,
  TOTAL_PACKS,
  bandForPage,
  getPageSummaries,
} from '../game/levels';
import {Haptics} from '../haptics/HapticService';

type Props = NativeStackScreenProps<RootStackParamList, 'LevelSelection'>;

/** §5.3 — 25 levels per page in a 5x5 grid, 500 levels = 20 pages. */
const COLUMNS = 5;
const DOT_WINDOW = 5;

export function LevelSelectionScreen({navigation}: Props): React.JSX.Element {
  const {width} = useWindowDimensions();
  const initialPage = Math.floor((SaveStore.data.currentLevel - 1) / PACK_SIZE);
  const [page, setPage] = useState(Math.min(initialPage, TOTAL_PACKS - 1));
  const listRef = useRef<FlatList<number>>(null);

  const pages = useMemo(
    () => Array.from({length: TOTAL_PACKS}, (_, i) => i),
    [],
  );

  const onScroll = useCallback(
    (offsetX: number) => {
      const next = Math.round(offsetX / width);
      if (next !== page) {
        setPage(next);
      }
    },
    [page, width],
  );

  const renderPage = useCallback(
    ({item}: ListRenderItemInfo<number>) => (
      <LevelPage
        pageIndex={item}
        width={width}
        onSelect={levelId => {
          Haptics.selection();
          navigation.navigate('Game', {levelId});
        }}
      />
    ),
    [width, navigation],
  );

  const dots = useMemo(() => {
    const half = Math.floor(DOT_WINDOW / 2);
    const start = Math.max(0, Math.min(page - half, TOTAL_PACKS - DOT_WINDOW));
    return Array.from(
      {length: Math.min(DOT_WINDOW, TOTAL_PACKS)},
      (_, i) => start + i,
    );
  }, [page]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>LEVELS</Text>
          <Text style={styles.band}>{bandForPage(page)}</Text>
        </View>
        <View style={styles.back} />
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={item => String(item)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={page}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        // §13 — only the visible page plus its neighbours is mounted.
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        onMomentumScrollEnd={event =>
          onScroll(event.nativeEvent.contentOffset.x)
        }
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {dots.map(index => (
            <View
              key={index}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>
        <Text style={styles.pageLabel}>
          {page + 1} / {TOTAL_PACKS}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function LevelPage({
  pageIndex,
  width,
  onSelect,
}: {
  pageIndex: number;
  width: number;
  onSelect: (levelId: number) => void;
}): React.JSX.Element {
  const summaries = useMemo(() => getPageSummaries(pageIndex), [pageIndex]);
  const cardSize = (width - theme.space.md * 2 - 10 * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={[styles.page, {width}]}>
      {summaries.map(summary => {
        const unlocked = SaveStore.isUnlocked(summary.id);
        const stars = SaveStore.starsFor(summary.id);
        const current = summary.id === SaveStore.data.currentLevel;
        return (
          <Pressable
            key={summary.id}
            disabled={!unlocked}
            onPress={() => onSelect(summary.id)}
            accessibilityRole="button"
            accessibilityLabel={
              unlocked ? `Level ${summary.id}, ${stars} stars` : 'Locked level'
            }
            style={[
              styles.card,
              {width: cardSize, height: cardSize},
              !unlocked && styles.locked,
              current && styles.current,
            ]}>
            {unlocked ? (
              <>
                <Text style={[styles.number, current && styles.numberCurrent]}>
                  {summary.id}
                </Text>
                <StarRow stars={stars} size={10} />
              </>
            ) : (
              // §5.3 — a locked card shows a padlock and no number.
              <Text style={styles.lock}>🔒</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    height: 56,
  },
  back: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 30, color: theme.text.primary, lineHeight: 32},
  titleBlock: {flex: 1, alignItems: 'center'},
  title: {...typography.display(20), letterSpacing: 2},
  band: {...typography.body(11), color: theme.text.dim, letterSpacing: 2},
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    alignContent: 'flex-start',
  },
  card: {
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.bg.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  locked: {opacity: 0.35},
  current: {borderColor: theme.state.currentLevel, borderWidth: 2},
  number: {...typography.ui(16)},
  numberCurrent: {color: theme.state.currentLevel},
  lock: {fontSize: 16, opacity: 0.7},
  footer: {
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.md,
  },
  dots: {flexDirection: 'row', gap: 7},
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.text.dim,
    opacity: 0.4,
  },
  dotActive: {backgroundColor: theme.state.currentLevel, opacity: 1, width: 18},
  pageLabel: {
    ...typography.body(12),
    color: theme.text.dim,
    letterSpacing: 1.5,
  },
});
