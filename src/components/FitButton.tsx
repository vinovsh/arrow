import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {ClickPressable} from './ClickPressable';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {AppIcon} from './AppIcon';
import {Haptics} from '../haptics/HapticService';

interface Props {
  onPress: () => void;
  /** Persistent footer control; modal owners can hide or disable it. */
  visible: boolean;
  disabled?: boolean;
}

/** Springs the board back to fit and re-centres it (§5.5). */
export function FitButton({
  onPress,
  visible,
  disabled = false,
}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <ClickPressable
      accessibilityRole="button"
      accessibilityLabel="Fit board to screen"
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
      onPress={() => {
        Haptics.selection();
        onPress();
      }}>
      <AppIcon name="fit" size={28} color={theme.brand.tagline} />
      <Text style={styles.label}>Fit</Text>
    </ClickPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: theme.bg.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {...typography.ui(15)},
  disabled: {opacity: 0.4},
});
