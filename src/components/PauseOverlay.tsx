import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {HintPill} from './HintPill';
import {Toggle} from './Toggle';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';

interface Props {
  visible: boolean;
  hintsRemaining: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onHint: () => void;
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
 * §5.11 — a translucent overlay with the board still visible behind it. The header
 * stays put, the game clock stops, and zoom is locked while this is open (§5.5).
 */
export function PauseOverlay({
  visible,
  hintsRemaining,
  onResume,
  onRestart,
  onQuit,
  onHint,
}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.scrim}>
      <Text style={styles.title}>PAUSED</Text>

      <View style={styles.buttons}>
        <Button label="RESUME" icon="▶" variant="play" onPress={onResume} />
        <Button
          label="RESTART"
          icon="↻"
          variant="neutral"
          glow={false}
          onPress={onRestart}
        />
        <Button
          label="QUIT LEVEL"
          icon="⌂"
          variant="neutral"
          glow={false}
          onPress={onQuit}
        />
      </View>

      <View style={styles.pills}>
        <HintPill remaining={hintsRemaining} onPress={onHint} />
        <View style={styles.soundPill}>
          <Toggle
            icon="🔊"
            label="SOUND"
            value={SaveStore.data.soundEnabled}
            onChange={next => {
              SaveStore.update({soundEnabled: next});
              Audio.applySettings();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(2,5,12,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.xl,
  },
  title: {
    ...typography.display(30),
    color: theme.state.star,
    letterSpacing: 4,
  },
  buttons: {alignSelf: 'stretch', gap: 14, maxWidth: 340, width: '100%'},
  pills: {flexDirection: 'row', alignItems: 'center', gap: theme.space.md},
  soundPill: {
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.bg.border,
    paddingHorizontal: theme.space.md,
  },
});
