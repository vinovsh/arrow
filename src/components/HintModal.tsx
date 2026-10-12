import React from 'react';
import {StyleSheet, Text} from 'react-native';
import type {Level} from '../game/models/types';
import {type as typography} from '../theme/menuTypography';
import {Button} from './Button';
import {MenuHero} from './MenuArt';
import {MenuModal} from './MenuModal';
interface Props {
  visible: boolean;
  level: Level;
  activeIndices: readonly number[];
  remaining: number;
  onConfirm: () => void;
  onCancel: () => void;
}
export function HintModal({
  visible,
  remaining,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <MenuModal>
      <MenuHero kind="bulb" size={138} />
      <Text accessibilityRole="header" style={styles.title}>
        Need a little help?
      </Text>
      <Text style={styles.body}>
        {remaining
          ? 'Reveal one arrow with a clear exit.'
          : 'No hints left for this level.'}
      </Text>
      <Button
        label={`Use hint · ${remaining} left`}
        variant="hint"
        disabled={remaining === 0}
        onPress={onConfirm}
        style={styles.button}
      />
      <Button
        label="Keep playing"
        variant="neutral"
        glow={false}
        onPress={onCancel}
        style={styles.button}
      />
    </MenuModal>
  );
}
const styles = StyleSheet.create({
  title: {...typography.display(27), textAlign: 'center'},
  body: {
    ...typography.body(16),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 22,
  },
  button: {alignSelf: 'stretch'},
});
