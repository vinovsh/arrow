import React from 'react';
import {G, Path} from 'react-native-svg';
import type {DecorPath} from '../models/types';
import {theme} from '../../theme/theme';

interface Props {
  decor: readonly DecorPath[];
  boardSize: number;
}

/**
 * §10.2 — the cat's eyes, the apple's leaf highlight, the rocket's window.
 *
 * Drawn in `text.primary` at 70% as a non-interactive overlay. It occupies no grid
 * cells and is never hit-tested, so it can sit anywhere in the square, and from level
 * 100 onward it is mandatory: at high density a solid silhouette carries much less
 * character than an outline drawing does (§4.2).
 *
 * Path data is authored in normalised board coordinates (0..1 across the board), so
 * one decor definition serves every grid size a shape is used at.
 */
function DecorLayerBase({decor, boardSize}: Props): React.JSX.Element | null {
  if (decor.length === 0) {
    return null;
  }
  return (
    <G opacity={0.7} pointerEvents="none" transform={`scale(${boardSize})`}>
      {decor.map((path, i) => (
        <Path
          key={i}
          d={path.d}
          fill={path.fill ? theme.text.primary : 'none'}
          stroke={path.fill ? 'none' : theme.text.primary}
          strokeWidth={path.w ?? 0.03}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </G>
  );
}

export const DecorLayer = React.memo(DecorLayerBase);
