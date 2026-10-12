import React, {useMemo, useRef, useState} from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {ListRenderItemInfo} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {G, Path} from 'react-native-svg';
import type {RootStackParamList} from '../navigation/types';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Button} from '../components/Button';
import {MenuHeader} from '../components/MenuHeader';
import {TapCue} from '../components/TapCue';
import {Panel} from '../components/Panel';
import {HOW_TO_PLAY_CARDS} from '../game/tutorial/steps';
import {buildArrowGeometry} from '../game/renderer/arrowGeometry';
import {DotGrid, pathCells} from '../game/renderer/DotGrid';
import type {ArrowPath} from '../game/models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HowToPlay'>;

/**
 * §6 — a five-card pager, each with a small board illustrating one rule. Under 25
 * seconds to read, and reachable from both Home and Settings.
 */
const MINI_GRID = 4;

/** One tiny board per card, hand-placed so each drawing says exactly one thing. */
const CARD_BOARDS: ArrowPath[][] = [
  // 1. Tap an arrow to send it out.
  [
    {
      id: 'a',
      color: 'cyan',
      cells: [
        {x: 1, y: 2},
        {x: 2, y: 2},
      ],
      direction: 'R',
    },
  ],
  // 2. It follows the arrowhead, even around corners.
  [
    {
      id: 'a',
      color: 'purple',
      cells: [
        {x: 1, y: 3},
        {x: 1, y: 2},
        {x: 2, y: 2},
        {x: 3, y: 2},
      ],
      direction: 'R',
    },
  ],
  // 3. Blocked: the pink arrow cannot pass the yellow one.
  [
    {
      id: 'a',
      color: 'pink',
      cells: [
        {x: 0, y: 2},
        {x: 1, y: 2},
      ],
      direction: 'R',
    },
    {id: 'b', color: 'yellow', cells: [{x: 3, y: 2}], direction: 'U'},
  ],
  // 4. Busy board: pinch to zoom.
  [
    {id: 'a', color: 'green', cells: [{x: 0, y: 1}], direction: 'L'},
    {id: 'b', color: 'orange', cells: [{x: 1, y: 1}], direction: 'U'},
    {id: 'c', color: 'blue', cells: [{x: 2, y: 1}], direction: 'D'},
    {id: 'd', color: 'cyan', cells: [{x: 3, y: 1}], direction: 'R'},
    {
      id: 'e',
      color: 'pink',
      cells: [
        {x: 1, y: 2},
        {x: 2, y: 2},
      ],
      direction: 'R',
    },
  ],
  // 5. Empty the board to finish.
  [{id: 'a', color: 'yellow', cells: [{x: 2, y: 2}], direction: 'U'}],
];

export function HowToPlayScreen({navigation}: Props): React.JSX.Element {
  const {width} = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pager = useRef<FlatList>(null);

  const cards = useMemo(
    () =>
      HOW_TO_PLAY_CARDS.map((card, i) => ({
        ...card,
        board: CARD_BOARDS[i],
        key: i,
      })),
    [],
  );

  const renderCard = ({
    item,
  }: ListRenderItemInfo<(typeof cards)[number]>): React.JSX.Element => (
    <View style={[styles.page, {width}]}>
      <ScrollView contentContainerStyle={styles.lessonScroll}>
        <Panel style={styles.card}>
          <Text style={styles.step}>{item.key + 1} / 5</Text>
          <View style={styles.illustration}>
            <MiniBoard arrows={item.board} size={Math.min(width - 96, 220)} />
            {item.key === 0 && (
              <View style={styles.tapCue}>
                <TapCue size={42} />
              </View>
            )}
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.body}</Text>
        </Panel>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <MenuHeader title="How to play" onBack={() => navigation.goBack()} />

      <FlatList
        ref={pager}
        data={cards}
        renderItem={renderCard}
        keyExtractor={item => String(item.key)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={event =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
      />

      <View style={styles.dots}>
        {cards.map(card => (
          <View
            key={card.key}
            style={[styles.dot, card.key === page && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          label={page === cards.length - 1 ? 'Got it' : 'Next'}
          variant="primary"
          onPress={() => {
            if (page === cards.length - 1) {
              navigation.goBack();
            } else {
              pager.current?.scrollToIndex({index: page + 1, animated: true});
              setPage(page + 1);
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function MiniBoard({
  arrows,
  size,
}: {
  arrows: ArrowPath[];
  size: number;
}): React.JSX.Element {
  const cellSize = size / MINI_GRID;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <DotGrid cells={pathCells(arrows)} cellSize={cellSize} />
      {arrows.map(arrow => {
        const geometry = buildArrowGeometry(arrow, cellSize);
        return (
          <G key={arrow.id}>
            {geometry.body !== '' && (
              <Path
                d={geometry.body}
                stroke={theme.arrow[arrow.color]}
                strokeWidth={geometry.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            <Path d={geometry.head} fill={theme.arrow[arrow.color]} />
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  lessonScroll: {flexGrow: 1, justifyContent: 'center', paddingVertical: 16},
  tapCue: {position: 'absolute', bottom: 18, right: 24},
  root: {flex: 1, backgroundColor: theme.bg.base},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    height: 76,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: theme.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {fontSize: 30, color: theme.text.primary, lineHeight: 32},
  title: {
    ...typography.display(18),
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  page: {paddingHorizontal: theme.space.lg, justifyContent: 'center'},
  card: {
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: theme.bg.base,
    alignItems: 'center',
    gap: theme.space.lg,
  },
  step: {...typography.ui(11), color: theme.brand.tagline, letterSpacing: 1.5},
  illustration: {backgroundColor: theme.bg.panel, borderRadius: 28, padding: 8},
  cardTitle: {...typography.ui(20), textAlign: 'center'},
  cardBody: {...typography.body(15), textAlign: 'center', lineHeight: 22},
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: theme.space.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.text.dim,
    opacity: 0.4,
  },
  dotActive: {backgroundColor: theme.state.currentLevel, opacity: 1, width: 18},
  footer: {padding: theme.space.md},
});
