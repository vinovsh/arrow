import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TapCue} from './TapCue';
import type {ArrowPath} from '../game/models/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';

/** A solid instruction bubble below the practice arrows; never blocks taps. */
export function TutorialTapGuide({
  arrow,
  cellSize,
  boardSize,
}: {
  arrow: ArrowPath;
  cellSize: number;
  boardSize: number;
}): React.JSX.Element {
  const middle = arrow.cells[Math.floor(arrow.cells.length / 2)];
  const x = (middle.x + 0.5) * cellSize;
  const width = Math.min(176, boardSize - 16);
  const left = Math.max(8, Math.min(boardSize - width - 8, x - width / 2));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityLiveRegion="polite">
      <View
        style={[
          styles.target,
          {left: x - 18, top: (middle.y + 0.5) * cellSize - 18},
        ]}>
        <TapCue size={36} />
      </View>
      <View style={[styles.bubble, {left, top: cellSize * 9.3, width}]}>
        <View style={[styles.pointer, {left: x - left - 9}]} />
        <Text style={styles.caption}>Tap to remove</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  target: {position: 'absolute'},
  bubble: {
    position: 'absolute',
    backgroundColor: theme.board.escaping,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -9,
    width: 18,
    height: 18,
    backgroundColor: theme.board.escaping,
    transform: [{rotate: '45deg'}],
  },
  caption: {...typography.body(17), color: '#FFFFFF'},
});
