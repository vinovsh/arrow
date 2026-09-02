import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {Panel} from './Panel';
import type {ScoreBreakdown} from '../game/engine/ScoreManager';

interface Props {
  visible: boolean;
  breakdown: ScoreBreakdown;
  bestScore: number;
  onContinue: () => void;
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
 * §5.8 — its own screen, shown selectively so it never taxes fast play: on milestone
 * levels, on a new high score, or when the player taps the SCORE box. Otherwise NEXT
 * LEVEL goes straight through.
 */
export function ScoreSummaryOverlay({
  visible,
  breakdown,
  bestScore,
  onContinue,
}: Props): React.JSX.Element | null {
  const rows: [string, number][] = [
    ['LEVEL SCORE', breakdown.levelScore],
    ['MOVES BONUS', breakdown.movesBonus],
    ['PERFECT BONUS', breakdown.perfectBonus],
    ['SPEED BONUS', breakdown.speedBonus],
  ];

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.scrim}>
      <Panel raised style={styles.panel}>
        <Text style={styles.title}>SCORE SUMMARY</Text>

        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, value === 0 && styles.zero]}>
              +{value}
            </Text>
          </View>
        ))}

        <View style={styles.rule} />

        <View style={styles.row}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>
            {breakdown.total.toLocaleString()}
          </Text>
        </View>

        <View style={styles.bestBox}>
          <Text style={styles.bestLabel}>BEST SCORE</Text>
          <Text style={styles.bestValue}>{bestScore.toLocaleString()}</Text>
        </View>

        <Button
          label="CONTINUE"
          variant="primary"
          onPress={onContinue}
          style={styles.cta}
        />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(2,5,12,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  panel: {width: '100%', maxWidth: 360, gap: theme.space.sm},
  title: {
    ...typography.display(18),
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: theme.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {...typography.body(14), letterSpacing: 1},
  rowValue: {...typography.ui(15), color: theme.text.primary},
  zero: {color: theme.text.dim},
  rule: {
    height: 1,
    backgroundColor: theme.bg.border,
    marginVertical: theme.space.sm,
  },
  totalLabel: {...typography.ui(16), letterSpacing: 1},
  totalValue: {...typography.display(22), color: theme.state.star},
  bestBox: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.bg.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestLabel: {
    ...typography.body(12),
    color: theme.text.secondary,
    letterSpacing: 2,
  },
  bestValue: {...typography.ui(17), color: theme.text.primary},
  cta: {marginTop: theme.space.md},
});
