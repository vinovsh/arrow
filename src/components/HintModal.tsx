import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Button} from './Button';
import {Panel} from './Panel';
import {DotGrid} from '../game/renderer/DotGrid';
import {buildArrowGeometry} from '../game/renderer/arrowGeometry';
import type {Level} from '../game/models/types';

interface Props {
  visible: boolean;
  level: Level;
  /** Which arrows are still on the board, so the preview matches the live state. */
  activeIndices: readonly number[];
  remaining: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const PREVIEW_SIZE = 190;

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
 * §5.6 — the hint confirm modal.
 *
 * The preview is deliberately desaturated and deliberately does **not** reveal the
 * answer before the player confirms: showing the target here would spend the hint
 * whether or not they wanted it.
 */
export function HintModal({
  visible,
  level,
  activeIndices,
  remaining,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element | null {
  const cellSize = PREVIEW_SIZE / level.gridSize;

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.scrim}>
      <Panel raised style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>HINT</Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.preview}>
          <Svg
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}
            opacity={0.45}>
            <DotGrid gridSize={level.gridSize} cellSize={cellSize} />
            {activeIndices.map(index => {
              const arrow = level.arrows[index];
              const geometry = buildArrowGeometry(arrow, cellSize);
              return (
                <G key={arrow.id}>
                  {geometry.body !== '' && (
                    <Path
                      d={geometry.body}
                      stroke={theme.text.secondary}
                      strokeWidth={geometry.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                  <Path d={geometry.head} fill={theme.text.secondary} />
                </G>
              );
            })}
          </Svg>
        </View>

        <Text style={styles.caption}>Reveal a helpful hint?</Text>

        <Button
          label={`USE HINT (${remaining})`}
          icon="💡"
          variant="hint"
          onPress={onConfirm}
          disabled={remaining === 0}
          style={styles.cta}
        />
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancel}>CANCEL</Text>
        </Pressable>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(2,5,12,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  panel: {
    alignItems: 'center',
    gap: theme.space.md,
    width: '100%',
    maxWidth: 340,
  },
  header: {flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch'},
  title: {
    ...typography.display(20),
    color: theme.state.star,
    flex: 1,
    letterSpacing: 2,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {fontSize: 18, color: theme.text.secondary},
  preview: {
    backgroundColor: theme.bg.base,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
  },
  caption: {...typography.body(15), textAlign: 'center'},
  cta: {alignSelf: 'stretch'},
  cancel: {
    ...typography.ui(13),
    color: theme.text.secondary,
    letterSpacing: 2,
    paddingVertical: theme.space.sm,
  },
});
