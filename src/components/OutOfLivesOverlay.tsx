import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {AppIcon} from './AppIcon';
import {Panel} from './Panel';

interface Props {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  onWatchVideo: () => void;
  onRetry: () => void;
}
/** Kept in-tree so gesture handling works while the board underneath is locked. */
export function OutOfLivesOverlay({
  visible,
  loading = false,
  error,
  onWatchVideo,
  onRetry,
}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <View style={styles.scrim}>
      <Panel raised style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Out of lives
        </Text>
        <View
          style={styles.heart}
          accessible
          accessibilityLabel="No hearts remaining">
          <Svg
            width={116}
            height={110}
            viewBox="0 0 120 110"
            accessible={false}>
            <Circle
              cx={60}
              cy={54}
              r={48}
              fill={theme.button.levels[0]}
              opacity={0.22}
            />
            <Path
              d="M60 94S18 69 18 41C18 18 47 14 60 36C73 14 102 18 102 41C102 69 60 94 60 94Z"
              fill={theme.state.heart}
            />
            <Path
              d="M60 36L52 49L64 59L55 71L61 91"
              fill="none"
              stroke={theme.bg.panel}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M29 39Q31 27 42 28"
              fill="none"
              stroke={theme.bg.panel}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.6}
            />
          </Svg>
        </View>
        <Text style={styles.body}>A little boost to keep going?</Text>
        <Text style={styles.caption}>
          Watch a rewarded ad to get 1 heart and continue this puzzle.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.buttons}>
          <Button
            label={loading ? 'Loading ad...' : 'Get more lives'}
            icon={<AppIcon name="play" color={theme.bg.panel} />}
            variant="reward"
            disabled={loading}
            onPress={onWatchVideo}
          />
          <Button
            label="Restart level"
            variant="neutral"
            disabled={loading}
            glow={false}
            onPress={onRetry}
          />
        </View>
      </Panel>
    </View>
  );
}
const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: theme.bg.vignette,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  title: {...typography.display(27), textAlign: 'center'},
  heart: {alignItems: 'center', marginVertical: 4},
  body: {...typography.ui(16), textAlign: 'center'},
  caption: {...typography.body(13), textAlign: 'center', lineHeight: 20},
  error: {
    ...typography.body(12),
    color: theme.state.danger,
    textAlign: 'center',
    lineHeight: 18,
  },
  buttons: {alignSelf: 'stretch', gap: 12, marginTop: 12},
});
