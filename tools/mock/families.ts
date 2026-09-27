/**
 * Parametric pattern families for mock levels 201-500.
 *
 * Levels 3-200 were each drawn by hand. Three hundred more hand-drawn pictures would
 * start repeating themselves, so the later levels are built from families whose
 * parameters change the picture, not just its size: a truchet maze with a different
 * seed and tile is a different maze, a rose with 12 petals and two nested outlines is
 * not the rose with 8. Every family still produces a mask plus channels, exactly like
 * the hand-drawn patterns, so the arrows carry the art.
 *
 * Nothing here is read by the game. See buildMocks.ts.
 */
import {insideShape} from '../shapes/dsl.ts';
import {shapeByName} from '../shapes/library.ts';
import type {Pattern} from './patterns.ts';
import {
  G,
  P,
  circle,
  heart,
  lineDist,
  outlineOf,
  polar,
  poly,
  ringLine,
  spiralAt,
  squareLine,
  starPts,
} from './patterns.ts';

type Pred = (x: number, y: number, n: number) => boolean;

/** Deterministic hash to [0, 1). */
export function hash(a: number, b: number, seed: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const regularPts = (cx: number, cy: number, r: number, sides: number, phase: number) =>
  Array.from({length: sides}, (_, i) => [cx + r * Math.cos(phase + (i * 2 * Math.PI) / sides), cy + r * Math.sin(phase + (i * 2 * Math.PI) / sides)] as [number, number]);

// -------------------------------------------------------------- outlines

/** Named fill predicates: hand-drawn patterns, library silhouettes, and basic frames. */
export function fillOf(name: string): Pred {
  if (name === 'full') {
    return () => true;
  }
  if (name === 'circle') {
    return (x, y) => circle(x, y, 0.5, 0.5, 0.56);
  }
  if (name === 'disc') {
    return (x, y) => circle(x, y, 0.5, 0.5, 0.5);
  }
  if (name === 'hexagon') {
    return (x, y) => poly(x, y, regularPts(0.5, 0.5, 0.58, 6, 0));
  }
  if (name === 'octagon') {
    return (x, y) => poly(x, y, regularPts(0.5, 0.5, 0.6, 8, Math.PI / 8));
  }
  if (name === 'diamondFrame') {
    return (x, y) => Math.abs(x - 0.5) + Math.abs(y - 0.5) <= 0.62;
  }
  if (name === 'heartFill') {
    return (x, y) => heart(x, y, 0.5, 0.47, 0.5);
  }
  if (name === 'star5Fill') {
    return (x, y) => poly(x, y, starPts(0.5, 0.55, 0.62, 0.32, 5));
  }
  if (name.startsWith('lib:')) {
    const def = shapeByName(name.slice(4));
    if (!def) {
      throw new Error(`unknown library shape ${name}`);
    }
    return (x, y) => insideShape(def.ops, x, y);
  }
  const pattern = P[name];
  if (!pattern) {
    throw new Error(`unknown fill ${name}`);
  }
  return pattern.fill;
}

// -------------------------------------------------------------- textures

export type Texture =
  | {k: 'none'}
  | {k: 'voronoi'; count: number; seed: number}
  | {k: 'truchet'; tile: number; seed: number; style: 'arc' | 'diag' | 'mixed'}
  | {k: 'rings'; spacing: number; cx?: number; cy?: number}
  | {k: 'stripes'; spacing: number; angle: number; wave?: number}
  | {k: 'lattice'; spacing: number}
  | {k: 'spiral'; arms: number; pitch: number; cx?: number; cy?: number}
  | {k: 'hexgrid'; size: number}
  | {k: 'bricks'; rows: number; cols: number}
  | {k: 'scales'; size: number}
  | {k: 'outline'; inset: number};

/** Voronoi seeds, fixed per (count, seed). */
function seeds(count: number, seed: number): [number, number][] {
  return Array.from({length: count}, (_, i) => [0.04 + 0.92 * hash(i, 1, seed), 0.04 + 0.92 * hash(i, 2, seed)] as [number, number]);
}

function voronoiEdge(x: number, y: number, n: number, pts: readonly [number, number][]): boolean {
  let d1 = Infinity;
  let d2 = Infinity;
  for (const [sx, sy] of pts) {
    const d = Math.hypot(x - sx, y - sy);
    if (d < d1) {
      d2 = d1;
      d1 = d;
    } else if (d < d2) {
      d2 = d;
    }
  }
  return d2 - d1 < 0.8 / n;
}

function hexLattice(size: number): [number, number][] {
  const pts: [number, number][] = [];
  const h = size * Math.sqrt(3) / 2;
  for (let row = -1; row * h < 1.1; row++) {
    for (let col = -1; col * size < 1.1; col++) {
      pts.push([col * size + (row % 2 === 0 ? 0 : size / 2), row * h]);
    }
  }
  return pts;
}

export function texture(t: Texture, fill: Pred): Pred {
  switch (t.k) {
    case 'none':
      return () => false;
    case 'voronoi': {
      const pts = seeds(t.count, t.seed);
      return (x, y, n) => voronoiEdge(x, y, n, pts);
    }
    case 'hexgrid': {
      const cache = new Map<number, [number, number][]>();
      return (x, y, n) => {
        let pts = cache.get(n);
        if (!pts) {
          pts = hexLattice(Math.max(t.size, 6 / n));
          cache.set(n, pts);
        }
        return voronoiEdge(x, y, n, pts);
      };
    }
    case 'truchet':
      return (x, y, n) => {
        // Arcs need room: below ~6 cells a tile is just a stub between two channels.
        const T = Math.max(t.tile + 3, 6);
        const fx = (x * n) / T;
        const fy = (y * n) / T;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const u = fx - i;
        const v = fy - j;
        const flip = hash(i, j, t.seed) > 0.5;
        const style = t.style === 'mixed' ? (hash(j, i, t.seed + 9) > 0.5 ? 'arc' : 'diag') : t.style;
        const half = 0.5 / T;
        if (style === 'arc') {
          const [ax, ay, bx, by] = flip ? [0, 0, 1, 1] : [1, 0, 0, 1];
          return Math.abs(Math.hypot(u - ax, v - ay) - 0.5) <= half || Math.abs(Math.hypot(u - bx, v - by) - 0.5) <= half;
        }
        const d = flip ? Math.abs(u - v) : Math.abs(u + v - 1);
        return d / Math.SQRT2 <= half;
      };
    case 'rings':
      return (x, y, n) => {
        const r = (polar(x, y, t.cx ?? 0.5, t.cy ?? 0.5).r * n) / t.spacing;
        return Math.abs(r - Math.round(r)) * t.spacing <= 0.5 && r > 0.6;
      };
    case 'stripes':
      return (x, y, n) => {
        const c = Math.cos(t.angle);
        const s = Math.sin(t.angle);
        const along = x * c + y * s;
        const across = -x * s + y * c + (t.wave ?? 0) * Math.sin(along * 12);
        const k = (across * n) / t.spacing;
        return Math.abs(k - Math.round(k)) * t.spacing <= 0.5;
      };
    case 'lattice':
      return (x, y, n) => {
        const u = ((x + y) * n) / t.spacing;
        const v = ((x - y) * n) / t.spacing;
        return Math.abs(u - Math.round(u)) * t.spacing <= 0.36 || Math.abs(v - Math.round(v)) * t.spacing <= 0.36;
      };
    case 'spiral':
      return (x, y, n) => !spiralAt(x, y, n, t.cx ?? 0.5, t.cy ?? 0.5, t.arms, t.pitch, t.pitch - 1);
    case 'bricks':
      return (x, y, n) => {
        const row = Math.floor(y * t.rows);
        if (Math.abs(y * t.rows - Math.round(y * t.rows)) / t.rows <= G(n) / 2) {
          return true;
        }
        const u = x * t.cols + (row % 2 === 0 ? 0 : 0.5);
        return Math.abs(u - Math.round(u)) / t.cols <= G(n) / 2;
      };
    case 'scales':
      return (x, y, n) => {
        const s = Math.max(t.size, 8 / n);
        const row = Math.floor(y / s);
        const off = row % 2 === 0 ? 0 : s / 2;
        const cx = Math.round((x - off) / s) * s + off;
        const cy = (row + 1) * s;
        return Math.abs(Math.hypot(x - cx, y - cy) - s * 0.62) <= G(n) / 2 && y < cy;
      };
    case 'outline':
      return (x, y, n) => {
        const d = t.inset / n;
        return fill(x, y, n) && !(fill(x + d, y, n) && fill(x - d, y, n) && fill(x, y + d, n) && fill(x, y - d, n));
      };
  }
}

/** A silhouette with an interior texture, optionally with extra channels. */
export function textured(fillName: string, t: Texture, extra?: Pred, flow: Pattern['flow'] = null): Pattern {
  const fill = fillOf(fillName);
  const tex = texture(t, fill);
  return {fill, gap: (x, y, n) => tex(x, y, n) || (extra ? extra(x, y, n) : false), flow};
}

// ---------------------------------------------------------- geometric art

/** Rose curve: `petals` petals of radius R, with `nest` nested outlines inside. */
export function rose(petals: number, R: number, nest: number, core: number, phase = 0): Pattern {
  const k = petals % 2 === 1 ? petals : petals / 2;
  const reach = (a: number) => R * Math.abs(Math.cos(k * (a - phase)));
  return {
    fill: (x, y) => {
      const {r, a} = polar(x, y);
      return r <= reach(a) || r <= core;
    },
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (core > 0 && Math.abs(r - core) <= G(n) / 2) {
        return true;
      }
      for (let i = 1; i <= nest; i++) {
        const s = 1 - i / (nest + 1);
        if (r > core && Math.abs(r - reach(a) * s) <= G(n) / 2) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  };
}

/** Nested regular polygons, each rotated by `twist` and scaled to fit inside the last. */
export function polyNest(sides: number, count: number, twist: number, R: number, full = false): Pattern {
  const shrink = Math.cos(Math.PI / sides) / Math.cos(Math.PI / sides - Math.abs(twist));
  const layers = Array.from({length: count}, (_, i) => regularPts(0.5, 0.5, R * Math.pow(shrink, i), sides, -Math.PI / 2 + Math.PI / sides + i * twist));
  return {
    fill: full ? () => true : (x, y) => poly(x, y, layers[0]),
    gap: (x, y, n) => {
      let last = Infinity;
      for (let i = 0; i < layers.length; i++) {
        const ri = R * Math.pow(shrink, i);
        if (ri < 3 / n || (i > 0 && (last - ri) * n < 2.8)) {
          continue;
        }
        last = ri;
        if ((i > 0 || full) && outlineOf((u, v) => poly(u, v, layers[i]), x, y, n)) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  };
}

/** Hypotrochoid (integer radii R, r and pen offset d) drawn as a channel. */
export function spirograph(R: number, r: number, d: number, clip: 'disc' | 'full' = 'disc'): Pattern {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const turns = Math.min(40, r / gcd(R, r));
  const scale = 0.46 / (R - r + d);
  const steps = Math.min(4000, Math.round(turns * 120));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push([0.5 + x * scale, 0.5 + y * scale]);
  }
  return {
    fill: clip === 'disc' ? (x, y) => circle(x, y, 0.5, 0.5, 0.56) : () => true,
    gap: (x, y, n) => lineDist(x, y, pts) <= G(n) / 2 || (clip === 'full' && squareLine(x, y, n, 0.47)),
  };
}

/** Lissajous figure as a channel over the full board. */
export function lissajous(a: number, b: number, phase: number): Pattern {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 1600; i++) {
    const t = (i / 1600) * 2 * Math.PI;
    pts.push([0.5 + 0.44 * Math.sin(a * t + phase), 0.5 + 0.44 * Math.sin(b * t)]);
  }
  return {fill: () => true, gap: (x, y, n) => lineDist(x, y, pts) <= G(n) / 2 || squareLine(x, y, n, 0.48)};
}

/** Spiral galaxy with warp, arms and an optional off-centre core. */
export function galaxyArt(arms: number, pitch: number, warp: number, cx = 0.5, cy = 0.5, clip = 0.62): Pattern {
  return {
    fill: (x, y) => circle(x, y, cx, cy, clip) || clip > 0.9,
    gap: (x, y, n) => {
      const u = x + warp * Math.sin(y * 7);
      const v = y + warp * Math.sin(x * 6);
      if (circle(u, v, cx, cy, 0.05)) {
        return true;
      }
      return !spiralAt(u, v, n, cx, cy, arms, pitch, pitch - 1);
    },
    flow: 'tangent',
  };
}

/** Generic mandala: rings, spoke sets per band, petal arcs on the rim. */
export function mandalaArt(opts: {
  rings: number[];
  spokes: [number, number, number, number][];
  rim?: {count: number; r: number; size: number; phase: number};
  edge?: 'circle' | 'full' | 'octagon';
}): Pattern {
  const edge = opts.edge ?? 'circle';
  return {
    fill: edge === 'full' ? () => true : edge === 'octagon' ? fillOf('octagon') : (x, y) => circle(x, y, 0.5, 0.5, 0.57),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      let lastRing = -Infinity;
      for (const k of [...opts.rings].sort((p, q) => p - q)) {
        if ((k - lastRing) * n < 3) {
          continue;
        }
        lastRing = k;
        if (ringLine(x, y, n, k)) {
          return true;
        }
      }
      for (const [want, off0, r0, r1] of opts.spokes) {
        // Spokes at least ~3.5 cells apart at the inner radius, in multiples of 4.
        const count = Math.min(want, 4 * Math.floor((2 * Math.PI * Math.max(r0, 0.05) * n) / 14));
        if (count < 4) {
          continue;
        }
        const off = off0 === 0 ? 0 : Math.PI / count;
        if (r > r0 && r < r1) {
          for (let i = 0; i < count; i++) {
            const b = off + (i * 2 * Math.PI) / count;
            if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
              return true;
            }
          }
        }
      }
      if (opts.rim) {
        const {count, r: rr, size, phase} = opts.rim;
        for (let i = 0; i < count; i++) {
          const b = phase + (i * 2 * Math.PI) / count;
          if (r > rr - size && ringLine(x, y, n, size, 0.5 + rr * Math.cos(b), 0.5 + rr * Math.sin(b))) {
            return true;
          }
        }
      }
      return edge === 'full' && squareLine(x, y, n, 0.48);
    },
    flow: 'tangent',
  };
}

