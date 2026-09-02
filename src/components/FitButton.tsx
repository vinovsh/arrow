import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {theme} from '../theme/theme';
import {Haptics} from '../haptics/HapticService';

interface Props {
  onPress: () => void;
  /** §5.4 / §5.5 — visible only while scale > 1.01. */
  visible: boolean;
}

/** Springs the board back to fit and re-centres it (§5.5). */
export function FitButton({onPress, visible}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fit board to screen"
      style={styles.button}
      onPress={() => {
        Haptics.selection();
        onPress();
      }}>
      <Text style={styles.glyph}>⛶</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: theme.space.md,
    top: theme.space.sm,
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.bg.panelAlt,
    borderWidth: 1,
    borderColor: theme.bg.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  glyph: {fontSize: 18, color: theme.text.primary},
});
