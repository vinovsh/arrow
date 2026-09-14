import React from 'react';
import {Path} from 'react-native-svg';
import {theme} from '../../theme/theme';
import {dotRadiusFor} from '../../utils/layout';

interface Props {
  gridSize: number;
  cellSize: number;
}

/**
 * §13 — the dot grid is a single `<Path>`, never one `<Circle>` per dot.
 *
 * A 14x14 board is 196 dots; as individual nodes that alone blows the frame budget
 * before a single arrow is drawn. Each dot is instead a tiny arc pair in one path
 * string, which the renderer treats as a single node.
 */
function DotGridBase({gridSize, cellSize}: Props): React.JSX.Element {
  const radius = dotRadiusFor(cellSize);
  let d = '';
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cx = (x + 0.5) * cellSize;
      const cy = (y + 0.5) * cellSize;
      d +=
        `M ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} ` +
        `a ${radius} ${radius} 0 1 0 ${(radius * 2).toFixed(2)} 0 ` +
        `a ${radius} ${radius} 0 1 0 ${(-radius * 2).toFixed(2)} 0 `;
    }
  }
  return <Path d={d} fill={theme.grid.dot} />;
}

export const DotGrid = React.memo(DotGridBase);