// ---------------------------------------------------------------- fractals

export function carpet(depth: number): Pattern {
  return {
    fill: (x, y) => {
      let u = x;
      let v = y;
      for (let i = 0; i < depth; i++) {
        u *= 3;
        v *= 3;
        if (Math.floor(u) % 3 === 1 && Math.floor(v) % 3 === 1) {
          return false;
        }
        u -= Math.floor(u);
        v -= Math.floor(v);
      }
      return true;
    },
    gap: (x, y, n) => squareLine(x, y, n, 0.48),
  };
}

/** Vicsek cross fractal: at every scale only the centre cross of a 3x3 split survives. */
export function vicsek(depth: number): Pattern {
  const inside = (x: number, y: number) => {
      let u = x;
      let v = y;
      for (let i = 0; i < depth; i++) {
        u *= 3;
        v *= 3;
        const a = Math.min(2, Math.floor(u));
        const b = Math.min(2, Math.floor(v));
        if (a !== 1 && b !== 1) {
          return false;
        }
        u -= Math.floor(u);
        v -= Math.floor(v);
      }
      return true;
  };
  // Drawn as channels over a full board: the bare fractal is under a fifth filled.
  return {
    fill: () => true,
    gap: (x, y, n) => outlineOf(inside, x, y, n) || squareLine(x, y, n, 0.48),
    flow: 'square',
  };
}

