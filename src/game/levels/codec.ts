import type {
  ArrowColor,
  ArrowPath,
  Band,
  DecorPath,
  Direction,
  Level,
} from '../models/types';

/**
 * Pack wire format — §8.5. Keys are single characters because 500 levels of up to
 * 90 arrows is the largest thing shipped in the bundle; at ~3KB per dense level the
 * whole set lands near 1.4MB.
 */
export interface PackedLevel {
  id: number;
  /** grid size */
  g: number;
  /** theme (shape name) */
  t: string;
  /** band */
  b: Band;
  /** difficulty D */
  d: number;
  /** par time, seconds */
  p: number;
  /** arrows: [colorKey, "x,y x,y ...", direction] */
  a: [string, string, Direction][];
  /** decor overlay */
  dec?: DecorPath[];
}

export interface LevelPack {
  v: 1;
  from: number;
  to: number;
  levels: PackedLevel[];
}

export const COLOR_KEYS: Record<ArrowColor, string> = {
  cyan: 'c',
  green: 'g',
  orange: 'o',
  pink: 'k',
  purple: 'u',
  yellow: 'y',
  blue: 'b',
  white: 'w',
};

const KEY_TO_COLOR: Record<string, ArrowColor> = Object.entries(
  COLOR_KEYS,
).reduce((acc, [color, key]) => {
  acc[key] = color as ArrowColor;
  return acc;
}, {} as Record<string, ArrowColor>);

export function packArrow(arrow: ArrowPath): [string, string, Direction] {
  return [
    COLOR_KEYS[arrow.color],
    arrow.cells.map(c => `${c.x},${c.y}`).join(' '),
    arrow.direction,
  ];
}

export function packLevel(level: Level): PackedLevel {
  const packed: PackedLevel = {
    id: level.id,
    g: level.gridSize,
    t: level.theme,
    b: level.band,
    d: level.difficulty,
    p: level.parTime,
    a: level.arrows.map(packArrow),
  };
  if (level.decor && level.decor.length > 0) {
    packed.dec = level.decor;
  }
  return packed;
}

export function unpackLevel(packed: PackedLevel): Level {
  const arrows: ArrowPath[] = packed.a.map((entry, index) => {
    const [colorKey, cellsText, direction] = entry;
    const cells = cellsText.split(' ').map(token => {
      const comma = token.indexOf(',');
      return {
        x: Number(token.slice(0, comma)),
        y: Number(token.slice(comma + 1)),
      };
    });
    return {
      id: `a${index}`,
      color: KEY_TO_COLOR[colorKey] ?? 'white',
      cells,
      direction,
    };
  });

  return {
    id: packed.id,
    gridSize: packed.g,
    theme: packed.t,
    band: packed.b,
    difficulty: packed.d,
    parTime: packed.p,
    arrows,
    decor: packed.dec,
  };
}
