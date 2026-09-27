import React from 'react';
import {Path} from 'react-native-svg';
import type {ArrowPath, GridPoint} from '../models/types';
import {theme} from '../../theme/theme';
import {dotRadiusFor} from '../../utils/layout';

interface Props {
  /** The cells that carry a dot — the board's occupied cells, not the whole grid. */
  cells: readonly GridPoint[];
  cellSize: number;
}

/**
 * §13 — the dot grid is a single `<Path>`, never one `<Circle>` per dot.
 *
 * A 14x14 board is 196 dots; as individual nodes that alone blows the frame budget
 * before a single arrow is drawn. Each dot is instead a tiny arc pair in one path
 * string, which the renderer treats as a single node.
 *
 * The dots mark the *path* cells, not every cell of the grid.
 *
 * The reference is unambiguous about this: on its level 1 the board shows no dots at
 * all until an arrow leaves, and then exactly six appear — one per cell of the column
 * it vacated (ref/Arrow, 210909 and 210919). A dot is the ghost of a path, which is
 * why a small board reads as a few lines on a blank page rather than as a lined sheet
 * of graph paper with three arrows on it. On a dense board every dot is covered by
 * the arrow drawn over it anyway, so this changes nothing above the tutorial except
 * the number of arcs in the string.
 */
function DotGridBase({cells, cellSize}: Props): React.JSX.Element {
  const radius = dotRadiusFor(cellSize);
  let d = '';
  for (const cell of cells) {
    const cx = (cell.x + 0.5) * cellSize;
    const cy = (cell.y + 0.5) * cellSize;
    d +=
      `M ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} ` +
      `a ${radius} ${radius} 0 1 0 ${(radius * 2).toFixed(2)} 0 ` +
      `a ${radius} ${radius} 0 1 0 ${(-radius * 2).toFixed(2)} 0 `;
  }
  return <Path d={d} fill={theme.board.dot} />;
}

/** Every cell an arrow occupies, in board order. Memoise this at the call site. */
export function pathCells(arrows: readonly ArrowPath[]): GridPoint[] {
  return arrows.flatMap(arrow => arrow.cells);
}

export const DotGrid = React.memo(DotGridBase);