export function hTree(depth: number): Pattern {
  const segs: [number, number, number, number][] = [];
  const grow = (cx: number, cy: number, len: number, horizontal: boolean, d: number) => {
    if (d === 0) {
      return;
    }
    const [x1, y1, x2, y2] = horizontal ? [cx - len / 2, cy, cx + len / 2, cy] : [cx, cy - len / 2, cx, cy + len / 2];
    segs.push([x1, y1, x2, y2]);
    grow(x1, y1, len / Math.SQRT2, !horizontal, d - 1);
    grow(x2, y2, len / Math.SQRT2, !horizontal, d - 1);
  };
  grow(0.5, 0.5, 0.5, true, depth);
  return {
    fill: () => true,
    gap: (x, y, n) => segs.some(([x1, y1, x2, y2]) => lineDist(x, y, [[x1, y1], [x2, y2]]) <= G(n) / 2) || squareLine(x, y, n, 0.48),
  };
}

// ------------------------------------------------------------ compositions

export interface Placed {
  name: string;
  /** A family-built pattern to place instead of a named one. */
  pattern?: Pattern;
  cx: number;
  cy: number;
  s: number;
  /** rotation in quarter turns */
  q?: number;
  flipX?: boolean;
}

/** Several patterns placed on one board, each scaled into its own box. */
export function compose(items: Placed[], background?: {fill: Pred; gap?: Pred}): Pattern {
  const map = (it: Placed, x: number, y: number): [number, number] => {
    let u = (x - it.cx) / it.s;
    let v = (y - it.cy) / it.s;
    for (let k = 0; k < ((it.q ?? 0) % 4 + 4) % 4; k++) {
      const t = u;
      u = v;
      v = -t;
    }
    if (it.flipX) {
      u = -u;
    }
    return [u + 0.5, v + 0.5];
  };
  const pats = items.map(it => it.pattern ?? P[it.name] ?? {fill: fillOf(it.name)});
  const inside = (i: number, u: number, v: number) => u >= 0 && v >= 0 && u <= 1 && v <= 1 && pats[i].fill(u, v, 0);
  return {
    fill: (x, y, n) => {
      for (let i = 0; i < items.length; i++) {
        const [u, v] = map(items[i], x, y);
        if (u >= 0 && v >= 0 && u <= 1 && v <= 1 && pats[i].fill(u, v, n * items[i].s)) {
          return true;
        }
      }
      return background ? background.fill(x, y, n) : false;
    },
    gap: (x, y, n) => {
      for (let i = 0; i < items.length; i++) {
        const [u, v] = map(items[i], x, y);
        if (inside(i, u, v)) {
          const g = pats[i].gap;
          const edge = outlineOf((a, b) => {
            const [p, q] = map(items[i], a, b);
            return p >= 0 && q >= 0 && p <= 1 && q <= 1 && pats[i].fill(p, q, n * items[i].s);
          }, x, y, n);
          return (g ? g(u, v, n * items[i].s) : false) || (background !== undefined && edge);
        }
      }
      return background?.gap ? background.gap(x, y, n) : false;
    },
  };
}

