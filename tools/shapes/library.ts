import type {DecorPath} from '../../src/game/models/types.ts';
import type {ShapeOp} from './dsl.ts';
import {add, bar, circle, cut, ellipse, poly, rect} from './dsl.ts';

export type ShapeCategory =
  | 'fruit'
  | 'animal'
  | 'object'
  | 'nature'
  | 'symbol'
  | 'food'
  | 'vehicle'
  | 'weather';

export interface ShapeDef {
  name: string;
  category: ShapeCategory;
  ops: ShapeOp[];
  /**
   * Cosmetic overlay in normalised board coordinates (0..1 across the board).
   * Required on every shape used from level 100 onward (§4.2) — at high density the
   * silhouette alone carries less character.
   */
  decor?: DecorPath[];
  /** Smallest grid this silhouette stays legible on. */
  minGrid: number;
}

const eyes = (lx: number, rx: number, y: number, r: number): DecorPath[] => [
  {
    d: `M ${lx - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${
      -r * 2
    } 0`,
    fill: true,
  },
  {
    d: `M ${rx - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${
      -r * 2
    } 0`,
    fill: true,
  },
];

export const SHAPES: ShapeDef[] = [
  // ---------------------------------------------------------------- fruit
  {
    name: 'apple',
    category: 'fruit',
    minGrid: 5,
    ops: [
      add(ellipse(0.5, 0.63, 0.44, 0.33)),
      add(circle(0.33, 0.5, 0.21)),
      add(circle(0.67, 0.5, 0.21)),
      cut(ellipse(0.5, 0.27, 0.1, 0.1)),
      add(bar(0.5, 0.32, 0.55, 0.08, 0.06)),
      add(ellipse(0.66, 0.14, 0.13, 0.06, -0.5)),
    ],
    decor: [{d: 'M 0.30 0.50 q 0.05 -0.10 0.14 -0.12', w: 0.03}],
  },
  {
    name: 'pear',
    category: 'fruit',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.7, 0.28)),
      add(ellipse(0.5, 0.42, 0.19, 0.22)),
      add(bar(0.5, 0.26, 0.5, 0.06, 0.05)),
      add(ellipse(0.64, 0.12, 0.12, 0.055, -0.45)),
    ],
    decor: [{d: 'M 0.32 0.68 q 0.03 -0.12 0.11 -0.17', w: 0.03}],
  },
  {
    name: 'cherry',
    category: 'fruit',
    minGrid: 7,
    ops: [
      add(circle(0.32, 0.74, 0.19)),
      add(circle(0.7, 0.76, 0.17)),
      add(bar(0.32, 0.6, 0.52, 0.16, 0.05)),
      add(bar(0.7, 0.62, 0.54, 0.16, 0.05)),
      add(ellipse(0.66, 0.12, 0.13, 0.055, -0.4)),
    ],
    decor: [{d: 'M 0.24 0.72 q 0.03 -0.07 0.09 -0.09', w: 0.028}],
  },
  {
    name: 'strawberry',
    category: 'fruit',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.5, 1.0],
          [0.14, 0.5],
          [0.2, 0.3],
          [0.8, 0.3],
          [0.86, 0.5],
        ]),
      ),
      add(ellipse(0.5, 0.36, 0.34, 0.16)),
      add(
        poly([
          [0.5, 0.06],
          [0.78, 0.2],
          [0.62, 0.28],
          [0.38, 0.28],
          [0.22, 0.2],
        ]),
      ),
    ],
    decor: [
      {d: 'M 0.40 0.52 l 0.02 0.04', w: 0.035},
      {d: 'M 0.60 0.52 l 0.02 0.04', w: 0.035},
      {d: 'M 0.50 0.68 l 0.02 0.04', w: 0.035},
    ],
  },
  {
    name: 'lemon',
    category: 'fruit',
    minGrid: 5,
    ops: [
      add(ellipse(0.5, 0.5, 0.42, 0.28, -0.35)),
      add(bar(0.16, 0.76, 0.11, 0.83, 0.07)),
      add(bar(0.84, 0.24, 0.89, 0.17, 0.07)),
    ],
    decor: [{d: 'M 0.34 0.42 q 0.10 -0.06 0.20 -0.04', w: 0.03}],
  },
  {
    name: 'watermelon',
    category: 'fruit',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.06, 0.24],
          [0.94, 0.24],
          [0.5, 0.96],
        ]),
      ),
      add(rect(0.06, 0.14, 0.88, 0.12)),
    ],
    decor: [
      {d: 'M 0.36 0.42 l 0.02 0.05', w: 0.035},
      {d: 'M 0.56 0.44 l 0.02 0.05', w: 0.035},
      {d: 'M 0.46 0.62 l 0.02 0.05', w: 0.035},
    ],
  },
  {
    name: 'grapes',
    category: 'fruit',
    minGrid: 8,
    ops: [
      add(circle(0.5, 0.34, 0.13)),
      add(circle(0.31, 0.5, 0.13)),
      add(circle(0.69, 0.5, 0.13)),
      add(circle(0.5, 0.58, 0.13)),
      add(circle(0.2, 0.72, 0.12)),
      add(circle(0.8, 0.72, 0.12)),
      add(circle(0.5, 0.82, 0.13)),
      add(bar(0.5, 0.22, 0.5, 0.06, 0.05)),
      add(ellipse(0.68, 0.1, 0.12, 0.05, -0.4)),
    ],
  },
  {
    name: 'pineapple',
    category: 'fruit',
    minGrid: 8,
    ops: [
      add(ellipse(0.5, 0.66, 0.3, 0.32)),
      add(
        poly([
          [0.5, 0.02],
          [0.62, 0.2],
          [0.5, 0.34],
          [0.38, 0.2],
        ]),
      ),
      add(bar(0.32, 0.3, 0.44, 0.18, 0.08)),
      add(bar(0.68, 0.3, 0.56, 0.18, 0.08)),
    ],
    decor: [
      {d: 'M 0.34 0.56 l 0.32 0.24', w: 0.025},
      {d: 'M 0.66 0.56 l -0.32 0.24', w: 0.025},
    ],
  },
  {
    name: 'avocado',
    category: 'fruit',
    minGrid: 7,
    ops: [
      add(circle(0.5, 0.68, 0.29)),
      add(ellipse(0.5, 0.36, 0.19, 0.22)),
      cut(circle(0.5, 0.68, 0.11)),
    ],
    decor: [
      {
        d: 'M 0.5 0.68 m -0.09 0 a 0.09 0.09 0 1 0 0.18 0 a 0.09 0.09 0 1 0 -0.18 0',
        w: 0.03,
      },
    ],
  },

  // ---------------------------------------------------------------- animal
  {
    name: 'cat',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(
        poly([
          [0.2, 0.34],
          [0.2, 0.1],
          [0.36, 0.22],
        ]),
      ),
      add(
        poly([
          [0.62, 0.34],
          [0.62, 0.1],
          [0.46, 0.22],
        ]),
      ),
      add(ellipse(0.41, 0.3, 0.23, 0.17)),
      add(ellipse(0.41, 0.68, 0.26, 0.28)),
      add(bar(0.62, 0.86, 0.86, 0.5, 0.12)),
      add(bar(0.86, 0.5, 0.8, 0.32, 0.12)),
    ],
    decor: [
      ...eyes(0.33, 0.49, 0.3, 0.028),
      {d: 'M 0.41 0.36 l -0.03 -0.03 l 0.06 0 z', fill: true},
      {
        d: 'M 0.41 0.38 q -0.05 0.05 -0.09 0.0 M 0.41 0.38 q 0.05 0.05 0.09 0.0',
        w: 0.022,
      },
    ],
  },
  {
    name: 'dog',
    category: 'animal',
    minGrid: 8,
    ops: [
      add(ellipse(0.45, 0.32, 0.24, 0.19)),
      add(ellipse(0.2, 0.36, 0.09, 0.16)),
      add(ellipse(0.7, 0.36, 0.09, 0.16)),
      add(ellipse(0.45, 0.72, 0.27, 0.24)),
      add(bar(0.7, 0.82, 0.9, 0.6, 0.11)),
    ],
    decor: [
      ...eyes(0.37, 0.53, 0.3, 0.028),
      {
        d: 'M 0.45 0.4 m -0.04 0 a 0.04 0.03 0 1 0 0.08 0 a 0.04 0.03 0 1 0 -0.08 0',
        fill: true,
      },
    ],
  },
  {
    name: 'fish',
    category: 'animal',
    minGrid: 5,
    ops: [
      add(ellipse(0.42, 0.5, 0.36, 0.24)),
      add(
        poly([
          [0.76, 0.5],
          [0.98, 0.26],
          [0.98, 0.74],
        ]),
      ),
      add(
        poly([
          [0.36, 0.28],
          [0.5, 0.06],
          [0.58, 0.3],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.2 0.44 m -0.035 0 a 0.035 0.035 0 1 0 0.07 0 a 0.035 0.035 0 1 0 -0.07 0',
        fill: true,
      },
    ],
  },
  {
    name: 'bird',
    category: 'animal',
    minGrid: 6,
    ops: [
      add(ellipse(0.46, 0.6, 0.3, 0.26)),
      add(circle(0.68, 0.3, 0.16)),
      add(
        poly([
          [0.84, 0.3],
          [0.99, 0.36],
          [0.84, 0.4],
        ]),
      ),
      add(
        poly([
          [0.16, 0.62],
          [0.02, 0.86],
          [0.3, 0.82],
        ]),
      ),
      add(ellipse(0.44, 0.52, 0.18, 0.1, -0.3)),
    ],
    decor: [
      {
        d: 'M 0.72 0.27 m -0.032 0 a 0.032 0.032 0 1 0 0.064 0 a 0.032 0.032 0 1 0 -0.064 0',
        fill: true,
      },
    ],
  },
  {
    name: 'rabbit',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(ellipse(0.36, 0.18, 0.075, 0.17)),
      add(ellipse(0.6, 0.18, 0.075, 0.17)),
      add(ellipse(0.48, 0.44, 0.2, 0.15)),
      add(ellipse(0.46, 0.76, 0.26, 0.22)),
      add(circle(0.78, 0.86, 0.09)),
    ],
    decor: [
      ...eyes(0.41, 0.55, 0.43, 0.026),
      {d: 'M 0.48 0.5 l -0.03 -0.025 l 0.06 0 z', fill: true},
    ],
  },
  {
    name: 'bear',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(circle(0.26, 0.24, 0.12)),
      add(circle(0.74, 0.24, 0.12)),
      add(ellipse(0.5, 0.36, 0.27, 0.21)),
      add(ellipse(0.5, 0.74, 0.31, 0.24)),
    ],
    decor: [
      ...eyes(0.41, 0.59, 0.33, 0.028),
      {
        d: 'M 0.5 0.43 m -0.05 0 a 0.05 0.04 0 1 0 0.1 0 a 0.05 0.04 0 1 0 -0.1 0',
        fill: true,
      },
    ],
  },
  {
    name: 'owl',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(ellipse(0.5, 0.54, 0.32, 0.42)),
      add(
        poly([
          [0.22, 0.24],
          [0.3, 0.06],
          [0.4, 0.2],
        ]),
      ),
      add(
        poly([
          [0.78, 0.24],
          [0.7, 0.06],
          [0.6, 0.2],
        ]),
      ),
      add(bar(0.36, 0.98, 0.36, 0.9, 0.07)),
      add(bar(0.64, 0.98, 0.64, 0.9, 0.07)),
    ],
    decor: [
      {
        d: 'M 0.38 0.42 m -0.07 0 a 0.07 0.07 0 1 0 0.14 0 a 0.07 0.07 0 1 0 -0.14 0',
        w: 0.025,
      },
      {
        d: 'M 0.62 0.42 m -0.07 0 a 0.07 0.07 0 1 0 0.14 0 a 0.07 0.07 0 1 0 -0.14 0',
        w: 0.025,
      },
      {d: 'M 0.5 0.48 l -0.035 -0.04 l 0.07 0 z', fill: true},
    ],
  },
  {
    name: 'whale',
    category: 'animal',
    minGrid: 6,
    ops: [
      add(ellipse(0.46, 0.62, 0.38, 0.24)),
      add(
        poly([
          [0.8, 0.62],
          [0.99, 0.36],
          [0.99, 0.8],
        ]),
      ),
      add(bar(0.34, 0.4, 0.34, 0.2, 0.06)),
      add(ellipse(0.3, 0.16, 0.1, 0.07)),
    ],
    decor: [
      {
        d: 'M 0.22 0.6 m -0.033 0 a 0.033 0.033 0 1 0 0.066 0 a 0.033 0.033 0 1 0 -0.066 0',
        fill: true,
      },
    ],
  },
  {
    name: 'butterfly',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(ellipse(0.28, 0.34, 0.2, 0.22, -0.3)),
      add(ellipse(0.72, 0.34, 0.2, 0.22, 0.3)),
      add(ellipse(0.3, 0.72, 0.17, 0.19, 0.3)),
      add(ellipse(0.7, 0.72, 0.17, 0.19, -0.3)),
      add(bar(0.5, 0.16, 0.5, 0.9, 0.08)),
      add(bar(0.5, 0.18, 0.38, 0.04, 0.04)),
      add(bar(0.5, 0.18, 0.62, 0.04, 0.04)),
    ],
  },
  {
    name: 'turtle',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(ellipse(0.5, 0.5, 0.34, 0.28)),
      add(circle(0.86, 0.46, 0.11)),
      add(ellipse(0.24, 0.78, 0.11, 0.08, -0.5)),
      add(ellipse(0.66, 0.8, 0.11, 0.08, 0.5)),
      add(ellipse(0.22, 0.24, 0.1, 0.07, 0.5)),
      add(ellipse(0.66, 0.22, 0.1, 0.07, -0.5)),
    ],
    decor: [
      {d: 'M 0.5 0.24 l 0 0.52 M 0.22 0.5 l 0.56 0', w: 0.022},
      {
        d: 'M 0.9 0.43 m -0.028 0 a 0.028 0.028 0 1 0 0.056 0 a 0.028 0.028 0 1 0 -0.056 0',
        fill: true,
      },
    ],
  },
  {
    name: 'penguin',
    category: 'animal',
    minGrid: 6,
    ops: [
      add(ellipse(0.5, 0.6, 0.28, 0.38)),
      add(circle(0.5, 0.24, 0.18)),
      add(ellipse(0.18, 0.62, 0.08, 0.2, -0.2)),
      add(ellipse(0.82, 0.62, 0.08, 0.2, 0.2)),
      add(
        poly([
          [0.36, 0.98],
          [0.28, 0.92],
          [0.46, 0.92],
        ]),
      ),
      add(
        poly([
          [0.64, 0.98],
          [0.72, 0.92],
          [0.54, 0.92],
        ]),
      ),
    ],
    decor: [
      ...eyes(0.43, 0.57, 0.22, 0.026),
      {d: 'M 0.5 0.3 l -0.04 -0.035 l 0.08 0 z', fill: true},
    ],
  },
  {
    name: 'crab',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(ellipse(0.5, 0.52, 0.32, 0.22)),
      add(ellipse(0.13, 0.32, 0.11, 0.09, -0.5)),
      add(ellipse(0.87, 0.32, 0.11, 0.09, 0.5)),
      add(bar(0.24, 0.46, 0.14, 0.36, 0.06)),
      add(bar(0.76, 0.46, 0.86, 0.36, 0.06)),
      add(bar(0.3, 0.68, 0.16, 0.86, 0.06)),
      add(bar(0.7, 0.68, 0.84, 0.86, 0.06)),
      add(bar(0.44, 0.72, 0.4, 0.94, 0.06)),
      add(bar(0.56, 0.72, 0.6, 0.94, 0.06)),
    ],
    decor: [...eyes(0.42, 0.58, 0.42, 0.03)],
  },
  {
    name: 'snail',
    category: 'animal',
    minGrid: 7,
    ops: [
      add(circle(0.44, 0.48, 0.3)),
      cut(circle(0.44, 0.48, 0.16)),
      add(circle(0.44, 0.48, 0.08)),
      add(rect(0.14, 0.72, 0.72, 0.14)),
      add(ellipse(0.86, 0.66, 0.12, 0.13)),
      add(bar(0.86, 0.56, 0.92, 0.4, 0.045)),
      add(bar(0.8, 0.56, 0.74, 0.42, 0.045)),
    ],
  },
  {
    name: 'elephant',
    category: 'animal',
    minGrid: 8,
    ops: [
      add(ellipse(0.42, 0.44, 0.3, 0.28)),
      add(ellipse(0.14, 0.44, 0.14, 0.2)),
      add(bar(0.62, 0.56, 0.7, 0.86, 0.11)),
      add(bar(0.7, 0.86, 0.86, 0.8, 0.1)),
      add(rect(0.24, 0.66, 0.12, 0.3)),
      add(rect(0.46, 0.66, 0.12, 0.3)),
    ],
    decor: [
      {
        d: 'M 0.36 0.38 m -0.032 0 a 0.032 0.032 0 1 0 0.064 0 a 0.032 0.032 0 1 0 -0.064 0',
        fill: true,
      },
    ],
  },

  // ---------------------------------------------------------------- symbol
  {
    name: 'heart',
    category: 'symbol',
    minGrid: 5,
    ops: [
      add(circle(0.3, 0.33, 0.24)),
      add(circle(0.7, 0.33, 0.24)),
      add(
        poly([
          [0.06, 0.38],
          [0.94, 0.38],
          [0.5, 0.98],
        ]),
      ),
    ],
    decor: [{d: 'M 0.26 0.3 q 0.06 -0.09 0.14 -0.1', w: 0.035}],
  },
  {
    name: 'star',
    category: 'symbol',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.5, 0.02],
          [0.63, 0.36],
          [0.98, 0.38],
          [0.7, 0.6],
          [0.81, 0.96],
          [0.5, 0.74],
          [0.19, 0.96],
          [0.3, 0.6],
          [0.02, 0.38],
          [0.37, 0.36],
        ]),
      ),
    ],
  },
  {
    name: 'diamond',
    category: 'symbol',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.5, 0.02],
          [0.98, 0.42],
          [0.5, 0.98],
          [0.02, 0.42],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.2 0.42 l 0.6 0 M 0.5 0.02 l -0.3 0.4 M 0.5 0.02 l 0.3 0.4',
        w: 0.022,
      },
    ],
  },
  {
    name: 'crown',
    category: 'symbol',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.04, 0.2],
          [0.27, 0.52],
          [0.5, 0.14],
          [0.73, 0.52],
          [0.96, 0.2],
          [0.9, 0.78],
          [0.1, 0.78],
        ]),
      ),
      add(rect(0.08, 0.78, 0.84, 0.16)),
    ],
    decor: [
      {
        d: 'M 0.5 0.62 m -0.05 0 a 0.05 0.05 0 1 0 0.1 0 a 0.05 0.05 0 1 0 -0.1 0',
        w: 0.025,
      },
    ],
  },
  {
    name: 'moon',
    category: 'symbol',
    minGrid: 5,
    ops: [add(circle(0.46, 0.5, 0.44)), cut(circle(0.72, 0.4, 0.38))],
    decor: [
      {
        d: 'M 0.24 0.62 m -0.04 0 a 0.04 0.04 0 1 0 0.08 0 a 0.04 0.04 0 1 0 -0.08 0',
        w: 0.022,
      },
    ],
  },
  {
    name: 'anchor',
    category: 'symbol',
    minGrid: 7,
    ops: [
      add(circle(0.5, 0.12, 0.1)),
      cut(circle(0.5, 0.12, 0.045)),
      add(bar(0.5, 0.16, 0.5, 0.92, 0.1)),
      add(bar(0.26, 0.3, 0.74, 0.3, 0.08)),
      add(bar(0.12, 0.6, 0.16, 0.82, 0.08)),
      add(bar(0.16, 0.82, 0.5, 0.94, 0.08)),
      add(bar(0.88, 0.6, 0.84, 0.82, 0.08)),
      add(bar(0.84, 0.82, 0.5, 0.94, 0.08)),
    ],
  },
  {
    name: 'lightning',
    category: 'symbol',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.62, 0.02],
          [0.18, 0.56],
          [0.44, 0.56],
          [0.34, 0.98],
          [0.82, 0.42],
          [0.54, 0.42],
        ]),
      ),
    ],
  },
  {
    name: 'spade',
    category: 'symbol',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.5, 0.04],
          [0.96, 0.5],
          [0.04, 0.5],
        ]),
      ),
      add(circle(0.28, 0.52, 0.26)),
      add(circle(0.72, 0.52, 0.26)),
      add(
        poly([
          [0.42, 0.66],
          [0.58, 0.66],
          [0.66, 0.96],
          [0.34, 0.96],
        ]),
      ),
    ],
  },
  {
    name: 'club',
    category: 'symbol',
    minGrid: 7,
    ops: [
      add(circle(0.5, 0.26, 0.22)),
      add(circle(0.24, 0.56, 0.22)),
      add(circle(0.76, 0.56, 0.22)),
      add(
        poly([
          [0.42, 0.62],
          [0.58, 0.62],
          [0.68, 0.96],
          [0.32, 0.96],
        ]),
      ),
    ],
  },

  // ---------------------------------------------------------------- nature
  {
    name: 'tree',
    category: 'nature',
    minGrid: 5,
    ops: [
      add(circle(0.5, 0.3, 0.28)),
      add(circle(0.26, 0.46, 0.2)),
      add(circle(0.74, 0.46, 0.2)),
      add(rect(0.41, 0.56, 0.18, 0.42)),
    ],
    decor: [
      {
        d: 'M 0.5 0.62 l 0 0.3 M 0.5 0.72 l -0.09 -0.08 M 0.5 0.8 l 0.09 -0.08',
        w: 0.022,
      },
    ],
  },
  {
    name: 'leaf',
    category: 'nature',
    minGrid: 5,
    ops: [
      add(ellipse(0.46, 0.44, 0.3, 0.42, -0.7)),
      add(bar(0.5, 0.5, 0.86, 0.94, 0.06)),
    ],
    decor: [{d: 'M 0.2 0.16 L 0.72 0.72', w: 0.025}],
  },
  {
    name: 'flower',
    category: 'nature',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.2, 0.16)),
      add(circle(0.2, 0.38, 0.16)),
      add(circle(0.8, 0.38, 0.16)),
      add(circle(0.32, 0.66, 0.16)),
      add(circle(0.68, 0.66, 0.16)),
      add(circle(0.5, 0.44, 0.14)),
      add(bar(0.5, 0.6, 0.5, 0.98, 0.06)),
    ],
    decor: [
      {
        d: 'M 0.5 0.44 m -0.08 0 a 0.08 0.08 0 1 0 0.16 0 a 0.08 0.08 0 1 0 -0.16 0',
        w: 0.028,
      },
    ],
  },
  {
    name: 'mushroom',
    category: 'nature',
    minGrid: 6,
    ops: [
      add(ellipse(0.5, 0.42, 0.44, 0.3)),
      add(rect(0.06, 0.42, 0.88, 0.06)),
      add(rect(0.34, 0.46, 0.32, 0.5)),
    ],
    decor: [
      {
        d: 'M 0.32 0.3 m -0.06 0 a 0.06 0.06 0 1 0 0.12 0 a 0.06 0.06 0 1 0 -0.12 0',
        fill: true,
      },
      {
        d: 'M 0.66 0.36 m -0.05 0 a 0.05 0.05 0 1 0 0.1 0 a 0.05 0.05 0 1 0 -0.1 0',
        fill: true,
      },
    ],
  },
  {
    name: 'cactus',
    category: 'nature',
    minGrid: 6,
    ops: [
      add(rect(0.4, 0.14, 0.2, 0.84)),
      add(rect(0.12, 0.42, 0.16, 0.24)),
      add(rect(0.12, 0.42, 0.46, 0.14)),
      add(rect(0.72, 0.3, 0.16, 0.28)),
      add(rect(0.42, 0.3, 0.46, 0.14)),
      add(ellipse(0.5, 0.16, 0.1, 0.06)),
    ],
    decor: [{d: 'M 0.5 0.36 l 0 0.5', w: 0.022}],
  },
  {
    name: 'mountain',
    category: 'nature',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.02, 0.92],
          [0.36, 0.22],
          [0.56, 0.6],
          [0.68, 0.42],
          [0.98, 0.92],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.24 0.46 L 0.36 0.24 L 0.47 0.46 L 0.4 0.4 L 0.32 0.48 z',
        fill: true,
      },
    ],
  },

  // ---------------------------------------------------------------- object
  {
    name: 'key',
    category: 'object',
    minGrid: 6,
    ops: [
      add(circle(0.24, 0.32, 0.2)),
      cut(circle(0.24, 0.32, 0.09)),
      add(bar(0.34, 0.44, 0.9, 0.86, 0.11)),
      add(bar(0.72, 0.86, 0.82, 0.68, 0.09)),
      add(bar(0.84, 0.94, 0.94, 0.78, 0.09)),
    ],
  },
  {
    name: 'lock',
    category: 'object',
    minGrid: 6,
    ops: [
      add(rect(0.16, 0.44, 0.68, 0.5)),
      add(circle(0.5, 0.32, 0.24)),
      cut(circle(0.5, 0.32, 0.13)),
      cut(rect(0.26, 0.34, 0.48, 0.14)),
    ],
    decor: [
      {
        d: 'M 0.5 0.66 m -0.06 0 a 0.06 0.06 0 1 0 0.12 0 a 0.06 0.06 0 1 0 -0.12 0 M 0.5 0.72 l 0 0.1',
        w: 0.03,
      },
    ],
  },
  {
    name: 'cup',
    category: 'object',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.14, 0.3],
          [0.74, 0.3],
          [0.66, 0.94],
          [0.22, 0.94],
        ]),
      ),
      add(bar(0.76, 0.42, 0.9, 0.54, 0.1)),
      add(bar(0.9, 0.54, 0.76, 0.68, 0.1)),
    ],
    decor: [
      {
        d: 'M 0.3 0.2 q 0.06 -0.1 0.0 -0.16 M 0.5 0.2 q 0.06 -0.1 0.0 -0.16',
        w: 0.028,
      },
    ],
  },
  {
    name: 'bell',
    category: 'object',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.46, 0.3)),
      add(rect(0.2, 0.46, 0.6, 0.3)),
      add(rect(0.1, 0.74, 0.8, 0.12)),
      add(circle(0.5, 0.94, 0.08)),
      add(circle(0.5, 0.12, 0.07)),
    ],
  },
  {
    name: 'umbrella',
    category: 'object',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.48, 0.44)),
      cut(rect(0.0, 0.48, 1.0, 0.6)),
      add(bar(0.5, 0.46, 0.5, 0.84, 0.07)),
      add(bar(0.5, 0.84, 0.32, 0.9, 0.07)),
    ],
    decor: [
      {d: 'M 0.28 0.46 q 0.11 -0.18 0.22 0 q 0.11 -0.18 0.22 0', w: 0.025},
    ],
  },
  {
    name: 'house',
    category: 'object',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.5, 0.06],
          [0.98, 0.46],
          [0.02, 0.46],
        ]),
      ),
      add(rect(0.14, 0.46, 0.72, 0.48)),
    ],
    decor: [
      {d: 'M 0.42 0.62 l 0.16 0 l 0 0.32 l -0.16 0 z', w: 0.026},
      {d: 'M 0.22 0.56 l 0.12 0 l 0 0.12 l -0.12 0 z', w: 0.024},
    ],
  },
  {
    name: 'gift',
    category: 'object',
    minGrid: 5,
    ops: [
      add(rect(0.08, 0.36, 0.84, 0.6)),
      add(rect(0.04, 0.24, 0.92, 0.14)),
      add(circle(0.36, 0.16, 0.11)),
      add(circle(0.64, 0.16, 0.11)),
    ],
    decor: [{d: 'M 0.5 0.26 l 0 0.7', w: 0.045}],
  },
  {
    name: 'balloon',
    category: 'object',
    minGrid: 5,
    ops: [
      add(ellipse(0.5, 0.38, 0.32, 0.36)),
      add(
        poly([
          [0.44, 0.72],
          [0.56, 0.72],
          [0.5, 0.82],
        ]),
      ),
      add(bar(0.5, 0.8, 0.62, 0.98, 0.04)),
    ],
    decor: [{d: 'M 0.32 0.3 q 0.06 -0.12 0.16 -0.14', w: 0.032}],
  },
  {
    name: 'clock',
    category: 'object',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.54, 0.42)),
      cut(circle(0.5, 0.54, 0.3)),
      add(circle(0.5, 0.54, 0.1)),
      add(bar(0.34, 0.14, 0.24, 0.06, 0.09)),
      add(bar(0.66, 0.14, 0.76, 0.06, 0.09)),
    ],
    decor: [{d: 'M 0.5 0.54 l 0 -0.18 M 0.5 0.54 l 0.14 0.08', w: 0.03}],
  },
  {
    name: 'lamp',
    category: 'object',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.34, 0.28)),
      add(rect(0.36, 0.56, 0.28, 0.14)),
      add(rect(0.38, 0.7, 0.24, 0.1)),
      add(rect(0.4, 0.8, 0.2, 0.14)),
    ],
    decor: [{d: 'M 0.42 0.3 l 0.04 0.14 l 0.08 -0.2 l 0.04 0.14', w: 0.028}],
  },
  {
    name: 'book',
    category: 'object',
    minGrid: 6,
    ops: [
      add(rect(0.06, 0.2, 0.88, 0.62)),
      add(
        poly([
          [0.06, 0.82],
          [0.5, 0.74],
          [0.94, 0.82],
          [0.94, 0.92],
          [0.5, 0.84],
          [0.06, 0.92],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.5 0.22 l 0 0.6 M 0.16 0.36 l 0.24 0 M 0.6 0.36 l 0.24 0',
        w: 0.024,
      },
    ],
  },
  {
    name: 'robot',
    category: 'object',
    minGrid: 7,
    ops: [
      add(rect(0.24, 0.16, 0.52, 0.34)),
      add(rect(0.2, 0.54, 0.6, 0.34)),
      add(rect(0.04, 0.56, 0.14, 0.26)),
      add(rect(0.82, 0.56, 0.14, 0.26)),
      add(rect(0.3, 0.9, 0.14, 0.1)),
      add(rect(0.56, 0.9, 0.14, 0.1)),
      add(bar(0.5, 0.16, 0.5, 0.05, 0.05)),
      add(circle(0.5, 0.04, 0.05)),
    ],
    decor: [
      ...eyes(0.38, 0.62, 0.3, 0.04),
      {d: 'M 0.38 0.42 l 0.24 0', w: 0.028},
    ],
  },
  {
    name: 'camera',
    category: 'object',
    minGrid: 6,
    ops: [
      add(rect(0.04, 0.3, 0.92, 0.52)),
      add(rect(0.3, 0.18, 0.28, 0.14)),
      add(circle(0.5, 0.56, 0.2)),
    ],
    decor: [
      {
        d: 'M 0.5 0.56 m -0.12 0 a 0.12 0.12 0 1 0 0.24 0 a 0.12 0.12 0 1 0 -0.24 0',
        w: 0.03,
      },
      {
        d: 'M 0.84 0.4 m -0.04 0 a 0.04 0.04 0 1 0 0.08 0 a 0.04 0.04 0 1 0 -0.08 0',
        fill: true,
      },
    ],
  },
  {
    name: 'kite',
    category: 'object',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.5, 0.02],
          [0.94, 0.4],
          [0.5, 0.78],
          [0.06, 0.4],
        ]),
      ),
      add(bar(0.5, 0.78, 0.62, 0.98, 0.05)),
    ],
    decor: [{d: 'M 0.5 0.02 l 0 0.76 M 0.06 0.4 l 0.88 0', w: 0.024}],
  },

  // ---------------------------------------------------------------- food
  {
    name: 'icecream',
    category: 'food',
    minGrid: 6,
    ops: [
      add(circle(0.32, 0.24, 0.19)),
      add(circle(0.68, 0.24, 0.19)),
      add(circle(0.5, 0.36, 0.2)),
      add(
        poly([
          [0.16, 0.44],
          [0.84, 0.44],
          [0.5, 0.98],
        ]),
      ),
    ],
    decor: [{d: 'M 0.3 0.56 L 0.62 0.62 M 0.36 0.72 L 0.58 0.76', w: 0.024}],
  },
  {
    name: 'donut',
    category: 'food',
    minGrid: 6,
    ops: [add(circle(0.5, 0.5, 0.46)), cut(circle(0.5, 0.5, 0.16))],
    decor: [
      {d: 'M 0.3 0.26 l 0.06 0.05', w: 0.035},
      {d: 'M 0.68 0.3 l 0.05 0.06', w: 0.035},
      {d: 'M 0.28 0.66 l 0.06 0.05', w: 0.035},
      {d: 'M 0.66 0.68 l 0.05 0.05', w: 0.035},
    ],
  },
  {
    name: 'cupcake',
    category: 'food',
    minGrid: 6,
    ops: [
      add(circle(0.35, 0.32, 0.19)),
      add(circle(0.65, 0.32, 0.19)),
      add(circle(0.5, 0.24, 0.17)),
      add(
        poly([
          [0.12, 0.5],
          [0.88, 0.5],
          [0.74, 0.96],
          [0.26, 0.96],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.34 0.54 l -0.04 0.4 M 0.5 0.54 l 0 0.4 M 0.66 0.54 l 0.04 0.4',
        w: 0.024,
      },
    ],
  },
  {
    name: 'pizza',
    category: 'food',
    minGrid: 6,
    ops: [
      add(
        poly([
          [0.5, 0.04],
          [0.96, 0.9],
          [0.04, 0.9],
        ]),
      ),
      add(rect(0.04, 0.86, 0.92, 0.12)),
    ],
    decor: [
      {
        d: 'M 0.44 0.42 m -0.05 0 a 0.05 0.05 0 1 0 0.1 0 a 0.05 0.05 0 1 0 -0.1 0',
        fill: true,
      },
      {
        d: 'M 0.62 0.66 m -0.05 0 a 0.05 0.05 0 1 0 0.1 0 a 0.05 0.05 0 1 0 -0.1 0',
        fill: true,
      },
      {
        d: 'M 0.34 0.7 m -0.045 0 a 0.045 0.045 0 1 0 0.09 0 a 0.045 0.045 0 1 0 -0.09 0',
        fill: true,
      },
    ],
  },
  {
    name: 'popsicle',
    category: 'food',
    minGrid: 5,
    ops: [
      add(rect(0.24, 0.06, 0.52, 0.62)),
      add(ellipse(0.5, 0.1, 0.26, 0.1)),
      add(rect(0.42, 0.66, 0.16, 0.3)),
    ],
    decor: [{d: 'M 0.28 0.3 L 0.72 0.24 M 0.28 0.46 L 0.72 0.4', w: 0.028}],
  },
  {
    name: 'egg',
    category: 'food',
    minGrid: 5,
    ops: [
      add(ellipse(0.5, 0.6, 0.36, 0.38)),
      add(ellipse(0.5, 0.34, 0.26, 0.24)),
    ],
    decor: [{d: 'M 0.32 0.44 q 0.06 -0.14 0.18 -0.16', w: 0.03}],
  },

  // ---------------------------------------------------------------- vehicle
  {
    name: 'rocket',
    category: 'vehicle',
    minGrid: 5,
    ops: [
      add(ellipse(0.5, 0.42, 0.2, 0.36)),
      add(
        poly([
          [0.5, 0.0],
          [0.72, 0.3],
          [0.28, 0.3],
        ]),
      ),
      add(
        poly([
          [0.3, 0.5],
          [0.06, 0.86],
          [0.3, 0.82],
        ]),
      ),
      add(
        poly([
          [0.7, 0.5],
          [0.94, 0.86],
          [0.7, 0.82],
        ]),
      ),
      add(
        poly([
          [0.38, 0.76],
          [0.62, 0.76],
          [0.5, 1.0],
        ]),
      ),
    ],
    decor: [
      {
        d: 'M 0.5 0.34 m -0.09 0 a 0.09 0.09 0 1 0 0.18 0 a 0.09 0.09 0 1 0 -0.18 0',
        w: 0.028,
      },
    ],
  },
  {
    name: 'car',
    category: 'vehicle',
    minGrid: 6,
    ops: [
      add(rect(0.02, 0.5, 0.96, 0.26)),
      add(
        poly([
          [0.22, 0.5],
          [0.34, 0.24],
          [0.68, 0.24],
          [0.8, 0.5],
        ]),
      ),
      add(circle(0.24, 0.8, 0.14)),
      add(circle(0.76, 0.8, 0.14)),
    ],
    decor: [{d: 'M 0.5 0.26 l 0 0.22 M 0.3 0.46 L 0.72 0.46', w: 0.024}],
  },
  {
    name: 'boat',
    category: 'vehicle',
    minGrid: 5,
    ops: [
      add(
        poly([
          [0.02, 0.68],
          [0.98, 0.68],
          [0.8, 0.96],
          [0.2, 0.96],
        ]),
      ),
      add(bar(0.5, 0.66, 0.5, 0.04, 0.06)),
      add(
        poly([
          [0.54, 0.08],
          [0.92, 0.4],
          [0.54, 0.6],
        ]),
      ),
      add(
        poly([
          [0.46, 0.14],
          [0.14, 0.42],
          [0.46, 0.6],
        ]),
      ),
    ],
  },
  {
    name: 'plane',
    category: 'vehicle',
    minGrid: 6,
    ops: [
      add(ellipse(0.5, 0.5, 0.12, 0.46)),
      add(
        poly([
          [0.02, 0.62],
          [0.98, 0.62],
          [0.62, 0.44],
          [0.38, 0.44],
        ]),
      ),
      add(
        poly([
          [0.24, 0.94],
          [0.76, 0.94],
          [0.6, 0.82],
          [0.4, 0.82],
        ]),
      ),
    ],
  },
  {
    name: 'train',
    category: 'vehicle',
    minGrid: 7,
    ops: [
      add(rect(0.06, 0.44, 0.88, 0.34)),
      add(rect(0.5, 0.18, 0.4, 0.28)),
      add(rect(0.12, 0.28, 0.14, 0.18)),
      add(circle(0.24, 0.84, 0.12)),
      add(circle(0.52, 0.84, 0.12)),
      add(circle(0.8, 0.84, 0.12)),
    ],
    decor: [{d: 'M 0.58 0.26 l 0.24 0 l 0 0.14 l -0.24 0 z', w: 0.024}],
  },

  // ---------------------------------------------------------------- weather
  {
    name: 'sun',
    category: 'weather',
    minGrid: 5,
    ops: [
      add(circle(0.5, 0.5, 0.28)),
      add(bar(0.5, 0.0, 0.5, 0.14, 0.09)),
      add(bar(0.5, 0.86, 0.5, 1.0, 0.09)),
      add(bar(0.0, 0.5, 0.14, 0.5, 0.09)),
      add(bar(0.86, 0.5, 1.0, 0.5, 0.09)),
      add(bar(0.14, 0.14, 0.26, 0.26, 0.09)),
      add(bar(0.74, 0.74, 0.86, 0.86, 0.09)),
      add(bar(0.86, 0.14, 0.74, 0.26, 0.09)),
      add(bar(0.26, 0.74, 0.14, 0.86, 0.09)),
    ],
    decor: [
      ...eyes(0.42, 0.58, 0.46, 0.03),
      {d: 'M 0.4 0.56 q 0.1 0.1 0.2 0', w: 0.026},
    ],
  },
  {
    name: 'cloud',
    category: 'weather',
    minGrid: 5,
    ops: [
      add(circle(0.3, 0.54, 0.22)),
      add(circle(0.52, 0.42, 0.28)),
      add(circle(0.76, 0.56, 0.2)),
      add(rect(0.1, 0.54, 0.8, 0.22)),
    ],
  },
  {
    name: 'raindrop',
    category: 'weather',
    minGrid: 5,
    ops: [
      add(circle(0.5, 0.66, 0.3)),
      add(
        poly([
          [0.5, 0.02],
          [0.79, 0.68],
          [0.21, 0.68],
        ]),
      ),
    ],
    decor: [{d: 'M 0.34 0.66 q 0.02 -0.12 0.1 -0.18', w: 0.03}],
  },
  {
    name: 'snowflake',
    category: 'weather',
    minGrid: 7,
    ops: [
      add(bar(0.5, 0.02, 0.5, 0.98, 0.09)),
      add(bar(0.08, 0.26, 0.92, 0.74, 0.09)),
      add(bar(0.08, 0.74, 0.92, 0.26, 0.09)),
      add(bar(0.5, 0.16, 0.32, 0.06, 0.07)),
      add(bar(0.5, 0.16, 0.68, 0.06, 0.07)),
      add(bar(0.5, 0.84, 0.32, 0.94, 0.07)),
      add(bar(0.5, 0.84, 0.68, 0.94, 0.07)),
    ],
  },
  {
    name: 'rainbow',
    category: 'weather',
    minGrid: 6,
    ops: [
      add(circle(0.5, 0.92, 0.48)),
      cut(circle(0.5, 0.92, 0.2)),
      cut(rect(0.0, 0.92, 1.0, 0.2)),
      add(circle(0.14, 0.9, 0.12)),
      add(circle(0.86, 0.9, 0.12)),
    ],
  },
];

export const shapeByName = (name: string): ShapeDef | undefined =>
  SHAPES.find(s => s.name === name);
