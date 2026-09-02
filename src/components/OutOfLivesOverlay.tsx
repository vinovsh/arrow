import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {MAX_HEARTS} from '../game/engine/GameEngine';
import {FEATURES} from '../app/featureFlags';

interface Props {
  visible: boolean;
  onWatchVideo: () => void;
  onRetry: () => void;
}

/**
 * Rendered as an in-tree layer rather than in a `Modal`.
 *
 * On Android a Modal's content lives in its own window, which
 * `GestureHandlerRootView` does not wrap — react-native-gesture-handler then
 * swallows every touch inside it and the overlay is visible but completely inert.
 * These overlays are full-screen layers over the game screen anyway, so keeping them
 * in the same tree fixes the touches, avoids a second Modal window fighting the
 * first when one overlay hands over to another, and lets Fabric size them correctly.
 */

/**
 * §5.10 / §3.2 — a pause, not a punishment.
 *
 * RETRY LEVEL is instant, restores all hearts, and loses no progress, no stars and no
 * score. There is no wait timer, no regeneration clock and nothing to buy. With no ad
 * SDK in v1 the rewarded button grants the life immediately and says so, rather than
 * pretending a video played (§3.2, §16).
 */
export function OutOfLivesOverlay({
  visible,
  onWatchVideo,
  onRetry,
}: Props): React.JSX.Element | null {
  const rewardLabel = FEATURES.adsEnabled
    ? 'WATCH VIDEO +1 LIFE'
    : 'CONTINUE +1 LIFE';

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.scrim}>
      <View style={styles.hearts}>
        {Array.from({length: MAX_HEARTS}, (_, i) => (
          <Text key={i} style={styles.heart}>
            ♡
          </Text>
        ))}
      </View>

      <Text style={styles.title}>OUT OF LIVES!</Text>
      <Text style={styles.face}>ʘ︵ʘ</Text>
      <Text style={styles.encouragement}>Don't give up!</Text>

      <View style={styles.buttons}>
        <Button
          label={rewardLabel}
          icon="▶"
          variant="play"
          onPress={onWatchVideo}
        />
        <Button
          label="RETRY LEVEL"
          icon="↻"
          variant="neutral"
          glow={false}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(2,5,12,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  hearts: {flexDirection: 'row', gap: theme.space.sm},
  heart: {fontSize: 34, color: theme.state.heartEmpty},
  title: {
    ...typography.display(26),
    color: theme.state.danger,
    letterSpacing: 2,
    marginTop: theme.space.sm,
  },
  face: {
    fontSize: 30,
    color: theme.text.secondary,
    marginVertical: theme.space.sm,
  },
  encouragement: {...typography.body(15), marginBottom: theme.space.lg},
  buttons: {alignSelf: 'stretch', gap: 14, maxWidth: 340, width: '100%'},
});