// --------------------------------------------------------------- lettering

const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

/** Block digits centred in a box, as a fill predicate. */
export function digits(text: string, cx: number, cy: number, h: number): Pred {
  const w = h * 0.6;
  const gap = h * 0.16;
  const total = text.length * w + (text.length - 1) * gap;
  return (x, y) => {
    const top = cy - h / 2;
    if (y < top || y > top + h) {
      return false;
    }
    const left = cx - total / 2;
    const i = Math.floor((x - left) / (w + gap));
    if (i < 0 || i >= text.length) {
      return false;
    }
    const lx = x - left - i * (w + gap);
    if (lx > w) {
      return false;
    }
    const glyph = FONT[text[i]];
    const col = Math.min(2, Math.floor((lx / w) * 3));
    const row = Math.min(4, Math.floor(((y - top) / h) * 5));
    return glyph[row][col] === '#';
  };
}

/** A numbered seal: digits inside a ringed medallion. */
export function numberSeal(text: string, rings: number[], spokes: number): Pattern {
  const num = digits(text, 0.5, 0.5, 0.3);
  const numOutline = (x: number, y: number, n: number) => outlineOf((u, v) => num(u, v, n), x, y, n);
  return {
    fill: () => true,
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (squareLine(x, y, n, 0.48) || rings.some(k => ringLine(x, y, n, k))) {
        return true;
      }
      if (r > rings[0] && spokes > 0) {
        for (let i = 0; i < spokes; i++) {
          const b = (i * 2 * Math.PI) / spokes;
          if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
            return true;
          }
        }
      }
      return numOutline(x, y, n);
    },
  };
}

