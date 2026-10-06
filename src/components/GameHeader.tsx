import React, {useEffect, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Hearts} from './Hearts';
import {AppIcon} from './AppIcon';
import {ClickPressable} from './ClickPressable';

export const GAME_HEADER_HEIGHT = 96;
interface Props {
  levelId: number;
  band: string;
  hearts: number;
  remaining: number;
  onBack: () => void;
  onPause: () => void;
  onDeveloper?: () => void;
}

export function GameHeader({
  levelId,
  band,
  hearts,
  remaining,
  onBack,
  onPause,
  onDeveloper,
}: Props): React.JSX.Element {
  const title = useSharedValue(0);
  const status = useSharedValue(0);
  const countScale = useSharedValue(1);
  const previous = useRef(remaining);
  useEffect(() => {
    title.value = withTiming(1, {duration: 240});
    status.value = withDelay(400, withTiming(1, {duration: 260}));
    return () => {
      cancelAnimation(title);
      cancelAnimation(status);
      cancelAnimation(countScale);
    };
  }, [title, status, countScale]);
  useEffect(() => {
    if (remaining < previous.current) {
      countScale.value = withSequence(
        withTiming(1.15, {duration: 80}),
        withTiming(1, {duration: 160}),
      );
    }
    previous.current = remaining;
  }, [remaining, countScale]);
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{translateY: (1 - title.value) * -6}],
  }));
  const statusStyle = useAnimatedStyle(() => ({
    opacity: status.value,
    transform: [{translateY: (1 - status.value) * 6}],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    transform: [{scale: countScale.value}],
  }));
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.titleRow, titleStyle]}>
        <ClickPressable
          onPress={onBack}
          style={styles.control}
          accessibilityRole="button"
          accessibilityLabel="Back to home">
          <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
            <Path
              d="M15 5L8 12L15 19"
              fill="none"
              stroke={theme.board.chrome}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </ClickPressable>
        <Text style={styles.title} numberOfLines={1}>
          Level {levelId}
        </Text>
        <ClickPressable
          onPress={onPause}
          onLongPress={onDeveloper}
          style={styles.control}
          accessibilityRole="button"
          accessibilityLabel="Pause">
          <AppIcon name="settings" color={theme.board.chrome} size={23} />
        </ClickPressable>
      </Animated.View>
      <View style={styles.statusRow}>
        <Animated.View style={[styles.side, statusStyle]}>
          <Animated.View
            style={[styles.chip, counterStyle]}
            accessible
            accessibilityLabel={`${remaining} arrows remaining`}>
            <Svg width={15} height={15} viewBox="0 0 24 24" accessible={false}>
              <Path
                d="M4 16L13 7H7V3H21V17H17V11L8 20Z"
                fill={theme.board.chipText}
              />
            </Svg>
            <Text style={styles.count}>{remaining}</Text>
          </Animated.View>
        </Animated.View>
        <Hearts hearts={hearts} visible />
        <Animated.View style={[styles.side, styles.right, statusStyle]}>
          <View style={styles.chip}>
            <Text style={styles.band} numberOfLines={1}>
              {band}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {height: GAME_HEADER_HEIGHT, paddingHorizontal: theme.space.md},
  titleRow: {height: 50, flexDirection: 'row', alignItems: 'center'},
  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.ui(16),
    flex: 1,
    textAlign: 'center',
    color: theme.board.title,
  },
  statusRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: {flex: 1, alignItems: 'flex-start'},
  right: {alignItems: 'flex-end'},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: theme.board.chip,
    maxWidth: '100%',
  },
  count: {
    ...typography.ui(12),
    color: theme.board.chipText,
    fontVariant: ['tabular-nums'],
  },
  band: {...typography.ui(11), color: theme.board.chipText, flexShrink: 1},
});
