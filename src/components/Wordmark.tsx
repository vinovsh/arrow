import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';

interface Props {
  size?: number;
  tagline?: boolean;
}

/**
 * §5.1 / §5.2 — the ARROW / ESCAPE wordmark.
 *
 * A true gradient fill on text needs a mask layer, which on Android costs an offscreen
 * buffer on a screen that also runs the drifting-arrow background. The wordmark instead
 * takes the first colour of each gradient as its fill and puts the gradient itself
 * behind, as a soft bloom — the same read at a fraction of the cost. The wordmark is
 * one of the three things allowed to glow (§10.2).
 */
export function Wordmark({
  size = 44,
  tagline = false,
}: Props): React.JSX.Element {
  return (
    <View style={styles.root}>
      <View>
        <LinearGradient
          colors={[...theme.brand.arrowWord, 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.bloom}
        />
        <Text style={[typography.display(size), styles.arrowWord]}>ARROW</Text>
      </View>
      <View>
        <LinearGradient
          colors={[...theme.brand.escapeWord]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.bloom}
        />
        <Text style={[typography.display(size), styles.escapeWord]}>
          ESCAPE
        </Text>
      </View>
      {tagline && <Text style={styles.tagline}>UNLOCK YOUR WAY OUT</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {alignItems: 'center'},
  bloom: {...StyleSheet.absoluteFillObject, opacity: 0.22, borderRadius: 18},
  arrowWord: {color: theme.brand.arrowWord[0], letterSpacing: 3},
  escapeWord: {color: theme.brand.escapeWord[0], letterSpacing: 3},
  tagline: {
    ...typography.ui(12),
    color: theme.brand.tagline,
    letterSpacing: 3.5,
    marginTop: theme.space.sm,
  },
});