// ------------------------------------------------------------ misc builders

/** Concentric polygon/ring frames of alternating shapes (squares, diamonds, circles). */
export function frames(seq: ('s' | 'd' | 'c' | 'h' | 'o')[], start: number, step: number): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) =>
      seq.some((kind, i) => {
        const eff = Math.max(step, 3.2 / n);
        const k = start - i * eff;
        if (k <= 0.02) {
          return false;
        }
        switch (kind) {
          case 's':
            return squareLine(x, y, n, k);
          case 'd':
            return Math.abs(Math.abs(x - 0.5) + Math.abs(y - 0.5) - k * 1.3) <= G(n) * 0.5;
          case 'c':
            return ringLine(x, y, n, k);
          case 'h':
            return outlineOf((u, v) => poly(u, v, regularPts(0.5, 0.5, k * 1.1, 6, 0)), x, y, n);
          case 'o':
            return outlineOf((u, v) => poly(u, v, regularPts(0.5, 0.5, k * 1.05, 8, Math.PI / 8)), x, y, n);
        }
      }),
    flow: 'tangent',
  };
}

/** Grid of small motifs (stars, hearts, circles, diamonds) as outlines over a full board. */
export function motifGrid(kind: 'star' | 'heart' | 'ring' | 'diamond' | 'flower', want: number, jitterSeed = 0): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) => {
      const count = Math.max(2, Math.min(want, Math.floor(n / 7)));
      const step = 1 / count;
      const i = Math.floor(x / step);
      const j = Math.floor(y / step);
      const jx = jitterSeed ? (hash(i, j, jitterSeed) - 0.5) * step * 0.2 : 0;
      const cx = (i + 0.5) * step + jx;
      const cy = (j + 0.5) * step;
      const r = step * 0.38;
      if (Math.min(x - i * step, (i + 1) * step - x, y - j * step, (j + 1) * step - y) <= G(n) / 2) {
        return true;
      }
      switch (kind) {
        case 'star':
          return outlineOf((u, v) => poly(u, v, starPts(cx, cy, r, r * 0.45, 5)), x, y, n);
        case 'heart':
          return outlineOf((u, v) => heart(u, v, cx, cy, r), x, y, n);
        case 'ring':
          return ringLine(x, y, n, r * 0.8, cx, cy);
        case 'diamond':
          return Math.abs(Math.abs(x - cx) + Math.abs(y - cy) - r) <= G(n) * 0.5;
        case 'flower':
          return ringLine(x, y, n, r * 0.85, cx, cy) || ringLine(x, y, n, r * 0.35, cx, cy);
      }
    },
  };
}

