import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ClickPressable} from './ClickPressable';
import {TapCue} from './TapCue';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import type {ActiveCoachMark} from '../game/tutorial/TutorialController';
interface Props {
  mark: ActiveCoachMark;
  onDismiss: () => void;
}
/** An inline lesson above the board. No veil, spotlight, hand or touch blocker. */
export function CoachMark({mark, onDismiss}: Props): React.JSX.Element {
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <TapCue />
      <Text style={styles.caption}>{mark.step.caption}</Text>
      <ClickPressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        style={styles.dismiss}>
        <Text style={styles.dismissText}>Got it</Text>
      </ClickPressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 56,
    backgroundColor: theme.board.bg,
  },
  caption: {...typography.body(14), color: theme.board.ink, flex: 1},
  dismiss: {
    minWidth: 48,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {...typography.body(13), color: theme.board.escaping},
});