/** Wavy horizontal bands, each carrying its own wave frequency. */
export function waveBands(count: number, amp: number, seed: number): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) => {
      const bands = Math.min(count, Math.floor(n / 3.5));
      for (let k = 1; k < bands; k++) {
        const f = 1 + Math.floor(hash(k, 0, seed) * 3);
        const ph = hash(k, 1, seed) * 6;
        if (Math.abs(y - k / bands - amp * Math.sin(2 * Math.PI * f * x + ph)) <= G(n) / 2) {
          return true;
        }
      }
      return false;
    },
    flow: 'horizontal',
  };
}


/** Scatter `count` copies of a named pattern without overlap, deterministically. */
export function scatter(names: string[], count: number, seed: number, sMin: number, sMax: number): Placed[] {
  const out: Placed[] = [];
  for (let tries = 0; out.length < count && tries < 4000; tries++) {
    const s = sMin + (sMax - sMin) * hash(tries, 3, seed);
    const cx = s / 2 + (1 - s) * hash(tries, 4, seed);
    const cy = s / 2 + (1 - s) * hash(tries, 5, seed);
    if (out.every(o => Math.hypot(o.cx - cx, o.cy - cy) > (o.s + s) * 0.46)) {
      out.push({name: names[out.length % names.length], cx, cy, s, q: hash(tries, 6, seed) > 0.8 ? 1 : 0, flipX: hash(tries, 7, seed) > 0.5});
    }
  }
  return out;
}

/** A mandala built from a single number: spokes (multiple of 4), bands and rim circles. */
export function mandalaN(spokes: number, bands: number, rim: number, edge: 'circle' | 'full' | 'octagon' = 'circle'): Pattern {
  const rings = Array.from({length: bands}, (_, i) => 0.08 + ((0.48 - 0.08) * (i + 1)) / bands);
  const spokeSets: [number, number, number, number][] = [];
  let prev = 0.08;
  rings.forEach((r, i) => {
    const count = i === 0 ? 4 : spokes;
    spokeSets.push([count, i % 2 === 0 ? 0 : Math.PI / count, prev, r]);
    prev = r;
  });
  return mandalaArt({rings: [0.08, ...rings], spokes: spokeSets, rim: rim > 0 ? {count: rim, r: 0.52, size: 0.07, phase: Math.PI / rim} : undefined, edge});
}

/** Union of two patterns' channels over the first one's fill. */
export function overlay(base: Pattern, extra: Pred): Pattern {
  return {fill: base.fill, gap: (x, y, n) => (base.gap ? base.gap(x, y, n) : false) || extra(x, y, n), flow: base.flow};
}

/** Silhouette as a figure over a textured ground: outline, inner texture, outer texture. */
export function figure(fillName: string, inner: Texture, outer: Texture): Pattern {
  const shape = fillOf(fillName);
  const tin = texture(inner, shape);
  const tout = texture(outer, () => true);
  return {
    fill: () => true,
    gap: (x, y, n) =>
      outlineOf((u, v) => shape(u, v, n), x, y, n) || (shape(x, y, n) ? tin(x, y, n) : tout(x, y, n)) || squareLine(x, y, n, 0.48),
  };
}

/** Several sets of concentric rings; each point belongs to its nearest centre. */
export function moire(centres: [number, number][], spacing: number): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) => {
      let best = Infinity;
      let second = Infinity;
      let owner = 0;
      centres.forEach(([cx, cy], i) => {
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) {
          second = best;
          best = d;
          owner = i;
        } else if (d < second) {
          second = d;
        }
      });
      if (second - best < 0.8 / n) {
        return true;
      }
      const [cx, cy] = centres[owner];
      const k = (Math.hypot(x - cx, y - cy) * n) / spacing;
      return (Math.abs(k - Math.round(k)) * spacing <= 0.5 && k > 0.6) || squareLine(x, y, n, 0.48);
    },
    flow: 'tangent',
  };
}

/** Rays that curl as they leave the centre. */
export function sunRays(want: number, twist: number): Pattern {
  return {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.6),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (r < 0.08) {
        return ringLine(x, y, n, 0.05);
      }
      const count = Math.min(want, 4 * Math.floor((2 * Math.PI * 0.15 * n) / 14));
      const t = ((a - twist * r) * count) / (2 * Math.PI);
      return Math.abs(t - Math.round(t)) * ((2 * Math.PI * r * n) / count) <= 0.5 || ringLine(x, y, n, 0.08);
    },
    flow: 'tangent',
  };
}

/** Hexagonally packed circles, drawn as rings. */
export function circlePack(radius: number): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) => {
      const r = Math.max(radius, 4 / n);
      const dx = 2 * r;
      const dy = Math.sqrt(3) * r;
      let best = Infinity;
      const row0 = Math.round(y / dy);
      for (let row = row0 - 1; row <= row0 + 1; row++) {
        const off = ((row % 2) + 2) % 2 === 0 ? 0 : r;
        const c0 = Math.round((x - off) / dx);
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          best = Math.min(best, Math.abs(Math.hypot(x - c * dx - off, y - row * dy) - r * 0.86));
        }
      }
      return best <= G(n) / 2 || squareLine(x, y, n, 0.48);
    },
    flow: 'tangent',
  };
}

/** Dartboard: rings and staggered sector walls. */
export function dartboard(bands: number, sectors: number): Pattern {
  return {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.57),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      const step = Math.max(0.48 / bands, 3.2 / n);
      const k = r / step;
      if (Math.abs(k - Math.round(k)) * step <= G(n) / 2 && r > 0.04) {
        return true;
      }
      const band = Math.floor(k);
      const count = Math.min(sectors, 4 * Math.floor((2 * Math.PI * Math.max(band * step, 0.05) * n) / 14));
      if (count < 4 || band < 1) {
        return false;
      }
      const t = (a * count) / (2 * Math.PI) + (band % 2) * 0.5;
      return Math.abs(t - Math.round(t)) * ((2 * Math.PI * r * n) / count) <= 0.5;
    },
    flow: 'tangent',
  };
}

/** Nested chevrons pointing up, as channels. */
export function chevronBands(count: number, depth: number): Pattern {
  return {
    fill: () => true,
    gap: (x, y, n) => {
      const bands = Math.min(count, Math.floor(n / 3.5));
      const t = y + depth * (1 - Math.abs(x - 0.5) * 2);
      const k = t * bands;
      return Math.abs(k - Math.round(k)) / bands <= G(n) * 0.6 || squareLine(x, y, n, 0.48);
    },
  };
}
