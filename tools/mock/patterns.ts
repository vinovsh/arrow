/**
 * Mock level designs, levels 3-50 — the plan and the pictures.
 *
 * Each entry names a grid size, a difficulty tier, a symmetry mode and a pattern. A
 * pattern is two predicates over the unit square: `fill` says where arrows may go and
 * `gap` carves thin empty channels through the fill. The channels are what make a
 * picture readable once it is packed with arrows — a heart outline, a spiral's arms,
 * the rings of a mandala — so the art is carried by the arrow structure itself rather
 * than drawn on top of it.
 *
 * Nothing here is read by the game. See buildMocks.ts.
 */

export type Tier = 'Easy' | 'Medium' | 'Hard' | 'Very Hard';

/**
 * mirror  - left/right mirror image, arrows included
 * rot4    - four-fold rotational symmetry, arrows included
 * rot2    - half-turn symmetry, arrows included
 * partial - symmetric silhouette, asymmetric arrows inside it
 * none    - asymmetric throughout
 */
export type Symmetry = 'mirror' | 'rot4' | 'rot2' | 'partial' | 'none';

/** Preferred run direction inside the picture: along rings, or none. */
export type Flow = 'tangent' | 'square' | 'horizontal' | 'vertical' | null;

type Pred = (x: number, y: number, n: number) => boolean;

export interface Pattern {
  fill: Pred;
  gap?: Pred;
  flow?: Flow;
}

export interface MockPlan {
  id: number;
  grid: number;
  tier: Tier;
  title: string;
  symmetry: Symmetry;
  pattern: Pattern;
}

// ---------------------------------------------------------------- primitives

export const sq = (v: number) => v * v;
export const circle = (x: number, y: number, cx: number, cy: number, r: number) =>
  sq(x - cx) + sq(y - cy) <= r * r;
export const ellipse = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
) => {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * c - dy * s;
  const v = dx * s + dy * c;
  return sq(u / rx) + sq(v / ry) <= 1;
};
export const rect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1;
export function poly(x: number, y: number, pts: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
export function segDist(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x1 + t * dx - x, y1 + t * dy - y);
}
export const bar = (x: number, y: number, x1: number, y1: number, x2: number, y2: number, t: number) =>
  segDist(x, y, x1, y1, x2, y2) <= t / 2;
/** Distance to a polyline. */
export function lineDist(x: number, y: number, pts: readonly [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  }
  return best;
}
export const polar = (x: number, y: number, cx = 0.5, cy = 0.5) => ({
  r: Math.hypot(x - cx, y - cy),
  a: Math.atan2(y - cy, x - cx),
});
/** One-cell-wide channel thickness, in unit-square coordinates. */
export const G = (n: number) => 1.0 / n;
/** True within half a channel of the circle of radius r. */
export const ringLine = (x: number, y: number, n: number, r: number, cx = 0.5, cy = 0.5) =>
  Math.abs(polar(x, y, cx, cy).r - r) <= G(n) / 2;
/** Radial spoke line at angle a, between radii r0 and r1. */
export const spoke = (x: number, y: number, n: number, a: number, r0: number, r1: number) =>
  bar(x, y, 0.5 + r0 * Math.cos(a), 0.5 + r0 * Math.sin(a), 0.5 + r1 * Math.cos(a), 0.5 + r1 * Math.sin(a), G(n));
export const diamondLine = (x: number, y: number, n: number, k: number) =>
  Math.abs(Math.abs(x - 0.5) + Math.abs(y - 0.5) - k) <= G(n) * 0.5;
export const squareLine = (x: number, y: number, n: number, k: number) =>
  Math.abs(Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) - k) <= G(n) / 2;

/** Heart centred on (cx, cy) with half-width s, optionally rotated. */
export function heart(x: number, y: number, cx: number, cy: number, s: number, rot = 0): boolean {
  const c = Math.cos(-rot);
  const si = Math.sin(-rot);
  const dx = x - cx;
  const dy = y - cy;
  const u = (dx * c - dy * si) / s;
  const v = (dx * si + dy * c) / s;
  // u, v in roughly [-1, 1]; lobes above, point below.
  return (
    circle(u, v, -0.48, -0.38, 0.54) ||
    circle(u, v, 0.48, -0.38, 0.54) ||
    poly(u, v, [
      [-1.0, -0.22],
      [1.0, -0.22],
      [0, 1.0],
    ])
  );
}
export function heartOutline(x: number, y: number, n: number, cx: number, cy: number, s: number): boolean {
  const g = G(n) * 0.6;
  return heart(x, y, cx, cy, s + g, 0) && !heart(x, y, cx, cy, s - g, 0);
}

/** Regular star polygon points. */
export function starPts(cx: number, cy: number, ro: number, ri: number, k: number, phase = -Math.PI / 2) {
  const pts: [number, number][] = [];
  for (let i = 0; i < k * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = phase + (i * Math.PI) / k;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
export function outlineOf(inside: (x: number, y: number) => boolean, x: number, y: number, n: number) {
  const d = G(n) * 0.55;
  const here = inside(x, y);
  return (
    here !== inside(x + d, y) ||
    here !== inside(x - d, y) ||
    here !== inside(x, y + d) ||
    here !== inside(x, y - d)
  );
}

/** Archimedean spiral band test: `arms` interleaved arms, pitch in cells. */
export function spiralBand(x: number, y: number, n: number, arms: number, pitchCells: number, bandCells: number, twist = 1) {
  const {r, a} = polar(x, y);
  const pitch = pitchCells / n;
  const phase = ((twist * a) / (2 * Math.PI) + 1) % 1; // 0..1
  const t = r / (pitch * arms) - phase;
  const frac = ((t % (1 / arms)) + 1 / arms) % (1 / arms);
  return frac * pitch * arms < bandCells / n;
}

// ----------------------------------------------------------------- patterns

export const FULL: Pred = () => true;

export const P: Record<string, Pattern> = {
  field: {fill: (x, y) => rect(x, y, 0, 0, 1, 1)},

  diamond: {
    fill: (x, y) => Math.abs(x - 0.5) + Math.abs(y - 0.5) <= 0.64,
    gap: (x, y) => Math.abs(x - 0.5) + Math.abs(y - 0.5) <= 0.1,
  },

  heart: {
    fill: (x, y) => heart(x, y, 0.5, 0.47, 0.5),
  },

  bolt: {
    fill: (x, y) =>
      poly(x, y, [
        [0.4, 0.0],
        [0.0, 0.62],
        [0.38, 0.62],
        [0.14, 1.0],
        [1.0, 0.34],
        [0.6, 0.34],
        [0.96, 0.0],
      ]),
  },

  plus: {
    fill: (x, y) => rect(x, y, 0.28, 0, 0.72, 1) || rect(x, y, 0, 0.28, 1, 0.72),
    gap: (x, y, n) => squareLine(x, y, n, 0.12),
    flow: 'square',
  },

  arrowUp: {
    fill: (x, y) =>
      poly(x, y, [
        [0.5, -0.04],
        [1.04, 0.5],
        [-0.04, 0.5],
      ]) || rect(x, y, 0.22, 0.46, 0.78, 1),
  },

  spiral: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.52),
    gap: (x, y, n) => !spiralBand(x, y, n, 1, 3, 2),
    flow: 'tangent',
  },

  crown: {
    fill: (x, y) =>
      rect(x, y, 0.02, 0.52, 0.98, 0.98) ||
      poly(x, y, [
        [0.02, 0.54],
        [0.02, 0.1],
        [0.26, 0.4],
        [0.5, 0.0],
        [0.74, 0.4],
        [0.98, 0.1],
        [0.98, 0.54],
      ]),
    gap: (x, y, n) =>
      Math.abs(y - 0.6) <= G(n) / 2 ||
      (y > 0.6 && (circle(x, y, 0.5, 0.79, 0.07) || circle(x, y, 0.22, 0.79, 0.05) || circle(x, y, 0.78, 0.79, 0.05))),
  },

  xcross: {
    fill: (x, y) => bar(x, y, 0.04, 0.04, 0.96, 0.96, 0.34) || bar(x, y, 0.96, 0.04, 0.04, 0.96, 0.34),
    gap: (x, y, n) => ringLine(x, y, n, 0.14),
  },

  flower: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.5, 0.2)) {
        return true;
      }
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        if (ellipse(x, y, 0.5 + 0.29 * Math.cos(a), 0.5 + 0.29 * Math.sin(a), 0.23, 0.18, a)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => {
      if (ringLine(x, y, n, 0.2)) {
        return true;
      }
      const {r, a} = polar(x, y);
      if (r < 0.2) {
        return false;
      }
      for (let i = 0; i < 6; i++) {
        const b = -Math.PI / 2 + Math.PI / 6 + (i * Math.PI) / 3;
        if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  hourglass: {
    fill: (x, y) =>
      rect(x, y, 0.0, 0.0, 1.0, 0.1) ||
      rect(x, y, 0.0, 0.9, 1.0, 1.0) ||
      poly(x, y, [
        [0.06, 0.1],
        [0.94, 0.1],
        [0.58, 0.5],
        [0.94, 0.9],
        [0.06, 0.9],
        [0.42, 0.5],
      ]) ||
      rect(x, y, 0.38, 0.4, 0.62, 0.6),
    gap: (x, y) => rect(x, y, 0.44, 0.44, 0.56, 0.56),
  },

  snake: {
    fill: (x, y) => {
      const cy = 0.5 + 0.24 * Math.sin(2 * Math.PI * 1.1 * (x - 0.06));
      const w = 0.09 + 0.1 * Math.min(1, x / 0.5);
      const hy = 0.5 + 0.24 * Math.sin(2 * Math.PI * 1.1 * 0.76);
      return (x >= 0.0 && x <= 0.8 && Math.abs(y - cy) <= w) || ellipse(x, y, 0.85, hy, 0.15, 0.2);
    },
    gap: (x, y, n) => {
      const hy = 0.5 + 0.24 * Math.sin(2 * Math.PI * 1.1 * 0.76);
      return circle(x, y, 0.9, hy - 0.08, G(n) * 0.9) || Math.abs(x - 0.7) <= G(n) / 2;
    },
    flow: 'horizontal',
  },

  butterfly: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(mx, y, 0.25, 0.3, 0.27, 0.24, -0.5) ||
        ellipse(mx, y, 0.3, 0.72, 0.22, 0.19, 0.55) ||
        ellipse(x, y, 0.5, 0.52, 0.07, 0.38) ||
        bar(mx, y, 0.47, 0.16, 0.36, 0.0, 0.05)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(mx - 0.425) <= G(n) / 2 && y > 0.14 && y < 0.92) ||
        (mx < 0.42 && Math.abs(y - 0.53) <= G(n) / 2)
      );
    },
  },

  squares: {
    fill: FULL,
    gap: (x, y, n) => squareLine(x, y, n, 0.36) || squareLine(x, y, n, 0.22) || squareLine(x, y, n, 0.09),
    flow: 'square',
  },

  star5: {
    fill: (x, y) => poly(x, y, starPts(0.5, 0.55, 0.6, 0.3, 5)),
    gap: (x, y, n) => outlineOf((u, v) => poly(u, v, starPts(0.5, 0.55, 0.26, 0.13, 5)), x, y, n),
  },

  tree: {
    fill: (x, y) =>
      poly(x, y, [
        [0.5, -0.02],
        [0.84, 0.3],
        [0.16, 0.3],
      ]) ||
      poly(x, y, [
        [0.5, 0.14],
        [0.94, 0.58],
        [0.06, 0.58],
      ]) ||
      poly(x, y, [
        [0.5, 0.34],
        [1.04, 0.86],
        [-0.04, 0.86],
      ]) ||
      rect(x, y, 0.36, 0.8, 0.64, 1),
    gap: (x, y, n) =>
      (Math.abs(y - 0.31) <= G(n) / 2 && x > 0.14 && x < 0.86) ||
      (Math.abs(y - 0.59) <= G(n) / 2 && x > 0.04 && x < 0.96) ||
      Math.abs(y - 0.87) <= G(n) / 2,
    flow: 'horizontal',
  },

  clusters: {
    fill: (x, y) =>
      circle(x, y, 0.26, 0.27, 0.25) ||
      circle(x, y, 0.76, 0.24, 0.21) ||
      circle(x, y, 0.3, 0.76, 0.22) ||
      circle(x, y, 0.74, 0.72, 0.26),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.1, 0.26, 0.27) || ringLine(x, y, n, 0.12, 0.74, 0.72),
  },

  storm: {
    fill: (x, y) =>
      poly(x, y, [
        [0.26, 0.0],
        [0.0, 0.52],
        [0.22, 0.52],
        [0.06, 1.0],
        [0.6, 0.34],
        [0.38, 0.34],
        [0.58, 0.0],
      ]) ||
      poly(x, y, [
        [0.68, 0.0],
        [0.44, 0.54],
        [0.66, 0.54],
        [0.54, 1.0],
        [1.0, 0.38],
        [0.8, 0.38],
        [1.0, 0.0],
      ]),
  },

  mandala: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.52),
    gap: (x, y, n) => {
      if (ringLine(x, y, n, 0.16) || ringLine(x, y, n, 0.34)) {
        return true;
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        if (spoke(x, y, n, a, 0.34, 0.6) || spoke(x, y, n, a - Math.PI / 4, 0.16, 0.34)) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  whale: {
    fill: (x, y) =>
      ellipse(x, y, 0.42, 0.58, 0.42, 0.33) ||
      poly(x, y, [
        [0.7, 0.54],
        [1.0, 0.16],
        [0.94, 0.5],
        [1.0, 0.86],
      ]) ||
      bar(x, y, 0.3, 0.26, 0.22, 0.04, 0.07) ||
      bar(x, y, 0.3, 0.26, 0.38, 0.04, 0.07),
    gap: (x, y, n) =>
      circle(x, y, 0.2, 0.5, G(n) * 0.8) ||
      (Math.abs(y - (0.72 + 0.06 * Math.sin((x - 0.05) * 6))) <= G(n) / 2 && x < 0.7),
  },

  spiral2: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.52),
    gap: (x, y, n) => !spiralBand(x, y, n, 2, 3, 2),
    flow: 'tangent',
  },

  dragon: {
    fill: (x, y) => {
      const body: [number, number][] = [
        [0.02, 0.9],
        [0.18, 0.78],
        [0.36, 0.84],
        [0.54, 0.74],
        [0.56, 0.54],
        [0.66, 0.38],
        [0.8, 0.28],
      ];
      return (
        lineDist(x, y, body) <= 0.11 ||
        poly(x, y, [
          [0.7, 0.16],
          [1.0, 0.1],
          [0.96, 0.34],
          [0.76, 0.42],
        ]) ||
        poly(x, y, [
          [0.52, 0.66],
          [0.0, 0.02],
          [0.16, 0.08],
          [0.2, 0.0],
          [0.34, 0.1],
          [0.42, 0.02],
          [0.66, 0.46],
        ]) ||
        bar(x, y, 0.3, 0.84, 0.24, 1.0, 0.08) ||
        bar(x, y, 0.56, 0.72, 0.7, 0.92, 0.08) ||
        bar(x, y, 0.8, 0.16, 0.9, 0.0, 0.05)
      );
    },
    gap: (x, y, n) =>
      bar(x, y, 0.5, 0.6, 0.14, 0.12, G(n)) ||
      bar(x, y, 0.56, 0.52, 0.34, 0.12, G(n)) ||
      circle(x, y, 0.86, 0.2, G(n) * 0.7),
  },

  cat: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.6, 0.44, 0.38) ||
      poly(x, y, [
        [0.08, 0.02],
        [0.44, 0.3],
        [0.12, 0.5],
      ]) ||
      poly(x, y, [
        [0.92, 0.02],
        [0.56, 0.3],
        [0.88, 0.5],
      ]),
    gap: (x, y, n) =>
      ellipse(x, y, 0.32, 0.52, 0.06, 0.09) ||
      ellipse(x, y, 0.68, 0.52, 0.06, 0.09) ||
      poly(x, y, [
        [0.45, 0.66],
        [0.55, 0.66],
        [0.5, 0.72],
      ]) ||
      (Math.abs(y - 0.8) <= G(n) / 2 && Math.abs(x - 0.5) < 0.14),
  },

  mandalaL: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.56),
    gap: (x, y, n) => {
      if (ringLine(x, y, n, 0.14) || ringLine(x, y, n, 0.3)) {
        return true;
      }
      const {r, a} = polar(x, y);
      for (let i = 0; i < 8; i++) {
        const b = Math.PI / 8 + (i * Math.PI) / 4;
        if (r > 0.3 && ringLine(x, y, n, 0.13, 0.5 + 0.5 * Math.cos(b), 0.5 + 0.5 * Math.sin(b))) {
          return true;
        }
      }
      for (let i = 0; i < 4; i++) {
        const b = (i * Math.PI) / 2;
        if (r > 0.14 && r < 0.3 && Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  diamonds: {
    fill: FULL,
    gap: (x, y, n) => diamondLine(x, y, n, 0.18) || diamondLine(x, y, n, 0.36) || diamondLine(x, y, n, 0.56) || diamondLine(x, y, n, 0.78),
  },

  hearts: {
    fill: (x, y) => heart(x, y, 0.5, 0.47, 0.5),
    gap: (x, y, n) => heartOutline(x, y, n, 0.5, 0.45, 0.33) || heartOutline(x, y, n, 0.5, 0.43, 0.16),
  },

  owl: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.56, 0.42, 0.44) ||
      poly(x, y, [
        [0.1, 0.0],
        [0.4, 0.2],
        [0.14, 0.34],
      ]) ||
      poly(x, y, [
        [0.9, 0.0],
        [0.6, 0.2],
        [0.86, 0.34],
      ]),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.14, 0.32, 0.38) ||
      ringLine(x, y, n, 0.14, 0.68, 0.38) ||
      circle(x, y, 0.32, 0.38, 0.045) ||
      circle(x, y, 0.68, 0.38, 0.045) ||
      poly(x, y, [
        [0.46, 0.5],
        [0.54, 0.5],
        [0.5, 0.58],
      ]) ||
      (Math.abs(Math.abs(x - 0.5) - (0.2 + (y - 0.6) * 0.3)) <= G(n) / 2 && y > 0.62 && y < 0.95) ||
      (Math.abs(y - 0.97 + 0 * x) <= G(n) / 2),
  },

  coil: {
    fill: (x, y, n) => {
      // Serpentine band: rows of 3 cells with a 1-cell channel, joined at alternate ends.
      const row = Math.floor((y * n) / 4);
      const inRow = (y * n) % 4;
      const rows = Math.floor(n / 4);
      if (row >= rows) {
        return false;
      }
      if (inRow < 3) {
        return x * n >= 0.5 && x * n <= n - 0.5;
      }
      if (row === rows - 1) {
        return false;
      }
      // connector at the right end on even rows, left on odd
      return row % 2 === 0 ? x * n >= n - 3.5 && x * n <= n - 0.5 : x * n >= 0.5 && x * n <= 3.5;
    },
    gap: (x, y, n) => circle(x, y, 0.08, 0.06, G(n) * 0.7),
    flow: 'horizontal',
  },

  starRing: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.53),
    gap: (x, y, n) => {
      const st = starPts(0.5, 0.53, 0.46, 0.2, 5);
      const inner = starPts(0.5, 0.53, 0.26, 0.11, 5);
      return (
        outlineOf((u, v) => poly(u, v, st), x, y, n) ||
        outlineOf((u, v) => poly(u, v, inner), x, y, n) ||
        ringLine(x, y, n, 0.48, 0.5, 0.5)
      );
    },
  },

  butterflyL: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(mx, y, 0.25, 0.3, 0.28, 0.25, -0.45) ||
        ellipse(mx, y, 0.29, 0.72, 0.23, 0.2, 0.55) ||
        ellipse(x, y, 0.5, 0.52, 0.06, 0.4) ||
        bar(mx, y, 0.47, 0.14, 0.34, 0.0, 0.04)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(mx - 0.435) <= G(n) / 2 && y > 0.12 && y < 0.94) ||
        (mx < 0.43 && Math.abs(y - 0.53) <= G(n) / 2) ||
        ringLine(mx, y, n, 0.1, 0.22, 0.3) ||
        ringLine(mx, y, n, 0.08, 0.28, 0.73)
      );
    },
  },

  galaxy: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.53),
    gap: (x, y, n) => (polar(x, y).r > 0.1 ? !spiralBand(x, y, n, 3, 3, 2) : ringLine(x, y, n, 0.1)),
    flow: 'tangent',
  },

  chevrons: {
    fill: (x, y) =>
      poly(x, y, [
        [0.0, 0.0],
        [0.4, 0.0],
        [0.98, 0.5],
        [0.4, 1.0],
        [0.0, 1.0],
        [0.46, 0.5],
      ]) || rect(x, y, 0.0, 0.3, 0.3, 0.7),
    gap: (x, y, n) => {
      const d = (u: number, v: number) => u + Math.abs(v - 0.5) * 1.16;
      const k = d(x, y);
      return (Math.abs(k - 0.62) <= G(n) * 0.7 || Math.abs(k - 0.8) <= G(n) * 0.7) || (x < 0.32 && Math.abs(Math.abs(y - 0.5) - 0.2) <= G(n) / 2 && false);
    },
  },

  treeL: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.3, 0.28) ||
      circle(x, y, 0.24, 0.42, 0.22) ||
      circle(x, y, 0.76, 0.42, 0.22) ||
      circle(x, y, 0.34, 0.18, 0.18) ||
      circle(x, y, 0.66, 0.18, 0.18) ||
      rect(x, y, 0.42, 0.55, 0.58, 0.92) ||
      poly(x, y, [
        [0.42, 0.84],
        [0.18, 1.0],
        [0.82, 1.0],
        [0.58, 0.84],
      ]),
    gap: (x, y, n) =>
      bar(x, y, 0.5, 0.62, 0.5, 0.2, G(n)) ||
      bar(x, y, 0.5, 0.48, 0.22, 0.3, G(n)) ||
      bar(x, y, 0.5, 0.48, 0.78, 0.3, G(n)) ||
      bar(x, y, 0.5, 0.36, 0.34, 0.12, G(n)) ||
      bar(x, y, 0.5, 0.36, 0.66, 0.12, G(n)) ||
      (Math.abs(y - 0.62) <= G(n) / 2 && Math.abs(x - 0.5) > 0.1),
    flow: 'vertical',
  },

  celtic: {
    fill: (x, y) =>
      rect(x, y, 0.3, 0, 0.7, 1) || rect(x, y, 0, 0.3, 1, 0.7) || (circle(x, y, 0.5, 0.5, 0.46) && !circle(x, y, 0.5, 0.5, 0.3)),
    gap: (x, y, n) => squareLine(x, y, n, 0.1) || ringLine(x, y, n, 0.3),
    flow: 'square',
  },

  brokenMandala: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.53) || rect(x, y, 0.62, 0.62, 1, 1),
    gap: (x, y, n) => {
      if (x > 0.6 && y > 0.6) {
        return squareLine(x, y, n, 0.4) || bar(x, y, 0.6, 0.6, 1, 1, G(n));
      }
      if (ringLine(x, y, n, 0.14) || ringLine(x, y, n, 0.3)) {
        return true;
      }
      // crack across the board
      if (lineDist(x, y, [[0.0, 0.34], [0.26, 0.42], [0.4, 0.3], [0.56, 0.5], [0.66, 0.46]]) <= G(n) / 2) {
        return true;
      }
      const {r, a} = polar(x, y);
      for (let i = 0; i < 8; i++) {
        const b = (i * Math.PI) / 4;
        if (r > 0.3 && Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  flower8: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.5, 0.22)) {
        return true;
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        if (ellipse(x, y, 0.5 + 0.32 * Math.cos(a), 0.5 + 0.32 * Math.sin(a), 0.22, 0.15, a)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.22) || ringLine(x, y, n, 0.1),
    flow: 'tangent',
  },

  crownL: {
    fill: (x, y) =>
      rect(x, y, 0.04, 0.6, 0.96, 0.96) ||
      poly(x, y, [
        [0.04, 0.62],
        [0.02, 0.14],
        [0.2, 0.42],
        [0.34, 0.1],
        [0.5, 0.36],
        [0.66, 0.1],
        [0.8, 0.42],
        [0.98, 0.14],
        [0.96, 0.62],
      ]) ||
      circle(x, y, 0.34, 0.07, 0.06) ||
      circle(x, y, 0.66, 0.07, 0.06) ||
      circle(x, y, 0.03, 0.1, 0.05) ||
      circle(x, y, 0.97, 0.1, 0.05),
    gap: (x, y, n) =>
      Math.abs(y - 0.66) <= G(n) / 2 ||
      Math.abs(y - 0.88) <= G(n) / 2 ||
      (y > 0.66 && y < 0.88 && [0.16, 0.38, 0.62, 0.84].some(cx => ellipse(x, y, cx, 0.77, 0.06, 0.06))) ||
      diamondLine((x - 0.5) * 3 + 0.5, (y - 0.36) * 3 + 0.5, n / 3, 0.2),
  },

  spiralFrame: {
    fill: FULL,
    gap: (x, y, n) => {
      if (squareLine(x, y, n, 0.5 - 3 / n)) {
        return true;
      }
      if (Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) > 0.5 - 3 / n) {
        return (Math.abs(x - 0.5) < G(n) / 2 || Math.abs(y - 0.5) < G(n) / 2);
      }
      return !spiralBand(x, y, n, 2, 3, 2) || polar(x, y).r > 0.5 - 3.5 / n;
    },
    flow: 'tangent',
  },

  compass: {
    fill: (x, y) => poly(x, y, starPts(0.5, 0.5, 0.62, 0.38, 8, 0)) || circle(x, y, 0.5, 0.5, 0.36),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.14) ||
      outlineOf((u, v) => poly(u, v, starPts(0.5, 0.5, 0.36, 0.18, 4, 0)), x, y, n),
    flow: 'tangent',
  },

  snowflake: {
    fill: (x, y) => {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const ex = 0.5 + 0.5 * Math.cos(a);
        const ey = 0.5 + 0.5 * Math.sin(a);
        if (bar(x, y, 0.5, 0.5, ex, ey, 0.13)) {
          return true;
        }
        for (const t of [0.26, 0.4]) {
          const bx = 0.5 + t * Math.cos(a);
          const by = 0.5 + t * Math.sin(a);
          const L = t === 0.26 ? 0.14 : 0.1;
          for (const s of [-1, 1]) {
            const b = a + (s * Math.PI) / 4;
            if (bar(x, y, bx, by, bx + L * Math.cos(b), by + L * Math.sin(b), 0.08)) {
              return true;
            }
          }
        }
      }
      return circle(x, y, 0.5, 0.5, 0.16);
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.1),
  },

  fourHearts: {
    fill: (x, y) => {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const cx = 0.5 + 0.25 * Math.cos(a + Math.PI / 4) * Math.SQRT2;
        const cy = 0.5 + 0.25 * Math.sin(a + Math.PI / 4) * Math.SQRT2;
        if (heart(x, y, cx, cy, 0.25, a - Math.PI / 4 - Math.PI / 2 + Math.PI)) {
          return true;
        }
      }
      return Math.abs(x - 0.5) + Math.abs(y - 0.5) <= 0.14;
    },
    gap: (x, y, n) => diamondLine(x, y, n, 0.16),
  },

  argyle: {
    fill: FULL,
    gap: (x, y, n) => {
      const u = (x + y) * 2;
      const v = (x - y) * 2;
      const du = Math.abs(u - Math.round(u));
      const dv = Math.abs(v - Math.round(v));
      return du <= G(n) * 0.5 * 2 || dv <= G(n) * 0.5 * 2;
    },
  },

  eagle: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        poly(mx, y, [
          [0.46, 0.3],
          [0.26, 0.2],
          [0.0, 0.14],
          [0.02, 0.26],
          [0.0, 0.36],
          [0.04, 0.46],
          [0.02, 0.56],
          [0.1, 0.64],
          [0.2, 0.66],
          [0.46, 0.64],
        ]) ||
        ellipse(x, y, 0.5, 0.5, 0.11, 0.3) ||
        circle(x, y, 0.5, 0.17, 0.1) ||
        poly(mx, y, [
          [0.5, 0.7],
          [0.3, 1.0],
          [0.5, 1.0],
        ])
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(mx - 0.38) <= G(n) / 2 && y > 0.24 && y < 0.68) ||
        bar(mx, y, 0.37, 0.46, 0.02, 0.4, G(n)) ||
        circle(mx, y, 0.45, 0.15, G(n) * 0.6) ||
        (Math.abs(y - 0.28) <= G(n) / 2 && mx > 0.39)
      );
    },
  },

  mandalaXL: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.57),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if ([0.1, 0.22, 0.34].some(k => ringLine(x, y, n, k))) {
        return true;
      }
      const ray = (count: number, off: number, r0: number, r1: number) => {
        for (let i = 0; i < count; i++) {
          const b = off + (i * 2 * Math.PI) / count;
          if (r > r0 && r < r1 && Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
            return true;
          }
        }
        return false;
      };
      if (ray(4, Math.PI / 4, 0.1, 0.22) || ray(8, Math.PI / 8, 0.22, 0.34)) {
        return true;
      }
      for (let i = 0; i < 8; i++) {
        const b = (i * Math.PI) / 4;
        if (r > 0.34 && ringLine(x, y, n, 0.14, 0.5 + 0.52 * Math.cos(b), 0.5 + 0.52 * Math.sin(b))) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  cloudStorm: {
    fill: (x, y) =>
      circle(x, y, 0.24, 0.26, 0.22) ||
      circle(x, y, 0.52, 0.18, 0.22) ||
      circle(x, y, 0.8, 0.28, 0.2) ||
      rect(x, y, 0.02, 0.26, 0.98, 0.46) ||
      poly(x, y, [
        [0.24, 0.44],
        [0.06, 0.78],
        [0.24, 0.78],
        [0.12, 1.0],
        [0.52, 0.64],
        [0.36, 0.64],
        [0.48, 0.44],
      ]) ||
      poly(x, y, [
        [0.62, 0.44],
        [0.48, 0.74],
        [0.64, 0.74],
        [0.56, 1.0],
        [0.94, 0.62],
        [0.78, 0.62],
        [0.9, 0.44],
      ]),
    gap: (x, y, n) =>
      Math.abs(y - 0.47) <= G(n) / 2 ||
      lineDist(x, y, [[0.06, 0.34], [0.3, 0.24], [0.5, 0.32], [0.74, 0.22], [0.96, 0.34]]) <= G(n) / 2,
  },

  butterflyXL: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(mx, y, 0.24, 0.3, 0.28, 0.26, -0.42) ||
        ellipse(mx, y, 0.29, 0.73, 0.24, 0.2, 0.6) ||
        ellipse(x, y, 0.5, 0.52, 0.05, 0.42) ||
        bar(mx, y, 0.47, 0.12, 0.33, 0.0, 0.035)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      const left = x < 0.5;
      return (
        (Math.abs(mx - 0.445) <= G(n) / 2 && y > 0.1 && y < 0.95) ||
        (mx < 0.44 && Math.abs(y - 0.54) <= G(n) / 2) ||
        ringLine(mx, y, n, left ? 0.13 : 0.09, 0.2, 0.28) ||
        ringLine(mx, y, n, left ? 0.07 : 0.1, 0.28, 0.74) ||
        (!left && bar(mx, y, 0.43, 0.42, 0.04, 0.42, G(n))) ||
        (left && bar(mx, y, 0.43, 0.7, 0.14, 0.9, G(n)))
      );
    },
  },

  bigArrow: {
    fill: (x, y) =>
      poly(x, y, [
        [0.5, -0.02],
        [1.02, 0.5],
        [0.76, 0.5],
        [0.76, 1.0],
        [0.24, 1.0],
        [0.24, 0.5],
        [-0.02, 0.5],
      ]),
    gap: (x, y, n) => {
      const k = y + Math.abs(x - 0.5) * 0.96;
      return (
        ((Math.abs(k - 0.24) <= G(n) * 0.7 || Math.abs(k - 0.4) <= G(n) * 0.7) && y < 0.49) ||
        (y > 0.5 && (Math.abs(y - 0.74) <= G(n) / 2 || Math.abs(y - 0.52) <= G(n) / 2))
      );
    },
  },

  nested: {
    fill: FULL,
    gap: (x, y, n) =>
      squareLine(x, y, n, 0.47) || diamondLine(x, y, n, 0.47) || ringLine(x, y, n, 0.33) || squareLine(x, y, n, 0.2) || diamondLine(x, y, n, 0.14),
    flow: 'tangent',
  },

  phoenix: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        poly(mx, y, [
          [0.46, 0.34],
          [0.3, 0.2],
          [0.0, 0.0],
          [0.03, 0.14],
          [0.0, 0.24],
          [0.05, 0.34],
          [0.02, 0.44],
          [0.08, 0.52],
          [0.06, 0.6],
          [0.18, 0.64],
          [0.46, 0.62],
        ]) ||
        ellipse(x, y, 0.5, 0.46, 0.1, 0.22) ||
        circle(x, y, 0.5, 0.18, 0.09) ||
        poly(x, y, [
          [0.5, 0.0],
          [0.58, 0.12],
          [0.42, 0.12],
        ]) ||
        poly(mx, y, [
          [0.5, 0.6],
          [0.24, 1.0],
          [0.36, 1.0],
          [0.42, 0.9],
          [0.44, 1.0],
          [0.5, 1.0],
        ])
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(mx - 0.38) <= G(n) / 2 && y > 0.28 && y < 0.64) ||
        bar(mx, y, 0.37, 0.46, 0.04, 0.3, G(n)) ||
        bar(mx, y, 0.49, 0.7, 0.4, 0.96, G(n)) ||
        circle(mx, y, 0.46, 0.17, G(n) * 0.6) ||
        (Math.abs(y - 0.3) <= G(n) / 2 && mx > 0.39)
      );
    },
  },
};

// ------------------------------------------------------- patterns, 51-100

/** Test `pred` in all four quarter-turns about the centre. */
export function anyRot4(x: number, y: number, pred: (u: number, v: number) => boolean): boolean {
  let u = x;
  let v = y;
  for (let k = 0; k < 4; k++) {
    if (pred(u, v)) {
      return true;
    }
    const nu = v;
    const nv = 1 - u;
    u = nu;
    v = nv;
  }
  return false;
}

/** Spiral band test about an arbitrary centre. */
export function spiralAt(x: number, y: number, n: number, cx: number, cy: number, arms: number, pitchCells: number, bandCells: number) {
  return spiralBand(x - cx + 0.5, y - cy + 0.5, n, arms, pitchCells, bandCells);
}

export const hexPts = (cx: number, cy: number, r: number, phase = Math.PI / 6) =>
  Array.from({length: 6}, (_, i) => [cx + r * Math.cos(phase + (i * Math.PI) / 3), cy + r * Math.sin(phase + (i * Math.PI) / 3)] as [number, number]);

/** Fixed pseudo-random seeds for the stained-glass board. */
export const GLASS: [number, number][] = [
  [0.1, 0.12], [0.36, 0.06], [0.66, 0.14], [0.9, 0.08], [0.2, 0.36], [0.5, 0.3], [0.8, 0.34],
  [0.08, 0.62], [0.34, 0.54], [0.62, 0.52], [0.9, 0.6], [0.18, 0.88], [0.46, 0.8], [0.72, 0.78], [0.94, 0.92],
];

export const P2: Record<string, Pattern> = {
  sun: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.5, 0.32) ||
      anyRot4(x, y, (u, v) => {
        for (const [a, len, w] of [[-Math.PI / 2, 0.64, 0.42], [-Math.PI / 4, 0.66, 0.34]] as const) {
          const pts: [number, number][] = [
            [0.5 + 0.26 * Math.cos(a - w), 0.5 + 0.26 * Math.sin(a - w)],
            [0.5 + len * Math.cos(a), 0.5 + len * Math.sin(a)],
            [0.5 + 0.26 * Math.cos(a + w), 0.5 + 0.26 * Math.sin(a + w)],
          ];
          if (poly(u, v, pts)) {
            return true;
          }
        }
        return false;
      }),
    gap: (x, y, n) => ringLine(x, y, n, 0.32) || ringLine(x, y, n, 0.16),
    flow: 'tangent',
  },

  web: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.6),
    gap: (x, y, n) => {
      if ([0.15, 0.3, 0.45].some(k => ringLine(x, y, n, k))) {
        return true;
      }
      const {r, a} = polar(x, y);
      for (let i = 0; i < 8; i++) {
        const b = (i * Math.PI) / 4;
        if (r > 0.15 && Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  anchor: {
    fill: (x, y) =>
      (circle(x, y, 0.5, 0.13, 0.12) && !circle(x, y, 0.5, 0.13, 0.05)) ||
      rect(x, y, 0.41, 0.2, 0.59, 0.86) ||
      rect(x, y, 0.16, 0.28, 0.84, 0.38) ||
      (y > 0.56 && polar(x, y, 0.5, 0.5).r >= 0.34 && polar(x, y, 0.5, 0.5).r <= 0.5) ||
      poly(x, y, [[0.0, 0.52], [0.2, 0.6], [0.06, 0.74]]) ||
      poly(x, y, [[1.0, 0.52], [0.8, 0.6], [0.94, 0.74]]),
    gap: (x, y, n) => Math.abs(y - 0.4) <= G(n) / 2 && Math.abs(x - 0.5) < 0.12,
  },

  labyrinth: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.56),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      const rings = [0.1, 0.2, 0.3, 0.4, 0.5];
      const opens = [0.3, 2.1, 1.0, 2.6, 0.2];
      for (let k = 0; k < rings.length; k++) {
        if (Math.abs(r - rings[k]) <= G(n) / 2) {
          const d1 = Math.abs(Math.atan2(Math.sin(a - opens[k]), Math.cos(a - opens[k])));
          const d2 = Math.abs(Math.atan2(Math.sin(a - opens[k] - Math.PI), Math.cos(a - opens[k] - Math.PI)));
          return Math.min(d1, d2) * r > 1.6 / n;
        }
        if (k < rings.length - 1 && r > rings[k] && r < rings[k + 1]) {
          const w = opens[k] + Math.PI / 2;
          for (const b of [w, w + Math.PI]) {
            if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
              return true;
            }
          }
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  rocket: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.46, 0.25, 0.44) ||
      poly(x, y, [[0.33, 0.56], [0.1, 0.9], [0.1, 0.98], [0.34, 0.84]]) ||
      poly(x, y, [[0.67, 0.56], [0.9, 0.9], [0.9, 0.98], [0.66, 0.84]]) ||
      poly(x, y, [[0.38, 0.86], [0.5, 1.02], [0.62, 0.86]]),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.08, 0.5, 0.34) ||
      (Math.abs(y - 0.62) <= G(n) / 2 && Math.abs(x - 0.5) < 0.25) ||
      (Math.abs(y - 0.18) <= G(n) / 2 && Math.abs(x - 0.5) < 0.25),
  },

  tulip: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.34, 0.3, 0.26) ||
      poly(x, y, [[0.2, 0.32], [0.22, 0.02], [0.38, 0.18], [0.5, 0.0], [0.62, 0.18], [0.78, 0.02], [0.8, 0.32]]) ||
      rect(x, y, 0.42, 0.56, 0.58, 1) ||
      poly(x, y, [[0.42, 0.98], [0.06, 0.6], [0.2, 0.62], [0.42, 0.78]]) ||
      poly(x, y, [[0.58, 0.98], [0.94, 0.6], [0.8, 0.62], [0.58, 0.78]]),
    gap: (x, y, n) => (Math.abs(Math.abs(x - 0.5) - 0.12) <= G(n) / 2 && y > 0.12 && y < 0.54) || Math.abs(y - 0.6) <= G(n) / 2,
  },

  octopus: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      if (ellipse(x, y, 0.5, 0.3, 0.34, 0.28)) {
        return true;
      }
      if (y < 0.44 || y > 0.99) {
        return false;
      }
      for (const [x0, ph] of [[0.06, 0], [0.19, 1.3], [0.32, 2.4], [0.44, 3.1]] as const) {
        const cx = x0 + 0.045 * Math.sin((y - 0.44) * 13 + ph) * Math.min(1, (y - 0.44) * 5);
        if (Math.abs(mx - cx) <= 0.045) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) =>
      ellipse(x, y, 0.38, 0.32, 0.05, 0.06) ||
      ellipse(x, y, 0.62, 0.32, 0.05, 0.06) ||
      (Math.abs(y - 0.5) <= G(n) / 2 && Math.abs(x - 0.5) < 0.3),
  },

  yinyang: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.51),
    gap: (x, y, n) => {
      const yin = (u: number, v: number) => circle(u, v, 0.5, 0.25, 0.25) || (u < 0.5 && !circle(u, v, 0.5, 0.75, 0.25));
      return (
        (polar(x, y).r < 0.45 && outlineOf(yin, x, y, n)) ||
        ringLine(x, y, n, 0.46) ||
        ringLine(x, y, n, 0.08, 0.5, 0.25) ||
        ringLine(x, y, n, 0.08, 0.5, 0.75)
      );
    },
  },

  triskele: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.52, 0.14)) {
        return true;
      }
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        if (circle(x, y, 0.5 + 0.25 * Math.cos(a), 0.54 + 0.25 * Math.sin(a), 0.24)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        const cx = 0.5 + 0.25 * Math.cos(a);
        const cy = 0.54 + 0.25 * Math.sin(a);
        if (circle(x, y, cx, cy, 0.21)) {
          return !spiralAt(x, y, n, cx, cy, 1, 3, 2);
        }
      }
      return ringLine(x, y, n, 0.06, 0.5, 0.52);
    },
    flow: 'tangent',
  },

  pinwheel: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.5, 0.12) ||
      anyRot4(x, y, (u, v) => poly(u, v, [[0.5, 0.5], [0.5, 0.0], [0.04, 0.0], [0.04, 0.16], [0.22, 0.26]])),
    gap: (x, y, n) => ringLine(x, y, n, 0.12) || ringLine(x, y, n, 0.3),
    flow: 'tangent',
  },

  fish2: {
    fill: (x, y) =>
      ellipse(x, y, 0.42, 0.5, 0.36, 0.27) ||
      poly(x, y, [[0.7, 0.5], [1.0, 0.16], [0.92, 0.5], [1.0, 0.84]]) ||
      poly(x, y, [[0.3, 0.28], [0.46, 0.08], [0.62, 0.28]]) ||
      poly(x, y, [[0.36, 0.72], [0.46, 0.88], [0.54, 0.72]]),
    gap: (x, y, n) =>
      circle(x, y, 0.2, 0.44, G(n) * 0.9) ||
      (Math.abs(x - 0.3 - 0.04 * Math.sin(y * 9)) <= G(n) / 2 && y > 0.3 && y < 0.7) ||
      Math.abs(x - 0.76) <= G(n) / 2 ||
      (x > 0.34 && x < 0.72 && Math.abs(((x + y) * 5) % 1) < 0.1 && ellipse(x, y, 0.5, 0.5, 0.2, 0.2)),
  },

  maple: {
    fill: (x, y) =>
      poly(x, y, [
        [0.5, 0.0], [0.6, 0.18], [0.72, 0.12], [0.7, 0.34], [0.94, 0.22], [0.88, 0.42], [1.0, 0.5],
        [0.78, 0.62], [0.82, 0.74], [0.56, 0.7], [0.54, 0.82], [0.46, 0.82], [0.44, 0.7], [0.18, 0.74],
        [0.22, 0.62], [0.0, 0.5], [0.12, 0.42], [0.06, 0.22], [0.3, 0.34], [0.28, 0.12], [0.4, 0.18],
      ]) || rect(x, y, 0.47, 0.78, 0.53, 1),
    gap: (x, y, n) =>
      bar(x, y, 0.5, 0.72, 0.5, 0.1, G(n)) ||
      bar(x, y, 0.5, 0.66, 0.84, 0.4, G(n)) ||
      bar(x, y, 0.5, 0.66, 0.16, 0.4, G(n)),
  },

  target: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.56),
    gap: (x, y, n) => [0.08, 0.19, 0.3, 0.41, 0.52].some(k => ringLine(x, y, n, k)),
    flow: 'tangent',
  },

  keyhole: {
    fill: FULL,
    gap: (x, y, n) =>
      squareLine(x, y, n, 0.43) ||
      outlineOf((u, v) => circle(u, v, 0.5, 0.38, 0.15) || poly(u, v, [[0.43, 0.44], [0.57, 0.44], [0.64, 0.8], [0.36, 0.8]]), x, y, n),
  },

  turtle: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.52, 0.32, 0.36) ||
        circle(x, y, 0.5, 0.1, 0.1) ||
        ellipse(mx, y, 0.18, 0.3, 0.16, 0.07, -0.6) ||
        ellipse(mx, y, 0.22, 0.78, 0.13, 0.06, 0.6) ||
        poly(x, y, [[0.46, 0.86], [0.5, 0.98], [0.54, 0.86]])
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      const inner = (u: number, v: number) => ellipse(u, v, 0.5, 0.52, 0.26, 0.3);
      const hex = (u: number, v: number) => poly(u, v, hexPts(0.5, 0.52, 0.13, 0));
      return (
        outlineOf(inner, x, y, n) ||
        outlineOf(hex, x, y, n) ||
        (inner(x, y) && !hex(x, y) && (bar(mx, y, 0.435, 0.41, 0.3, 0.3, G(n)) || bar(mx, y, 0.435, 0.63, 0.3, 0.74, G(n)))) ||
        Math.abs(y - 0.2) <= G(n) / 2
      );
    },
  },

  waves: {
    fill: FULL,
    gap: (x, y, n) => [0.25, 0.5, 0.75].some(k => Math.abs(y - k - 0.05 * Math.sin(2 * Math.PI * 1.5 * x + k * 4)) <= G(n) / 2),
    flow: 'horizontal',
  },

  lighthouse: {
    fill: (x, y) =>
      poly(x, y, [[0.38, 0.3], [0.62, 0.3], [0.7, 0.9], [0.3, 0.9]]) ||
      rect(x, y, 0.36, 0.14, 0.64, 0.3) ||
      poly(x, y, [[0.32, 0.15], [0.68, 0.15], [0.5, 0.0]]) ||
      poly(x, y, [[0.36, 0.18], [0.0, 0.04], [0.0, 0.32]]) ||
      poly(x, y, [[0.64, 0.18], [1.0, 0.04], [1.0, 0.32]]) ||
      rect(x, y, 0.0, 0.88, 1.0, 1.0),
    gap: (x, y, n) =>
      [0.3, 0.5, 0.7, 0.9].some(k => Math.abs(y - k) <= G(n) / 2 && Math.abs(x - 0.5) < 0.24) ||
      (Math.abs(x - 0.35) <= G(n) / 2 && y < 0.3 && y > 0.08) ||
      (Math.abs(x - 0.65) <= G(n) / 2 && y < 0.3 && y > 0.08),
  },

  clover: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.12) || anyRot4(x, y, (u, v) => circle(u, v, 0.5, 0.26, 0.24)),
    gap: (x, y, n) => ringLine(x, y, n, 0.09) || anyRot4(x, y, (u, v) => ringLine(u, v, n, 0.12, 0.5, 0.26)),
    flow: 'tangent',
  },

  fox: {
    fill: (x, y) => poly(x, y, [[0.04, 0.04], [0.34, 0.34], [0.66, 0.34], [0.96, 0.04], [0.92, 0.52], [0.5, 0.98], [0.08, 0.52]]),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        bar(mx, y, 0.12, 0.14, 0.3, 0.36, G(n)) ||
        ellipse(mx, y, 0.33, 0.52, 0.06, 0.035) ||
        circle(x, y, 0.5, 0.86, 0.035) ||
        bar(mx, y, 0.5, 0.74, 0.28, 0.6, G(n)) ||
        bar(mx, y, 0.08, 0.5, 0.26, 0.64, G(n))
      );
    },
  },

  spiral4: {
    fill: FULL,
    gap: (x, y, n) =>
      polar(x, y).r < 0.5 ? !spiralBand(x, y, n, 4, 3, 2) || ringLine(x, y, n, 0.48) : anyRot4(x, y, (u, v) => bar(u, v, 0, 0, 0.14, 0.14, G(n))),
    flow: 'tangent',
  },

  shield: {
    fill: (x, y) => poly(x, y, [[0.06, 0.02], [0.94, 0.02], [0.94, 0.5], [0.8, 0.76], [0.5, 1.0], [0.2, 0.76], [0.06, 0.5]]),
    gap: (x, y, n) =>
      outlineOf((u, v) => poly(u, v, [[0.16, 0.12], [0.84, 0.12], [0.84, 0.48], [0.72, 0.7], [0.5, 0.88], [0.28, 0.7], [0.16, 0.48]]), x, y, n) ||
      (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.12 && y < 0.88) ||
      (Math.abs(y - 0.4) <= G(n) / 2 && x > 0.16 && x < 0.84),
  },

  jellyfish: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      if (ellipse(x, y, 0.5, 0.36, 0.44, 0.32) && y < 0.44) {
        return true;
      }
      if (y < 0.42 || y > 0.99) {
        return false;
      }
      if (Math.abs(mx - 0.44 - 0.03 * Math.sin(y * 16)) <= 0.07) {
        return true;
      }
      for (const [x0, ph] of [[0.1, 0.5], [0.22, 2], [0.32, 3]] as const) {
        if (y < 0.94 - x0 * 0.4 && Math.abs(mx - x0 - 0.03 * Math.sin(y * 18 + ph)) <= 0.03) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => (y < 0.4 && ringLine(x, y, n, 0.22, 0.5, 0.44)) || Math.abs(y - 0.3) <= G(n) / 2 && Math.abs(x - 0.5) > 0.26,
  },

  infinity: {
    fill: (x, y) => {
      const frame = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) > 0.4;
      const ring = (cx: number) => {
        const r = polar(x, y, cx, 0.5).r;
        return r >= 0.1 && r <= 0.27;
      };
      return frame || ring(0.29) || ring(0.71);
    },
    gap: (x, y, n) => squareLine(x, y, n, 0.4) || ringLine(x, y, n, 0.185, 0.29, 0.5) || ringLine(x, y, n, 0.185, 0.71, 0.5),
    flow: 'tangent',
  },

  bat: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.54, 0.12, 0.24) ||
        circle(x, y, 0.5, 0.28, 0.11) ||
        poly(mx, y, [[0.43, 0.26], [0.4, 0.12], [0.49, 0.22]]) ||
        poly(mx, y, [[0.46, 0.34], [0.28, 0.16], [0.0, 0.14], [0.06, 0.34], [0.0, 0.5], [0.14, 0.56], [0.1, 0.74], [0.28, 0.68], [0.36, 0.86], [0.46, 0.7]])
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return bar(mx, y, 0.4, 0.42, 0.08, 0.36, G(n)) || bar(mx, y, 0.4, 0.5, 0.16, 0.58, G(n)) || Math.abs(mx - 0.41) <= G(n) / 2 && y > 0.3 && y < 0.7;
    },
  },

  sunflower: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.5, 0.24)) {
        return true;
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        if (ellipse(x, y, 0.5 + 0.37 * Math.cos(a), 0.5 + 0.37 * Math.sin(a), 0.14, 0.075, a)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.245) ||
      (circle(x, y, 0.5, 0.5, 0.22) && (Math.abs((((x + y) * n) / 3) % 1) < 0.2 || Math.abs((((x - y + 1) * n) / 3) % 1) < 0.2)),
  },

  mushroom: {
    fill: (x, y) =>
      (ellipse(x, y, 0.5, 0.5, 0.5, 0.46) && y < 0.52) ||
      rect(x, y, 0.34, 0.5, 0.66, 0.94) ||
      ellipse(x, y, 0.5, 0.93, 0.24, 0.07),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return ringLine(mx, y, n, 0.07, 0.24, 0.32) || ringLine(x, y, n, 0.07, 0.5, 0.18) || Math.abs(y - 0.53) <= G(n) / 2;
    },
  },

  hive: {
    fill: (x, y) => poly(x, y, hexPts(0.5, 0.5, 0.56, 0)),
    gap: (x, y, n) => {
      const r = 0.155;
      const centres: [number, number][] = [[0.5, 0.5]];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        centres.push([0.5 + r * Math.sqrt(3) * Math.cos(a), 0.5 + r * Math.sqrt(3) * Math.sin(a)]);
      }
      return centres.some(([cx, cy]) => outlineOf((u, v) => poly(u, v, hexPts(cx, cy, r, 0)), x, y, n));
    },
  },

  seahorse: {
    fill: (x, y) => {
      const spine: [number, number][] = [[0.52, 0.16], [0.64, 0.3], [0.6, 0.48], [0.48, 0.62], [0.52, 0.78], [0.68, 0.86], [0.62, 0.97], [0.46, 0.92]];
      const d = lineDist(x, y, spine);
      const w = y < 0.62 ? 0.16 : 0.16 - (y - 0.62) * 0.3;
      return (
        d <= w ||
        ellipse(x, y, 0.44, 0.13, 0.17, 0.11, -0.3) ||
        bar(x, y, 0.34, 0.16, 0.06, 0.24, 0.07) ||
        poly(x, y, [[0.74, 0.3], [0.94, 0.4], [0.74, 0.56]]) ||
        poly(x, y, [[0.5, 0.02], [0.6, 0.06], [0.54, 0.12]])
      );
    },
    gap: (x, y, n) =>
      circle(x, y, 0.45, 0.11, G(n) * 0.8) ||
      [0.34, 0.44, 0.54, 0.64].some(k => Math.abs(y - k) <= G(n) / 2 && x > 0.46 && x < 0.74) ||
      Math.abs(x - 0.74) <= G(n) / 2 && y > 0.3 && y < 0.56,
  },

  trophy: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      const hr = polar(mx, y, 0.14, 0.26).r;
      return (
        poly(x, y, [[0.18, 0.04], [0.82, 0.04], [0.76, 0.4], [0.58, 0.54], [0.58, 0.7], [0.72, 0.78], [0.72, 0.86], [0.28, 0.86], [0.28, 0.78], [0.42, 0.7], [0.42, 0.54], [0.24, 0.4]]) ||
        (hr >= 0.08 && hr <= 0.15 && mx < 0.2) ||
        rect(x, y, 0.16, 0.86, 0.84, 0.98)
      );
    },
    gap: (x, y, n) =>
      Math.abs(y - 0.14) <= G(n) / 2 ||
      Math.abs(y - 0.88) <= G(n) / 2 ||
      outlineOf((u, v) => poly(u, v, starPts(0.5, 0.29, 0.13, 0.06, 5)), x, y, n),
  },

  kaleido: {
    fill: FULL,
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.5, 0.5, 0.0) ||
      ringLine(x, y, n, 0.5, 1.0, 0.5) ||
      ringLine(x, y, n, 0.5, 0.5, 1.0) ||
      ringLine(x, y, n, 0.5, 0.0, 0.5) ||
      ringLine(x, y, n, 0.16),
    flow: 'tangent',
  },

  pyramid: {
    fill: (x, y) => poly(x, y, [[0.5, 0.0], [1.06, 0.9], [-0.06, 0.9]]) || rect(x, y, 0.0, 0.94, 1.0, 1.0),
    gap: (_x, y, n) => [0.34, 0.62].some(k => Math.abs(y - k) <= G(n) / 2),
    flow: 'horizontal',
  },

  serpents: {
    fill: (x, y) => {
      const s = Math.sin(2 * Math.PI * 1.5 * x);
      return (
        Math.abs(y - (0.5 + 0.3 * s)) <= 0.1 ||
        Math.abs(y - (0.5 - 0.3 * s)) <= 0.1 ||
        circle(x, y, 0.93, 0.5 + 0.3 * Math.sin(2 * Math.PI * 1.5 * 0.93), 0.08) ||
        rect(x, y, 0.0, 0.0, 1.0, 0.07) ||
        rect(x, y, 0.0, 0.93, 1.0, 1.0)
      );
    },
    gap: (x, y, n) => {
      const s = Math.sin(2 * Math.PI * 1.5 * x);
      return (
        Math.abs(y - (0.5 + 0.3 * s)) <= G(n) / 2 ||
        Math.abs(y - 0.085) <= G(n) / 2 ||
        Math.abs(y - 0.915) <= G(n) / 2
      );
    },
    flow: 'horizontal',
  },

  bee: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.6, 0.23, 0.32) ||
        circle(x, y, 0.5, 0.22, 0.13) ||
        ellipse(mx, y, 0.22, 0.34, 0.24, 0.17, -0.4) ||
        poly(x, y, [[0.44, 0.86], [0.5, 1.0], [0.56, 0.86]]) ||
        bar(mx, y, 0.46, 0.14, 0.36, 0.0, 0.04)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        [0.5, 0.62, 0.74].some(k => Math.abs(y - k) <= G(n) / 2 && Math.abs(x - 0.5) < 0.2) ||
        (Math.abs(mx - 0.33) <= G(n) / 2 && y > 0.3 && y < 0.55) ||
        ringLine(mx, y, n, 0.08, 0.22, 0.36)
      );
    },
  },

  castle: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      const crenel = (x0: number, x1: number, top: number) =>
        y >= top && y <= top + 0.06 && x >= x0 && x <= x1 && Math.floor(((x - x0) / (x1 - x0)) * 5) % 2 === 0;
      return (
        rect(x, y, 0.04, 0.48, 0.96, 1) ||
        rect(mx, y, 0.02, 0.2, 0.22, 1) ||
        crenel(0.02, 0.22, 0.14) ||
        crenel(0.78, 0.98, 0.14) ||
        rect(x, y, 0.36, 0.14, 0.64, 0.5) ||
        crenel(0.36, 0.64, 0.08) ||
        bar(x, y, 0.5, 0.08, 0.5, 0.0, 0.03)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        rect(x, y, 0.43, 0.8, 0.57, 1) ||
        circle(x, y, 0.5, 0.8, 0.07) ||
        ellipse(mx, y, 0.12, 0.34, 0.03, 0.05) ||
        ellipse(x, y, 0.5, 0.28, 0.03, 0.05) ||
        Math.abs(y - 0.5) <= G(n) / 2 && mx > 0.22 ||
        Math.abs(mx - 0.23) <= G(n) / 2 && y > 0.5
      );
    },
  },

  maltese: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.5, 0.2) ||
      anyRot4(x, y, (u, v) => poly(u, v, [[0.46, 0.4], [0.28, 0.0], [0.5, 0.1], [0.72, 0.0], [0.54, 0.4]])),
    gap: (x, y, n) => ringLine(x, y, n, 0.2) || ringLine(x, y, n, 0.1) || anyRot4(x, y, (u, v) => bar(u, v, 0.5, 0.3, 0.5, 0.12, G(n))),
  },

  moon: {
    fill: (x, y) =>
      (circle(x, y, 0.44, 0.52, 0.48) && !circle(x, y, 0.66, 0.4, 0.34)) ||
      poly(x, y, starPts(0.78, 0.74, 0.22, 0.11, 5)) ||
      poly(x, y, starPts(0.82, 0.2, 0.13, 0.06, 5)),
    gap: (x, y, n) => ringLine(x, y, n, 0.38, 0.44, 0.52) && !circle(x, y, 0.66, 0.4, 0.36),
    flow: 'tangent',
  },

  penguin: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.56, 0.32, 0.42) ||
        ellipse(mx, y, 0.16, 0.56, 0.08, 0.24, 0.3) ||
        ellipse(mx, y, 0.38, 0.97, 0.12, 0.05) ||
        poly(x, y, [[0.44, 0.3], [0.56, 0.3], [0.5, 0.38]])
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        outlineOf((u, v) => ellipse(u, v, 0.5, 0.62, 0.2, 0.3), x, y, n) ||
        circle(mx, y, 0.4, 0.26, G(n) * 0.9) ||
        Math.abs(mx - 0.22) <= G(n) / 2 && y > 0.4 && y < 0.78
      );
    },
  },

  knot: {
    fill: (x, y) => {
      const r0 = polar(x, y).r;
      return (r0 >= 0.36 && r0 <= 0.56) || circle(x, y, 0.5, 0.5, 0.09) || anyRot4(x, y, (u, v) => {
        const r = polar(u, v, 0.5, 0.25).r;
        return r >= 0.08 && r <= 0.23;
      });
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.36) || anyRot4(x, y, (u, v) => ringLine(u, v, n, 0.08, 0.5, 0.25)),
    flow: 'tangent',
  },

  swords: {
    fill: (x, y) =>
      poly(x, y, [[0.1, 0.16], [0.9, 0.16], [0.9, 0.56], [0.5, 0.94], [0.1, 0.56]]) ||
      rect(x, y, 0.44, 0.0, 0.56, 1.0) ||
      rect(x, y, 0.0, 0.12, 1.0, 0.22),
    gap: (x, y, n) =>
      outlineOf((u, v) => rect(u, v, 0.44, 0.0, 0.56, 1.0) || rect(u, v, 0.0, 0.12, 1.0, 0.22), x, y, n) ||
      outlineOf((u, v) => poly(u, v, [[0.18, 0.26], [0.82, 0.26], [0.82, 0.54], [0.5, 0.84], [0.18, 0.54]]), x, y, n),
  },

  tiger: {
    fill: (x, y) => ellipse(x, y, 0.5, 0.56, 0.47, 0.42) || circle(x, y, 0.15, 0.16, 0.13) || circle(x, y, 0.85, 0.16, 0.13),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        circle(mx, y, 0.15, 0.16, 0.06) ||
        bar(x, y, 0.5, 0.18, 0.5, 0.34, G(n)) ||
        bar(mx, y, 0.4, 0.18, 0.44, 0.3, G(n)) ||
        bar(mx, y, 0.03, 0.46, 0.2, 0.5, G(n)) ||
        bar(mx, y, 0.03, 0.58, 0.2, 0.6, G(n)) ||
        bar(mx, y, 0.06, 0.7, 0.2, 0.7, G(n)) ||
        ellipse(mx, y, 0.33, 0.44, 0.07, 0.035) ||
        poly(x, y, [[0.43, 0.6], [0.57, 0.6], [0.5, 0.68]]) ||
        bar(mx, y, 0.5, 0.72, 0.4, 0.78, G(n))
      );
    },
  },

  sailboat: {
    fill: (x, y) =>
      poly(x, y, [[0.04, 0.68], [0.96, 0.68], [0.8, 0.84], [0.2, 0.84]]) ||
      rect(x, y, 0.47, 0.04, 0.53, 0.68) ||
      poly(x, y, [[0.56, 0.04], [0.56, 0.62], [0.94, 0.62]]) ||
      poly(x, y, [[0.44, 0.12], [0.44, 0.62], [0.08, 0.62]]) ||
      rect(x, y, 0.0, 0.86, 1.0, 1.0),
    gap: (x, y, n) => Math.abs(y - 0.93) <= G(n) / 2 || (Math.abs(y - 0.4) <= G(n) / 2 && x > 0.56),
  },

  stained: {
    fill: FULL,
    gap: (x, y, n) => {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [sx, sy] of GLASS) {
        const d = Math.hypot(x - sx, y - sy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
      return d2 - d1 < 0.8 / n;
    },
  },

  rabbit: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.64, 0.32) ||
      ellipse(x, y, 0.35, 0.24, 0.1, 0.26, -0.18) ||
      ellipse(x, y, 0.65, 0.24, 0.1, 0.26, 0.18),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(mx, y, 0.35, 0.24, 0.035, 0.16, -0.18) ||
        circle(mx, y, 0.38, 0.58, 0.04) ||
        poly(x, y, [[0.46, 0.7], [0.54, 0.7], [0.5, 0.75]]) ||
        bar(mx, y, 0.42, 0.76, 0.12, 0.7, G(n)) ||
        bar(mx, y, 0.42, 0.8, 0.14, 0.84, G(n)) ||
        Math.abs(y - 0.4) <= G(n) / 2 && mx < 0.46
      );
    },
  },

  roseWindow: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.56),
    gap: (x, y, n) => {
      if (ringLine(x, y, n, 0.49) || ringLine(x, y, n, 0.18)) {
        return true;
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        if (ringLine(x, y, n, 0.12, 0.5 + 0.34 * Math.cos(a), 0.5 + 0.34 * Math.sin(a))) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  cactus: {
    fill: (x, y) =>
      rect(x, y, 0.38, 0.12, 0.62, 0.8) ||
      circle(x, y, 0.5, 0.13, 0.12) ||
      rect(x, y, 0.1, 0.26, 0.26, 0.56) ||
      circle(x, y, 0.18, 0.26, 0.08) ||
      rect(x, y, 0.1, 0.5, 0.4, 0.6) ||
      rect(x, y, 0.74, 0.14, 0.9, 0.44) ||
      circle(x, y, 0.82, 0.14, 0.08) ||
      rect(x, y, 0.6, 0.38, 0.9, 0.48) ||
      poly(x, y, [[0.26, 0.8], [0.74, 0.8], [0.68, 1.0], [0.32, 1.0]]),
    gap: (x, y, n) =>
      (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.06 && y < 0.8) ||
      Math.abs(y - 0.82) <= G(n) / 2 ||
      (Math.abs(x - 0.18) <= G(n) / 2 && y < 0.5) ||
      (Math.abs(x - 0.82) <= G(n) / 2 && y < 0.4),
    flow: 'vertical',
  },

  mountains: {
    fill: (x, y) =>
      poly(x, y, [[0, 1.01], [0, 0.52], [0.18, 0.24], [0.32, 0.46], [0.5, 0.08], [0.66, 0.4], [0.8, 0.26], [1, 0.56], [1, 1.01]]) ||
      circle(x, y, 0.86, 0.1, 0.09),
    gap: (x, y, n) =>
      lineDist(x, y, [[0.08, 0.4], [0.18, 0.46], [0.28, 0.4]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.38, 0.32], [0.5, 0.4], [0.62, 0.32]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.72, 0.36], [0.8, 0.42], [0.9, 0.4]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.46, 0.62], [0.36, 0.72], [0.48, 0.84], [0.34, 1.0]]) <= G(n) / 2 ||
      Math.abs(y - 0.7) <= G(n) / 2 && (x < 0.3 || x > 0.56),
  },

  balloon: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.38, 0.37) ||
      poly(x, y, [[0.18, 0.5], [0.82, 0.5], [0.6, 0.8], [0.4, 0.8]]) ||
      rect(x, y, 0.36, 0.84, 0.64, 1.0) ||
      bar(x, y, 0.42, 0.8, 0.38, 0.86, 0.04) ||
      bar(x, y, 0.58, 0.8, 0.62, 0.86, 0.04),
    gap: (x, y, n) => {
      if (y > 0.8) {
        return Math.abs(y - 0.9) <= G(n) / 2;
      }
      const t = Math.max(0, 1 - ((y - 0.38) / 0.42) ** 2);
      return [-0.22, 0.22].some(k => Math.abs(x - 0.5 - k * Math.sqrt(t)) <= G(n) / 2) || Math.abs(y - 0.62) <= G(n) / 2;
    },
  },

  lion: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.5, 0.42)) {
        return true;
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        if (circle(x, y, 0.5 + 0.42 * Math.cos(a), 0.5 + 0.42 * Math.sin(a), 0.09)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      const {r, a} = polar(x, y);
      if (ringLine(x, y, n, 0.27)) {
        return true;
      }
      if (r > 0.27) {
        for (let i = 0; i < 8; i++) {
          const b = Math.PI / 8 + (i * Math.PI) / 4;
          if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
            return true;
          }
        }
        return false;
      }
      return (
        ellipse(mx, y, 0.4, 0.44, 0.05, 0.035) ||
        poly(x, y, [[0.44, 0.54], [0.56, 0.54], [0.5, 0.61]]) ||
        bar(mx, y, 0.5, 0.64, 0.4, 0.68, G(n))
      );
    },
  },

  twinGalaxy: {
    fill: (x, y) =>
      circle(x, y, 0.32, 0.32, 0.3) ||
      circle(x, y, 0.68, 0.68, 0.3) ||
      circle(x, y, 0.84, 0.16, 0.14) ||
      circle(x, y, 0.16, 0.84, 0.14),
    gap: (x, y, n) => {
      if (circle(x, y, 0.32, 0.32, 0.27)) {
        return !spiralAt(x, y, n, 0.32, 0.32, 2, 3, 2);
      }
      if (circle(x, y, 0.68, 0.68, 0.27)) {
        return !spiralAt(x, y, n, 0.68, 0.68, 2, 3, 2);
      }
      return ringLine(x, y, n, 0.07, 0.84, 0.16) || ringLine(x, y, n, 0.07, 0.16, 0.84) || bar(x, y, 0.5, 0.5, 0.5, 0.5, 0.001);
    },
    flow: 'tangent',
  },

  royalSeal: {
    fill: FULL,
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.47) ||
      ringLine(x, y, n, 0.14) ||
      outlineOf((u, v) => poly(u, v, starPts(0.5, 0.5, 0.45, 0.27, 8, 0)), x, y, n) ||
      anyRot4(x, y, (u, v) => ringLine(u, v, n, 0.22, 0.0, 0.0)),
    flow: 'tangent',
  },
};
Object.assign(P, P2);

// ------------------------------------------------------ patterns, 101-150

/** Sierpinski triangle to `depth`, apex (ax, ay), base width w, height h. */
export function sierpinski(x: number, y: number, ax: number, ay: number, w: number, h: number, depth: number): boolean {
  if (y < ay || y > ay + h) {
    return false;
  }
  const t = (y - ay) / h;
  if (Math.abs(x - ax) > (w / 2) * t) {
    return false;
  }
  if (depth === 0) {
    return true;
  }
  const hh = h / 2;
  const hw = w / 2;
  return (
    sierpinski(x, y, ax, ay, hw, hh, depth - 1) ||
    sierpinski(x, y, ax - hw / 2, ay + hh, hw, hh, depth - 1) ||
    sierpinski(x, y, ax + hw / 2, ay + hh, hw, hh, depth - 1)
  );
}

/** Axis-aligned wall segments for the floor plan: [x1, y1, x2, y2]. */
export const WALLS: [number, number, number, number][] = [
  [0.3, 0.0, 0.3, 0.2], [0.3, 0.27, 0.3, 0.45], [0.3, 0.56, 0.3, 1.0],
  [0.62, 0.0, 0.62, 0.35], [0.62, 0.43, 0.62, 0.7],
  [0.8, 0.7, 0.8, 0.84], [0.8, 0.91, 0.8, 1.0],
  [0.0, 0.45, 0.12, 0.45], [0.19, 0.45, 0.5, 0.45],
  [0.62, 0.35, 0.86, 0.35], [0.93, 0.35, 1.0, 0.35],
  [0.3, 0.7, 0.5, 0.7], [0.57, 0.7, 1.0, 0.7],
  [0.0, 0.82, 0.22, 0.82], [0.45, 0.45, 0.45, 0.58],
];

/** Circuit traces for the circuit board: polylines. */
export const TRACES: [number, number][][] = [
  [[0.0, 0.2], [0.24, 0.2], [0.34, 0.3], [0.34, 0.5]],
  [[0.12, 1.0], [0.12, 0.7], [0.24, 0.58], [0.4, 0.58]],
  [[0.5, 0.0], [0.5, 0.14], [0.6, 0.24], [0.8, 0.24], [0.8, 0.0]],
  [[1.0, 0.5], [0.84, 0.5], [0.74, 0.6], [0.74, 0.86], [0.6, 1.0]],
  [[0.46, 0.66], [0.46, 0.84], [0.3, 0.84], [0.22, 0.92]],
  [[0.62, 0.36], [0.92, 0.36], [1.0, 0.28]],
  [[0.0, 0.46], [0.16, 0.46], [0.22, 0.4]],
];

export const P3: Record<string, Pattern> = {
  wheel: {
    fill: (x, y) => {
      const {r, a} = polar(x, y);
      if (circle(x, y, 0.5, 0.5, 0.13) || (r >= 0.32 && r <= 0.44)) {
        return true;
      }
      for (let i = 0; i < 8; i++) {
        const b = (i * Math.PI) / 4;
        if (r < 0.52 && Math.abs(Math.sin(a - b)) * r <= 0.035 && Math.cos(a - b) > 0) {
          return true;
        }
        if (circle(x, y, 0.5 + 0.52 * Math.cos(b), 0.5 + 0.52 * Math.sin(b), 0.055)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.38) || ringLine(x, y, n, 0.07),
    flow: 'tangent',
  },

  peacock: {
    fill: (x, y) => {
      const fan = polar(x, y, 0.5, 0.66);
      return (
        (fan.r <= 0.58 && y <= 0.66) ||
        ellipse(x, y, 0.5, 0.76, 0.1, 0.22) ||
        circle(x, y, 0.5, 0.44, 0.07) ||
        bar(x, y, 0.44, 0.98, 0.56, 0.98, 0.04)
      );
    },
    gap: (x, y, n) => {
      const fan = polar(x, y, 0.5, 0.66);
      if (y > 0.66 || fan.r < 0.16) {
        return y <= 0.66 && ringLine(x, y, n, 0.16, 0.5, 0.66);
      }
      if (ringLine(x, y, n, 0.16, 0.5, 0.66)) {
        return true;
      }
      for (let i = 1; i < 9; i++) {
        const b = -Math.PI + (i * Math.PI) / 9;
        if (Math.abs(Math.sin(fan.a - b)) * fan.r <= G(n) / 2 && Math.cos(fan.a - b) > 0) {
          return true;
        }
      }
      for (let i = 0; i < 9; i++) {
        const b = -Math.PI + ((i + 0.5) * Math.PI) / 9;
        if (circle(x, y, 0.5 + 0.44 * Math.cos(b), 0.66 + 0.44 * Math.sin(b), 0.022) || circle(x, y, 0.5 + 0.3 * Math.cos(b), 0.66 + 0.3 * Math.sin(b), 0.018)) {
          return true;
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  bell: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.32, 0.24) ||
      poly(x, y, [[0.26, 0.32], [0.74, 0.32], [0.9, 0.8], [0.1, 0.8]]) ||
      rect(x, y, 0.04, 0.78, 0.96, 0.86) ||
      circle(x, y, 0.5, 0.93, 0.07) ||
      (circle(x, y, 0.5, 0.06, 0.07) && !circle(x, y, 0.5, 0.06, 0.03)),
    gap: (_x, y, n) => Math.abs(y - 0.52) <= G(n) / 2 || Math.abs(y - 0.78) <= G(n) / 2 || Math.abs(y - 0.87) <= G(n) / 2,
  },

  hurricane: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.64),
    gap: (x, y, n) => {
      const u = x + 0.04 * Math.sin(y * 7);
      const v = y + 0.04 * Math.sin(x * 5);
      if (circle(u, v, 0.5, 0.5, 0.06)) {
        return true;
      }
      return !spiralBand(u, v, n, 3, 4, 3);
    },
    flow: 'tangent',
  },

  gear: {
    fill: (x, y) => {
      const {r, a} = polar(x, y);
      if (r <= 0.36) {
        return true;
      }
      for (let i = 0; i < 12; i++) {
        const b = (i * Math.PI) / 6;
        if (r <= 0.46 && Math.abs(Math.sin(a - b)) * r <= 0.05 && Math.cos(a - b) > 0) {
          return true;
        }
      }
      return anyRot4(x, y, (u, v) => circle(u, v, 0.0, 0.0, 0.2) || (polar(u, v, 0, 0).r <= 0.26 && [0.3, 0.8, 1.3].some(b => Math.abs(Math.sin(polar(u, v, 0, 0).a - b)) * polar(u, v, 0, 0).r <= 0.04)));
    },
    gap: (x, y, n) =>
      circle(x, y, 0.5, 0.5, 0.08) ||
      ringLine(x, y, n, 0.26) ||
      anyRot4(x, y, (u, v) => circle(u, v, 0.63, 0.37, 0.05) || ringLine(u, v, n, 0.1, 0, 0)),
    flow: 'tangent',
  },

  apple: {
    fill: (x, y) =>
      circle(x, y, 0.35, 0.56, 0.3) ||
      circle(x, y, 0.65, 0.56, 0.3) ||
      ellipse(x, y, 0.5, 0.68, 0.32, 0.3) ||
      bar(x, y, 0.5, 0.3, 0.5, 0.06, 0.07) ||
      ellipse(x, y, 0.68, 0.14, 0.14, 0.06, -0.4) ||
      ellipse(x, y, 0.32, 0.14, 0.14, 0.06, 0.4),
    gap: (x, y, n) => Math.abs(y - 0.3) <= G(n) / 2 && Math.abs(x - 0.5) > 0.06,
  },

  strawberry: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.5, 0.42, 0.32) ||
      poly(x, y, [[0.1, 0.48], [0.9, 0.48], [0.5, 0.99]]) ||
      poly(x, y, [[0.16, 0.2], [0.34, 0.22], [0.5, 0.04], [0.66, 0.22], [0.84, 0.2], [0.72, 0.32], [0.28, 0.32]]),
    gap: (x, y, n) => {
      if (Math.abs(y - 0.3) <= G(n) / 2 && Math.abs(x - 0.5) < 0.4) {
        return true;
      }
      if (y < 0.34) {
        return false;
      }
      const cx = Math.floor(x * n);
      const cy = Math.floor(y * n);
      const mx = cx < n / 2 ? cx : n - 1 - cx;
      return (mx + 3 * cy) % 6 === 0 && (cy % 2 === 0);
    },
  },

  koi: {
    fill: (x, y) => {
      const fish = (u: number, v: number) => {
        const {r, a} = polar(u, v, 0.5, 0.5);
        if (a > 0 || a < -Math.PI) {
          return false;
        }
        const t = (a + Math.PI) / Math.PI;
        const w = 0.05 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.15));
        return Math.abs(r - 0.31) <= w || poly(u, v, [[0.2, 0.5], [0.06, 0.44], [0.1, 0.62]]) || ellipse(u, v, 0.5, 0.12, 0.08, 0.04);
      };
      const pad = (u: number, v: number) => circle(u, v, 0.11, 0.12, 0.12) || circle(u, v, 0.89, 0.11, 0.1);
      return fish(x, y) || fish(1 - x, 1 - y) || pad(x, y) || pad(1 - x, 1 - y);
    },
    gap: (x, y, n) => {
      const eye = (u: number, v: number) => circle(u, v, 0.74, 0.3, G(n) * 0.8);
      const slit = (u: number, v: number) => bar(u, v, 0.1, 0.12, 0.2, 0.12, G(n));
      return eye(x, y) || eye(1 - x, 1 - y) || slit(x, y) || slit(1 - x, 1 - y);
    },
    flow: 'tangent',
  },

  house: {
    fill: (x, y) =>
      poly(x, y, [[0.5, 0.02], [1.02, 0.46], [-0.02, 0.46]]) ||
      rect(x, y, 0.1, 0.42, 0.9, 1) ||
      rect(x, y, 0.72, 0.08, 0.82, 0.3) ||
      rect(x, y, 0.18, 0.08, 0.28, 0.3),
    gap: (x, y, n) =>
      Math.abs(y - 0.46) <= G(n) / 2 ||
      rect(x, y, 0.42, 0.7, 0.58, 1) ||
      rect(x, y, 0.2, 0.56, 0.32, 0.68) ||
      rect(x, y, 0.68, 0.56, 0.8, 0.68) ||
      ringLine(x, y, n, 0.06, 0.5, 0.3),
  },

  aztec: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.6),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if ([0.12, 0.24, 0.36, 0.48].some(k => ringLine(x, y, n, k))) {
        return true;
      }
      const spokes = (count: number, off: number, r0: number, r1: number) => {
        for (let i = 0; i < count; i++) {
          const b = off + (i * 2 * Math.PI) / count;
          if (r > r0 && r < r1 && Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
            return true;
          }
        }
        return false;
      };
      if (spokes(4, Math.PI / 4, 0.12, 0.24) || spokes(16, 0, 0.36, 0.48)) {
        return true;
      }
      if (r > 0.24 && r < 0.36) {
        const saw = Math.abs((((a / (2 * Math.PI)) * 8 + 8) % 1) - 0.5) * 2;
        return Math.abs(r - (0.26 + 0.08 * saw)) <= G(n) / 2;
      }
      return false;
    },
    flow: 'tangent',
  },

  crab: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.58, 0.32, 0.22) ||
        (circle(mx, y, 0.15, 0.2, 0.13) && !poly(mx, y, [[0.15, 0.2], [0.2, 0.04], [0.3, 0.1]])) ||
        bar(mx, y, 0.3, 0.48, 0.17, 0.3, 0.08) ||
        bar(mx, y, 0.24, 0.6, 0.02, 0.52, 0.05) ||
        bar(mx, y, 0.24, 0.66, 0.02, 0.7, 0.05) ||
        bar(mx, y, 0.26, 0.72, 0.06, 0.86, 0.05) ||
        bar(mx, y, 0.44, 0.4, 0.42, 0.28, 0.04) ||
        circle(mx, y, 0.42, 0.27, 0.04)
      );
    },
    gap: (x, y, n) => outlineOf((u, v) => ellipse(u, v, 0.5, 0.6, 0.22, 0.13), x, y, n),
  },

  elephant: {
    fill: (x, y) =>
      ellipse(x, y, 0.56, 0.5, 0.34, 0.26) ||
      circle(x, y, 0.26, 0.4, 0.18) ||
      lineDist(x, y, [[0.14, 0.44], [0.08, 0.68], [0.14, 0.86]]) <= 0.05 ||
      rect(x, y, 0.32, 0.64, 0.42, 0.96) ||
      rect(x, y, 0.46, 0.66, 0.56, 0.96) ||
      rect(x, y, 0.66, 0.66, 0.76, 0.96) ||
      rect(x, y, 0.8, 0.64, 0.9, 0.94) ||
      bar(x, y, 0.9, 0.46, 0.98, 0.64, 0.03),
    gap: (x, y, n) =>
      outlineOf((u, v) => ellipse(u, v, 0.38, 0.4, 0.12, 0.16), x, y, n) ||
      circle(x, y, 0.22, 0.34, G(n) * 0.8) ||
      [0.44, 0.61, 0.78].some(k => Math.abs(x - k) <= G(n) / 2 && y > 0.66),
  },

  umbrella: {
    fill: (x, y) =>
      (circle(x, y, 0.5, 0.54, 0.5) && y < 0.54 && ![0.14, 0.38, 0.62, 0.86].some(cx => circle(x, y, cx, 0.58, 0.1))) ||
      rect(x, y, 0.46, 0.46, 0.54, 0.9) ||
      (y > 0.86 && Math.abs(polar(x, y, 0.4, 0.88).r - 0.1) <= 0.04),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y, 0.5, 0.54);
      if (y > 0.5 || r < 0.08) {
        return false;
      }
      return [-0.25, -0.5, -0.75].some(k => {
        const b = k * Math.PI;
        return Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0;
      }) || ringLine(x, y, n, 0.24, 0.5, 0.54);
    },
  },

  mosaic: {
    fill: FULL,
    gap: (x, y, n) =>
      squareLine(x, y, n, 0.48) ||
      [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].some(([cx, cy]) =>
        outlineOf((u, v) => poly(u, v, starPts(cx, cy, 0.2, 0.12, 8, 0)), x, y, n),
      ),
  },

  saturn: {
    fill: (x, y) => {
      const ring = ellipse(x, y, 0.5, 0.5, 0.64, 0.26, -0.45) && !ellipse(x, y, 0.5, 0.5, 0.4, 0.1, -0.45);
      const star = (u: number, v: number) => poly(u, v, starPts(0.12, 0.12, 0.12, 0.05, 4));
      return circle(x, y, 0.5, 0.5, 0.3) || ring || star(x, y) || star(1 - x, 1 - y);
    },
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.3) ||
      (circle(x, y, 0.5, 0.5, 0.29) && Math.abs(y - 0.5 + (x - 0.5) * 0.48) <= G(n) / 2),
  },

  circuit: {
    fill: FULL,
    gap: (x, y, n) =>
      TRACES.some(t => lineDist(x, y, t) <= G(n) / 2) ||
      outlineOf((u, v) => rect(u, v, 0.36, 0.3, 0.6, 0.64), x, y, n) ||
      outlineOf((u, v) => rect(u, v, 0.66, 0.66, 0.9, 0.92), x, y, n) ||
      outlineOf((u, v) => rect(u, v, 0.06, 0.04, 0.2, 0.14), x, y, n) ||
      circle(x, y, 0.34, 0.5, G(n)) ||
      circle(x, y, 0.4, 0.58, G(n)) ||
      circle(x, y, 0.22, 0.4, G(n)),
  },

  gift: {
    fill: (x, y) =>
      rect(x, y, 0.08, 0.38, 0.92, 1) ||
      rect(x, y, 0.02, 0.24, 0.98, 0.38) ||
      ellipse(x, y, 0.32, 0.14, 0.18, 0.09, -0.3) ||
      ellipse(x, y, 0.68, 0.14, 0.18, 0.09, 0.3),
    gap: (x, y, n) => (Math.abs(Math.abs(x - 0.5) - 0.08) <= G(n) / 2 && y > 0.24) || Math.abs(y - 0.39) <= G(n) / 2,
  },

  robot: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        rect(x, y, 0.26, 0.1, 0.74, 0.34) ||
        bar(x, y, 0.5, 0.1, 0.5, 0.02, 0.04) ||
        circle(x, y, 0.5, 0.03, 0.035) ||
        rect(x, y, 0.42, 0.34, 0.58, 0.4) ||
        rect(x, y, 0.18, 0.4, 0.82, 0.78) ||
        rect(mx, y, 0.03, 0.42, 0.14, 0.74) ||
        rect(mx, y, 0.26, 0.8, 0.44, 1.0)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        circle(mx, y, 0.38, 0.2, 0.045) ||
        (Math.abs(y - 0.28) <= G(n) / 2 && Math.abs(x - 0.5) < 0.12) ||
        outlineOf((u, v) => rect(u, v, 0.32, 0.48, 0.68, 0.68), x, y, n) ||
        Math.abs(mx - 0.16) <= G(n) / 2 && y > 0.4 && y < 0.78
      );
    },
  },

  nautilus: {
    fill: (x, y) => {
      const b = Math.log(2.2) / (2 * Math.PI);
      const {r, a} = polar(x, y, 0.56, 0.52);
      const t = (a + 2 * Math.PI) % (2 * Math.PI);
      return r <= 0.05 * Math.exp(b * (t + 6 * Math.PI)) * 1.02;
    },
    gap: (x, y, n) => {
      const b = Math.log(2.2) / (2 * Math.PI);
      const {r, a} = polar(x, y, 0.56, 0.52);
      const t = (a + 2 * Math.PI) % (2 * Math.PI);
      for (let k = 0; k < 3; k++) {
        if (Math.abs(r - 0.05 * Math.exp(b * (t + 2 * Math.PI * k))) <= G(n) / 2) {
          return true;
        }
      }
      const outer = 0.05 * Math.exp(b * (t + 4 * Math.PI));
      if (r > outer) {
        for (let i = 0; i < 8; i++) {
          const c = (i * Math.PI) / 4 + 0.2;
          if (Math.abs(Math.sin(a - c)) * r <= G(n) / 2 && Math.cos(a - c) > 0) {
            return true;
          }
        }
      }
      return false;
    },
    flow: 'tangent',
  },

  spider: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      const legs: [number, number][][] = [
        [[0.42, 0.34], [0.24, 0.12], [0.16, 0.0]],
        [[0.42, 0.4], [0.14, 0.28], [0.0, 0.36]],
        [[0.42, 0.46], [0.14, 0.58], [0.02, 0.74]],
        [[0.44, 0.52], [0.24, 0.78], [0.16, 0.98]],
      ];
      return (
        ellipse(x, y, 0.5, 0.66, 0.18, 0.22) ||
        circle(x, y, 0.5, 0.38, 0.12) ||
        legs.some(l => lineDist(mx, y, l) <= 0.028) ||
        bar(x, y, 0.5, 0.26, 0.5, 0.0, 0.03)
      );
    },
    gap: (x, y, n) =>
      poly(x, y, [[0.45, 0.58], [0.55, 0.58], [0.5, 0.66]]) ||
      poly(x, y, [[0.45, 0.74], [0.55, 0.74], [0.5, 0.66]]) ||
      Math.abs(y - 0.48) <= G(n) / 2 && Math.abs(x - 0.5) < 0.16,
  },

  icecream: {
    fill: (x, y) =>
      poly(x, y, [[0.2, 0.5], [0.8, 0.5], [0.5, 1.0]]) ||
      circle(x, y, 0.28, 0.44, 0.22) ||
      circle(x, y, 0.72, 0.44, 0.22) ||
      circle(x, y, 0.5, 0.26, 0.24) ||
      circle(x, y, 0.5, 0.04, 0.05),
    gap: (x, y, n) =>
      Math.abs(y - 0.52) <= G(n) / 2 ||
      (y > 0.52 && (Math.abs((((x + y) * n) / 5) % 1) < 0.15 || Math.abs((((x - y + 1) * n) / 5) % 1) < 0.15)) ||
      (y < 0.5 && y > 0.3 && Math.abs(Math.abs(x - 0.5) - 0.17) <= G(n) / 2),
  },

  globe: {
    fill: (x, y) => circle(x, y, 0.5, 0.48, 0.47) || poly(x, y, [[0.28, 1.0], [0.72, 1.0], [0.58, 0.92], [0.42, 0.92]]),
    gap: (x, y, n) =>
      (circle(x, y, 0.5, 0.48, 0.46) &&
        ([-0.3, -0.15, 0, 0.15, 0.3].some(k => Math.abs(y - 0.48 - k) <= G(n) / 2) ||
          outlineOf((u, v) => ellipse(u, v, 0.5, 0.48, 0.16, 0.47), x, y, n) ||
          outlineOf((u, v) => ellipse(u, v, 0.5, 0.48, 0.34, 0.47), x, y, n))) ||
      Math.abs(y - 0.95) <= G(n) / 2,
  },

  atom: {
    fill: (x, y) => {
      if (circle(x, y, 0.5, 0.5, 0.11)) {
        return true;
      }
      for (const rot of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        if (ellipse(x, y, 0.5, 0.5, 0.5, 0.17, rot) && !ellipse(x, y, 0.5, 0.5, 0.41, 0.09, rot)) {
          return true;
        }
      }
      return false;
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.12) || ringLine(x, y, n, 0.05),
  },

  ladybug: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        circle(x, y, 0.5, 0.58, 0.4) ||
        (circle(x, y, 0.5, 0.2, 0.15) && y < 0.26) ||
        bar(mx, y, 0.44, 0.08, 0.34, 0.0, 0.03) ||
        bar(mx, y, 0.14, 0.44, 0.02, 0.38, 0.04) ||
        bar(mx, y, 0.12, 0.62, 0.0, 0.64, 0.04) ||
        bar(mx, y, 0.16, 0.8, 0.06, 0.9, 0.04)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.26) ||
        Math.abs(y - 0.25) <= G(n) / 2 ||
        circle(mx, y, 0.3, 0.44, 0.07) ||
        circle(mx, y, 0.26, 0.68, 0.065) ||
        circle(mx, y, 0.4, 0.84, 0.05)
      );
    },
  },

  skyline: {
    fill: (x, y) => {
      const tops = [0.46, 0.3, 0.52, 0.12, 0.38, 0.22, 0.56, 0.34, 0.16, 0.44];
      const i = Math.min(9, Math.floor(x * 10));
      return y >= tops[i] || bar(x, y, 0.35, 0.12, 0.35, 0.0, 0.02) || bar(x, y, 0.85, 0.16, 0.85, 0.02, 0.02);
    },
    gap: (x, y, n) => {
      const xi = x * 10;
      if (Math.abs(xi - Math.round(xi)) * 0.1 <= G(n) / 2 && Math.round(xi) > 0 && Math.round(xi) < 10) {
        return true;
      }
      return y > 0.2 && y < 0.9 && Math.abs(((y * n) / 4) % 1) < 0.2 && Math.abs(((x * 10) % 1) - 0.5) < 0.3;
    },
    flow: 'vertical',
  },

  pumpkin: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.58, 0.2, 0.36) ||
      ellipse(x, y, 0.34, 0.58, 0.2, 0.34) ||
      ellipse(x, y, 0.66, 0.58, 0.2, 0.34) ||
      ellipse(x, y, 0.2, 0.6, 0.17, 0.3) ||
      ellipse(x, y, 0.8, 0.6, 0.17, 0.3) ||
      rect(x, y, 0.45, 0.06, 0.56, 0.24),
    gap: (x, y, n) =>
      poly(x, y, [[0.28, 0.5], [0.4, 0.5], [0.34, 0.4]]) ||
      poly(x, y, [[0.6, 0.5], [0.72, 0.5], [0.66, 0.4]]) ||
      poly(x, y, [[0.46, 0.6], [0.54, 0.6], [0.5, 0.54]]) ||
      poly(x, y, [[0.24, 0.7], [0.76, 0.7], [0.68, 0.8], [0.6, 0.74], [0.5, 0.82], [0.4, 0.74], [0.32, 0.8]]) ||
      Math.abs(y - 0.25) <= G(n) / 2,
  },

  pagoda: {
    fill: (x, y) => {
      for (let k = 0; k < 4; k++) {
        const w = 0.2 + 0.09 * k;
        const y0 = 0.1 + 0.22 * k;
        if (poly(x, y, [[0.5 - w - 0.06, y0 + 0.08], [0.5 + w + 0.06, y0 + 0.08], [0.5 + w * 0.6, y0], [0.5 - w * 0.6, y0]])) {
          return true;
        }
        if (rect(x, y, 0.5 - w * 0.6, y0 + 0.08, 0.5 + w * 0.6, y0 + 0.22)) {
          return true;
        }
      }
      return bar(x, y, 0.5, 0.1, 0.5, 0.0, 0.04);
    },
    gap: (x, y, n) =>
      [0, 1, 2, 3].some(k => Math.abs(y - (0.1 + 0.22 * k + 0.08)) <= G(n) / 2) ||
      (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.5),
  },

  dragonfly: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        rect(x, y, 0.46, 0.1, 0.54, 0.98) ||
        circle(x, y, 0.5, 0.1, 0.08) ||
        ellipse(mx, y, 0.26, 0.28, 0.27, 0.13, -0.12) ||
        ellipse(mx, y, 0.28, 0.5, 0.25, 0.12, 0.14)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        bar(mx, y, 0.44, 0.3, 0.04, 0.24, G(n)) ||
        bar(mx, y, 0.44, 0.48, 0.06, 0.54, G(n)) ||
        [0.3, 0.5, 0.7, 0.86].some(k => Math.abs(y - k) <= G(n) / 2 && Math.abs(x - 0.5) < 0.05)
      );
    },
  },

  helix: {
    fill: (x, y) => {
      const s = 0.3 * Math.sin(2 * Math.PI * 1.5 * y);
      const a = 0.5 + s;
      const b = 0.5 - s;
      const rung = Math.abs(((y * 9) % 1) - 0.5) < 0.2 && x > Math.min(a, b) && x < Math.max(a, b);
      return Math.abs(x - a) <= 0.1 || Math.abs(x - b) <= 0.1 || rung;
    },
    gap: (x, y, n) => {
      const s = 0.3 * Math.sin(2 * Math.PI * 1.5 * y);
      return Math.abs(x - 0.5 - s) <= G(n) / 2 || Math.abs(x - 0.5 + s) <= G(n) / 2;
    },
    flow: 'vertical',
  },

  tiki: {
    fill: (x, y) =>
      poly(x, y, [[0.14, 0.04], [0.86, 0.04], [0.94, 0.3], [0.86, 0.96], [0.14, 0.96], [0.06, 0.3]]) ||
      poly(x, y, [[0.14, 0.04], [0.02, 0.0], [0.08, 0.14]]) ||
      poly(x, y, [[0.86, 0.04], [0.98, 0.0], [0.92, 0.14]]),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        Math.abs(y - 0.18) <= G(n) / 2 ||
        ringLine(mx, y, n, 0.1, 0.3, 0.34) ||
        circle(mx, y, 0.3, 0.34, 0.04) ||
        poly(x, y, [[0.44, 0.4], [0.56, 0.4], [0.6, 0.58], [0.4, 0.58]]) ||
        outlineOf((u, v) => rect(u, v, 0.22, 0.66, 0.78, 0.86), x, y, n) ||
        (y > 0.66 && y < 0.86 && [0.36, 0.5, 0.64].some(k => Math.abs(x - k) <= G(n) / 2))
      );
    },
  },

  rainbow: {
    fill: (x, y) => {
      const r = polar(x, y, 0.5, 0.82).r;
      return (y <= 0.82 && r >= 0.16 && r <= 0.56) || circle(x, y, 0.14, 0.86, 0.15) || circle(x, y, 0.86, 0.86, 0.15);
    },
    gap: (x, y, n) => y <= 0.8 && (ringLine(x, y, n, 0.3, 0.5, 0.82) || ringLine(x, y, n, 0.43, 0.5, 0.82)),
    flow: 'tangent',
  },

  volcano: {
    fill: (x, y) =>
      poly(x, y, [[-0.02, 1.01], [0.34, 0.4], [0.66, 0.4], [1.02, 1.01]]) ||
      circle(x, y, 0.5, 0.26, 0.1) ||
      circle(x, y, 0.38, 0.14, 0.08) ||
      circle(x, y, 0.6, 0.08, 0.07),
    gap: (x, y, n) =>
      Math.abs(y - 0.42) <= G(n) / 2 ||
      lineDist(x, y, [[0.46, 0.42], [0.4, 0.56], [0.46, 0.66], [0.36, 0.86]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.56, 0.42], [0.62, 0.6], [0.56, 0.72], [0.68, 0.94]]) <= G(n) / 2 ||
      Math.abs(y - 0.8) <= G(n) / 2,
  },

  chain: {
    fill: (x, y) => {
      const link = (cx: number, cy: number, vertical: boolean) => {
        const [rx, ry] = vertical ? [0.1, 0.18] : [0.2, 0.12];
        return ellipse(x, y, cx, cy, rx, ry) && !ellipse(x, y, cx, cy, rx - 0.07, ry - 0.07);
      };
      return [0.28, 0.72].some(cy => link(0.16, cy, false) || link(0.5, cy, true) || link(0.84, cy, false) || link(0.33, cy, true) || link(0.67, cy, true)) ||
        rect(x, y, 0.0, 0.0, 1.0, 0.06) || rect(x, y, 0.0, 0.94, 1.0, 1.0);
    },
    gap: (_x, y, n) => Math.abs(y - 0.075) <= G(n) / 2 || Math.abs(y - 0.925) <= G(n) / 2,
  },

  panda: {
    fill: (x, y) => circle(x, y, 0.5, 0.56, 0.42) || circle(x, y, 0.16, 0.18, 0.14) || circle(x, y, 0.84, 0.18, 0.14),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ringLine(mx, y, n, 0.08, 0.16, 0.18) ||
        outlineOf((u, v) => ellipse(u, v, 0.33, 0.52, 0.1, 0.14, 0.5), mx, y, n) ||
        circle(mx, y, 0.34, 0.5, 0.035) ||
        ellipse(x, y, 0.5, 0.66, 0.06, 0.04) ||
        bar(mx, y, 0.5, 0.7, 0.42, 0.78, G(n))
      );
    },
  },

  temple: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        poly(x, y, [[0.5, 0.02], [0.98, 0.24], [0.02, 0.24]]) ||
        rect(x, y, 0.02, 0.24, 0.98, 0.33) ||
        [0.06, 0.22, 0.38].some(c => rect(mx, y, c, 0.33, c + 0.09, 0.86)) ||
        rect(x, y, 0.02, 0.86, 0.98, 0.92) ||
        rect(x, y, 0.0, 0.92, 1.0, 1.0)
      );
    },
    gap: (x, y, n) =>
      [0.245, 0.335, 0.86, 0.925].some(k => Math.abs(y - k) <= G(n) / 2) ||
      circle(x, y, 0.5, 0.16, 0.04),
    flow: 'vertical',
  },

  cupcake: {
    fill: (x, y) =>
      poly(x, y, [[0.18, 0.56], [0.82, 0.56], [0.72, 0.98], [0.28, 0.98]]) ||
      circle(x, y, 0.28, 0.46, 0.16) ||
      circle(x, y, 0.72, 0.46, 0.16) ||
      circle(x, y, 0.5, 0.36, 0.2) ||
      circle(x, y, 0.5, 0.14, 0.1),
    gap: (x, y, n) =>
      Math.abs(y - 0.57) <= G(n) / 2 ||
      (y > 0.58 && [-0.16, 0, 0.16].some(k => Math.abs(x - 0.5 - k * (1 - (y - 0.56) * 0.5)) <= G(n) / 2)) ||
      (y < 0.55 && y > 0.3 && ringLine(x, y, n, 0.14, 0.5, 0.52)),
  },

  fingerprint: {
    fill: (x, y) => ellipse(x, y, 0.5, 0.5, 0.46, 0.54),
    gap: (x, y, n) => {
      const u = (x - 0.5) / 0.82;
      const v = y - 0.56 + 0.05 * Math.sin(x * 9);
      const r = Math.hypot(u, v) * n;
      return Math.abs((r / 2.6) % 1) < 0.38 / 2.6 * 1.5 && r > 1.5;
    },
    flow: 'tangent',
  },

  padlock: {
    fill: (x, y) => {
      const r = polar(x, y, 0.5, 0.36).r;
      return (y < 0.42 && r >= 0.2 && r <= 0.31) || rect(x, y, 0.1, 0.4, 0.9, 0.98);
    },
    gap: (x, y, n) =>
      circle(x, y, 0.5, 0.62, 0.07) ||
      rect(x, y, 0.46, 0.62, 0.54, 0.82) ||
      Math.abs(y - 0.42) <= G(n) / 2 ||
      outlineOf((u, v) => rect(u, v, 0.2, 0.5, 0.8, 0.9), x, y, n),
  },

  sierpinski: {
    fill: (x, y) => sierpinski(x, y, 0.5, 0.0, 1.12, 1.0, 2),
  },

  windmill: {
    fill: (x, y) =>
      [[0.08, 0.0], [0.92, 0.0], [0.08, 0.74], [0.92, 0.74]].some(([ex, ey]) => bar(x, y, 0.5, 0.36, ex, ey, 0.15)) ||
      poly(x, y, [[0.4, 0.36], [0.6, 0.36], [0.74, 1.0], [0.26, 1.0]]) ||
      circle(x, y, 0.5, 0.36, 0.08),
    gap: (x, y, n) =>
      [[0.08, 0.0], [0.92, 0.0], [0.08, 0.74], [0.92, 0.74]].some(([ex, ey]) => bar(x, y, 0.5 + (ex - 0.5) * 0.25, 0.36 + (ey - 0.36) * 0.25, ex, ey, G(n))) ||
      ringLine(x, y, n, 0.08, 0.5, 0.36) ||
      rect(x, y, 0.44, 0.84, 0.56, 1.0) ||
      Math.abs(y - 0.62) <= G(n) / 2 && y > 0.5,
  },

  ghost: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.4, 0.38) ||
      rect(x, y, 0.12, 0.4, 0.88, 0.86) ||
      [0.2, 0.5, 0.8].some(cx => circle(x, y, cx, 0.86, 0.11)) ||
      ellipse(x, y, 0.06, 0.56, 0.08, 0.14, 0.5) ||
      ellipse(x, y, 0.94, 0.56, 0.08, 0.14, -0.5),
    gap: (x, y, n) =>
      ellipse(x, y, 0.36, 0.38, 0.06, 0.09) ||
      ellipse(x, y, 0.64, 0.38, 0.06, 0.09) ||
      ellipse(x, y, 0.5, 0.6, 0.08, 0.06) ||
      outlineOf((u, v) => circle(u, v, 0.5, 0.46, 0.26), x, y, n) && y > 0.6,
  },

  swan: {
    fill: (x, y) =>
      ellipse(x, y, 0.58, 0.68, 0.36, 0.18) ||
      lineDist(x, y, [[0.3, 0.64], [0.2, 0.44], [0.24, 0.24], [0.36, 0.12]]) <= 0.055 ||
      ellipse(x, y, 0.4, 0.12, 0.08, 0.05) ||
      poly(x, y, [[0.46, 0.1], [0.58, 0.16], [0.46, 0.15]]) ||
      poly(x, y, [[0.4, 0.62], [0.96, 0.34], [0.86, 0.62]]) ||
      rect(x, y, 0.0, 0.9, 1.0, 1.0),
    gap: (x, y, n) =>
      outlineOf((u, v) => poly(u, v, [[0.46, 0.64], [0.9, 0.42], [0.82, 0.62]]), x, y, n) ||
      circle(x, y, 0.39, 0.11, G(n) * 0.7) ||
      Math.abs(y - 0.88) <= G(n) / 2 ||
      Math.abs(y - 0.95 - 0.02 * Math.sin(x * 25)) <= G(n) / 2,
  },

  skull: {
    fill: (x, y) => circle(x, y, 0.5, 0.42, 0.42) || rect(x, y, 0.24, 0.6, 0.76, 0.94),
    gap: (x, y, n) =>
      ellipse(x, y, 0.33, 0.46, 0.1, 0.09) ||
      ellipse(x, y, 0.67, 0.46, 0.1, 0.09) ||
      poly(x, y, [[0.5, 0.56], [0.44, 0.66], [0.56, 0.66]]) ||
      Math.abs(y - 0.74) <= G(n) / 2 && Math.abs(x - 0.5) < 0.26 ||
      (y > 0.74 && [0.36, 0.45, 0.55, 0.64].some(k => Math.abs(x - k) <= G(n) / 2)),
  },

  frog: {
    fill: (x, y) => ellipse(x, y, 0.5, 0.6, 0.46, 0.34) || circle(x, y, 0.25, 0.26, 0.15) || circle(x, y, 0.75, 0.26, 0.15),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ringLine(mx, y, n, 0.08, 0.25, 0.26) ||
        circle(mx, y, 0.25, 0.26, 0.03) ||
        (y > 0.6 && ringLine(x, y, n, 0.32, 0.5, 0.38)) ||
        circle(mx, y, 0.44, 0.5, G(n) * 0.8)
      );
    },
  },

  dolphins: {
    fill: (x, y) => {
      const dolphin = (u: number, v: number) => {
        const {r, a} = polar(u, v, 0.5, 0.6);
        let body = false;
        if (a <= -0.3 && a >= -Math.PI + 0.3) {
          const t = (a + Math.PI - 0.3) / (Math.PI - 0.6);
          const w = 0.025 + 0.075 * Math.sin(Math.PI * Math.min(1, t * 1.1));
          body = Math.abs(r - 0.34) <= w;
        }
        return (
          body ||
          poly(u, v, [[0.46, 0.3], [0.54, 0.16], [0.6, 0.29]]) ||
          poly(u, v, [[0.2, 0.46], [0.04, 0.4], [0.12, 0.56]]) ||
          ellipse(u, v, 0.83, 0.47, 0.07, 0.035, 0.9)
        );
      };
      const frame = (() => {
        const r = polar(x, y).r;
        return r >= 0.5 && r <= 0.62;
      })();
      return dolphin(x, y) || dolphin(1 - x, 1 - y) || circle(x, y, 0.5, 0.5, 0.08) || frame;
    },
    gap: (x, y, n) => {
      const eye = (u: number, v: number) => circle(u, v, 0.72, 0.36, G(n) * 0.8);
      return eye(x, y) || eye(1 - x, 1 - y) || ringLine(x, y, n, 0.56);
    },
    flow: 'tangent',
  },

  note: {
    fill: (x, y) =>
      ellipse(x, y, 0.24, 0.8, 0.21, 0.15, -0.4) ||
      ellipse(x, y, 0.72, 0.72, 0.21, 0.15, -0.4) ||
      rect(x, y, 0.33, 0.14, 0.44, 0.78) ||
      rect(x, y, 0.81, 0.06, 0.92, 0.7) ||
      poly(x, y, [[0.33, 0.1], [0.92, 0.0], [0.92, 0.24], [0.33, 0.34]]),
    gap: (x, y, n) => Math.abs(y - 0.12 - (0.88 - x) * 0.185) <= G(n) / 2 && x > 0.34 && x < 0.88,
  },

  pentagram: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.56),
    gap: (x, y, n) => {
      const pts = starPts(0.5, 0.52, 0.46, 0.46, 5).filter((_, i) => i % 2 === 0);
      for (let i = 0; i < 5; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 2) % 5];
        if (bar(x, y, ax, ay, bx, by, G(n))) {
          return true;
        }
      }
      return ringLine(x, y, n, 0.47) || ringLine(x, y, n, 0.1, 0.5, 0.52);
    },
  },

  snowman: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        circle(x, y, 0.5, 0.74, 0.27) ||
        circle(x, y, 0.5, 0.4, 0.2) ||
        circle(x, y, 0.5, 0.18, 0.14) ||
        rect(x, y, 0.3, 0.07, 0.7, 0.11) ||
        rect(x, y, 0.37, 0.0, 0.63, 0.08) ||
        bar(mx, y, 0.34, 0.42, 0.06, 0.26, 0.05)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        Math.abs(y - 0.11) <= G(n) / 2 && mx > 0.36 ||
        Math.abs(y - 0.3) <= G(n) / 2 ||
        Math.abs(y - 0.53) <= G(n) / 2 ||
        circle(mx, y, 0.45, 0.18, 0.025) ||
        [0.4, 0.48, 0.7, 0.8].some(k => circle(x, y, 0.5, k, 0.03))
      );
    },
  },

  rooms: {
    fill: FULL,
    gap: (x, y, n) => WALLS.some(([x1, y1, x2, y2]) => bar(x, y, x1, y1, x2, y2, G(n))) || (squareLine(x, y, n, 0.48) && !(Math.abs(x - 0.9) < 0.04 && y > 0.9)),
  },

  clockwork: {
    fill: FULL,
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (ringLine(x, y, n, 0.44) || ringLine(x, y, n, 0.3) || ringLine(x, y, n, 0.08)) {
        return true;
      }
      if (r > 0.3 && r < 0.44) {
        for (let i = 0; i < 12; i++) {
          const b = (i * Math.PI) / 6;
          if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0) {
            return true;
          }
        }
      }
      return anyRot4(x, y, (u, v) => ringLine(u, v, n, 0.2, 0, 0) || ringLine(u, v, n, 0.1, 0, 0));
    },
    flow: 'tangent',
  },
};
Object.assign(P, P3);

// ------------------------------------------------------ patterns, 151-200

export const octPts = (cx: number, cy: number, r: number) =>
  Array.from({length: 8}, (_, i) => [cx + r * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), cy + r * Math.sin(Math.PI / 8 + (i * Math.PI) / 4)] as [number, number]);

/** Raindrop: round bottom at (cx, cy), point above. */
export const drop = (x: number, y: number, cx: number, cy: number, s: number) =>
  circle(x, y, cx, cy, s) || poly(x, y, [[cx - s * 0.95, cy - s * 0.3], [cx + s * 0.95, cy - s * 0.3], [cx, cy - s * 2.3]]);

export const RIPPLES: [number, number][] = [[0.26, 0.3], [0.74, 0.4], [0.4, 0.8]];
export const SWIRLS: [number, number, number][] = [[0.26, 0.28, 0.17], [0.72, 0.62, 0.2], [0.24, 0.8, 0.13]];

export const P4: Record<string, Pattern> = {
  hexagram: {
    fill: (x, y) =>
      poly(x, y, [[0.5, 0.0], [0.97, 0.76], [0.03, 0.76]]) || poly(x, y, [[0.5, 1.0], [0.97, 0.24], [0.03, 0.24]]),
    gap: (x, y, n) =>
      outlineOf((u, v) => poly(u, v, [[0.5, 0.0], [0.97, 0.76], [0.03, 0.76]]), x, y, n) && poly(x, y, [[0.5, 1.0], [0.97, 0.24], [0.03, 0.24]]) ||
      outlineOf((u, v) => poly(u, v, [[0.5, 1.0], [0.97, 0.24], [0.03, 0.24]]), x, y, n) && poly(x, y, [[0.5, 0.0], [0.97, 0.76], [0.03, 0.76]]) ||
      ringLine(x, y, n, 0.1),
  },

  scorpion: {
    fill: (x, y) => {
      const tail: [number, number][] = [[0.36, 0.7], [0.2, 0.56], [0.16, 0.34], [0.28, 0.16], [0.46, 0.12]];
      return (
        ellipse(x, y, 0.56, 0.7, 0.25, 0.15) ||
        circle(x, y, 0.8, 0.68, 0.1) ||
        lineDist(x, y, tail) <= 0.085 ||
        poly(x, y, [[0.44, 0.06], [0.58, 0.14], [0.46, 0.2]]) ||
        bar(x, y, 0.8, 0.62, 0.9, 0.46, 0.08) ||
        circle(x, y, 0.91, 0.36, 0.1) ||
        bar(x, y, 0.8, 0.74, 0.9, 0.88, 0.08) ||
        circle(x, y, 0.91, 0.92, 0.09) ||
        [0.44, 0.56, 0.68].some(lx => bar(x, y, lx, 0.8, lx - 0.08, 0.98, 0.045) || bar(x, y, lx, 0.6, lx - 0.1, 0.44, 0.045))
      );
    },
    gap: (x, y, n) =>
      [0.46, 0.56, 0.66].some(k => Math.abs(x - k) <= G(n) / 2 && Math.abs(y - 0.7) < 0.1) ||
      circle(x, y, 0.95, 0.36, 0.035) ||
      circle(x, y, 0.95, 0.96, 0.03) ||
      [[0.28, 0.63], [0.18, 0.44], [0.2, 0.25]].some(([cx, cy]) => circle(x, y, cx, cy, G(n) * 0.7)),
  },

  teapot: {
    fill: (x, y) => {
      const hr = polar(x, y, 0.16, 0.58).r;
      return (
        ellipse(x, y, 0.48, 0.6, 0.34, 0.28) ||
        ellipse(x, y, 0.48, 0.3, 0.2, 0.07) ||
        circle(x, y, 0.48, 0.2, 0.05) ||
        bar(x, y, 0.76, 0.64, 0.96, 0.34, 0.09) ||
        (x < 0.2 && hr >= 0.09 && hr <= 0.17) ||
        rect(x, y, 0.24, 0.84, 0.72, 0.92)
      );
    },
    gap: (_x, y, n) => Math.abs(y - 0.5) <= G(n) / 2 || Math.abs(y - 0.72) <= G(n) / 2 || Math.abs(y - 0.35) <= G(n) / 2,
  },

  airplane: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.5, 0.09, 0.49) ||
        poly(mx, y, [[0.46, 0.26], [0.0, 0.46], [0.0, 0.64], [0.46, 0.56]]) ||
        poly(mx, y, [[0.47, 0.76], [0.22, 0.9], [0.22, 0.98], [0.47, 0.94]]) ||
        ellipse(mx, y, 0.24, 0.5, 0.04, 0.09)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return ringLine(x, y, n, 0.05, 0.5, 0.12) || Math.abs(y - 0.44 - (0.46 - mx) * 0.3) <= G(n) / 2 && mx < 0.4 || Math.abs(y - 0.66) <= G(n) / 2 && Math.abs(x - 0.5) < 0.09;
    },
  },

  train: {
    fill: (x, y) =>
      rect(x, y, 0.06, 0.4, 0.6, 0.78) ||
      rect(x, y, 0.4, 0.2, 0.6, 0.42) ||
      rect(x, y, 0.36, 0.16, 0.64, 0.22) ||
      rect(x, y, 0.12, 0.16, 0.22, 0.4) ||
      rect(x, y, 0.09, 0.1, 0.25, 0.16) ||
      rect(x, y, 0.64, 0.42, 0.98, 0.78) ||
      [0.16, 0.34, 0.52, 0.72, 0.9].some(cx => circle(x, y, cx, 0.84, 0.085)) ||
      rect(x, y, 0.0, 0.94, 1.0, 1.0),
    gap: (x, y, n) =>
      rect(x, y, 0.44, 0.25, 0.56, 0.34) ||
      [0.7, 0.8, 0.9].some(cx => rect(x, y, cx - 0.03, 0.48, cx + 0.03, 0.58)) ||
      Math.abs(x - 0.62) <= G(n) / 2 ||
      Math.abs(y - 0.6) <= G(n) / 2 && x < 0.4 ||
      [0.16, 0.34, 0.52, 0.72, 0.9].some(cx => circle(x, y, cx, 0.84, 0.025)) ||
      Math.abs(y - 0.93) <= G(n) / 2,
  },

  brick: {
    fill: FULL,
    gap: (x, y, n) => {
      const row = Math.floor(y * 6);
      if (Math.abs(y * 6 - Math.round(y * 6)) / 6 <= G(n) / 2) {
        return true;
      }
      const off = row % 2 === 0 ? 0 : 0.5;
      const u = x * 3 + off;
      return Math.abs(u - Math.round(u)) / 3 <= G(n) / 2;
    },
    flow: 'horizontal',
  },

  guitar: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.72, 0.29) ||
      circle(x, y, 0.5, 0.42, 0.23) ||
      rect(x, y, 0.44, 0.06, 0.56, 0.3) ||
      rect(x, y, 0.42, 0.0, 0.58, 0.1),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.08, 0.5, 0.56) ||
      Math.abs(y - 0.86) <= G(n) / 2 && Math.abs(x - 0.5) < 0.12 ||
      Math.abs(y - 0.1) <= G(n) / 2 ||
      outlineOf((u, v) => circle(u, v, 0.5, 0.72, 0.21) || circle(u, v, 0.5, 0.42, 0.15), x, y, n),
  },

  totem: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return rect(x, y, 0.18, 0.0, 0.82, 1.0) || poly(mx, y, [[0.18, 0.36], [0.0, 0.26], [0.0, 0.44], [0.18, 0.48]]);
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      const band = Math.floor(y * 3);
      const ly = y * 3 - band;
      if (Math.abs(y - 1 / 3) <= G(n) / 2 || Math.abs(y - 2 / 3) <= G(n) / 2) {
        return mx >= 0.18;
      }
      if (mx < 0.18) {
        return Math.abs(y - 0.4) <= G(n) / 2;
      }
      return (
        ellipse(mx, ly, 0.34, 0.3, 0.07, 0.07 * 3 / 3) && band !== 1 ||
        ringLine(mx, ly / 3, n, 0.035, 0.34, 0.1) && band === 1 ||
        poly(x, ly, [[0.44, 0.44], [0.56, 0.44], [0.5, 0.62]]) ||
        Math.abs(ly - 0.8) <= (G(n) * 3) / 2 && mx > 0.28
      );
    },
    flow: 'vertical',
  },

  bonsai: {
    fill: (x, y) =>
      poly(x, y, [[0.22, 0.84], [0.78, 0.84], [0.7, 1.0], [0.3, 1.0]]) ||
      lineDist(x, y, [[0.5, 0.86], [0.42, 0.68], [0.56, 0.52], [0.46, 0.36]]) <= 0.05 ||
      ellipse(x, y, 0.28, 0.4, 0.22, 0.11) ||
      ellipse(x, y, 0.64, 0.24, 0.26, 0.12) ||
      ellipse(x, y, 0.78, 0.48, 0.18, 0.09) ||
      ellipse(x, y, 0.38, 0.14, 0.14, 0.08),
    gap: (x, y, n) =>
      Math.abs(y - 0.86) <= G(n) / 2 ||
      [[0.28, 0.4], [0.64, 0.24], [0.78, 0.48], [0.38, 0.14]].some(([cx, cy]) => Math.abs(y - cy) <= G(n) / 2 && Math.abs(x - cx) < 0.16),
    flow: 'horizontal',
  },

  runes: {
    fill: (x, y) => circle(x, y, 0.5, 0.5, 0.57),
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (ringLine(x, y, n, 0.47) || ringLine(x, y, n, 0.32) || ringLine(x, y, n, 0.08)) {
        return true;
      }
      if (r > 0.32 && r < 0.47) {
        for (let i = 0; i < 8; i++) {
          const b = (i * Math.PI) / 4;
          const da = Math.atan2(Math.sin(a - b), Math.cos(a - b));
          if (Math.abs(da) * r <= G(n) / 2) {
            return true;
          }
          if (Math.abs(r - 0.4) <= G(n) / 2 && da > 0 && da * r < 0.06) {
            return true;
          }
        }
      }
      return diamondLine(x, y, n, 0.3) && r < 0.32 || squareLine(x, y, n, 0.15);
    },
    flow: 'tangent',
  },

  eye: {
    fill: (x, y) => {
      const tri = poly(x, y, [[0.5, 0.0], [1.02, 0.94], [-0.02, 0.94]]);
      const inner = poly(x, y, [[0.5, 0.14], [0.86, 0.86], [0.14, 0.86]]);
      const lens = circle(x, y, 0.5, 1.1, 0.62) && circle(x, y, 0.5, 0.16, 0.62);
      return (tri && !inner) || lens;
    },
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.11, 0.5, 0.63) ||
      circle(x, y, 0.5, 0.63, 0.045) ||
      outlineOf((u, v) => circle(u, v, 0.5, 1.1, 0.62) && circle(u, v, 0.5, 0.16, 0.62), x, y, n),
  },

  hand: {
    fill: (x, y) =>
      ellipse(x, y, 0.52, 0.68, 0.26, 0.28) ||
      bar(x, y, 0.34, 0.54, 0.3, 0.12, 0.1) ||
      bar(x, y, 0.46, 0.48, 0.45, 0.04, 0.1) ||
      bar(x, y, 0.58, 0.48, 0.6, 0.06, 0.1) ||
      bar(x, y, 0.7, 0.54, 0.76, 0.18, 0.09) ||
      bar(x, y, 0.32, 0.74, 0.08, 0.46, 0.1),
    gap: (x, y, n) =>
      (y < 0.52 && [0.4, 0.52, 0.645].some(k => Math.abs(x - k - (0.5 - y) * 0.02) <= G(n) / 2)) ||
      (y > 0.5 && y < 0.95 && Math.abs(polar(x, y, 0.2, 0.9).r - 0.3) <= G(n) / 2 && x > 0.3) ||
      Math.abs(y - 0.55) <= G(n) / 2 && x > 0.36 && x < 0.74,
  },

  key: {
    fill: (x, y) => {
      const r = polar(x, y, 0.28, 0.38).r;
      return (r >= 0.1 && r <= 0.3) || rect(x, y, 0.5, 0.31, 1.0, 0.47) || rect(x, y, 0.64, 0.47, 0.76, 0.7) || rect(x, y, 0.82, 0.47, 0.94, 0.8);
    },
    gap: (x, y, n) => ringLine(x, y, n, 0.2, 0.28, 0.38) || Math.abs(x - 0.54) <= G(n) / 2 && y > 0.3 && y < 0.48,
  },

  candle: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.22, 0.2) ||
      rect(x, y, 0.32, 0.4, 0.68, 0.92) ||
      ellipse(x, y, 0.5, 0.93, 0.44, 0.07) ||
      ellipse(x, y, 0.35, 0.46, 0.04, 0.1) ||
      ellipse(x, y, 0.65, 0.5, 0.04, 0.12),
    gap: (x, y, n) =>
      outlineOf((u, v) => circle(u, v, 0.5, 0.26, 0.08) || poly(u, v, [[0.43, 0.24], [0.57, 0.24], [0.5, 0.07]]), x, y, n) ||
      Math.abs(y - 0.41) <= G(n) / 2 ||
      Math.abs(y - 0.9) <= G(n) / 2,
  },

  lantern: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.52, 0.42, 0.34) ||
      rect(x, y, 0.28, 0.12, 0.72, 0.2) ||
      rect(x, y, 0.28, 0.84, 0.72, 0.92) ||
      rect(x, y, 0.46, 0.92, 0.54, 1.0) ||
      rect(x, y, 0.47, 0.0, 0.53, 0.12),
    gap: (x, y, n) =>
      outlineOf((u, v) => ellipse(u, v, 0.5, 0.52, 0.14, 0.34), x, y, n) ||
      outlineOf((u, v) => ellipse(u, v, 0.5, 0.52, 0.29, 0.34), x, y, n) ||
      Math.abs(y - 0.2) <= G(n) / 2 ||
      Math.abs(y - 0.84) <= G(n) / 2,
  },

  kite: {
    fill: (x, y) =>
      poly(x, y, [[0.5, 0.0], [0.98, 0.38], [0.5, 0.84], [0.02, 0.38]]) ||
      lineDist(x, y, [[0.5, 0.84], [0.4, 0.9], [0.58, 0.95], [0.48, 1.0]]) <= 0.03 ||
      poly(x, y, [[0.36, 0.84], [0.44, 0.88], [0.36, 0.92]]) ||
      poly(x, y, [[0.64, 0.9], [0.56, 0.94], [0.64, 0.98]]),
    gap: (x, y, n) => (Math.abs(x - 0.5) <= G(n) / 2 && y < 0.82) || Math.abs(y - 0.38) <= G(n) / 2,
  },

  raindrops: {
    fill: (x, y) =>
      drop(x, y, 0.28, 0.36, 0.2) ||
      drop(x, y, 0.74, 0.3, 0.13) ||
      drop(x, y, 0.64, 0.76, 0.21) ||
      drop(x, y, 0.2, 0.84, 0.13) ||
      drop(x, y, 0.92, 0.66, 0.08),
    gap: (x, y, n) =>
      [[0.28, 0.36, 0.2], [0.64, 0.76, 0.21], [0.74, 0.3, 0.13]].some(([cx, cy, s]) =>
        ringLine(x, y, n, s * 0.6, cx, cy) && x < cx && y < cy + s * 0.2),
  },

  pinecone: {
    fill: (x, y) => ellipse(x, y, 0.5, 0.56, 0.34, 0.42) || rect(x, y, 0.46, 0.0, 0.54, 0.16),
    gap: (x, y, n) =>
      Math.abs(y - 0.15) <= G(n) / 2 ||
      (y > 0.16 && ellipse(x, y, 0.5, 0.56, 0.32, 0.4) && (Math.abs((((x - 0.5 + y) * n) / 4 + 10) % 1) < 0.08 || Math.abs((((0.5 - x + y) * n) / 4 + 10) % 1) < 0.08)),
  },

  scarab: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ellipse(x, y, 0.5, 0.62, 0.24, 0.3) ||
        circle(x, y, 0.5, 0.26, 0.1) ||
        ellipse(mx, y, 0.2, 0.4, 0.22, 0.13, 0.5) ||
        ellipse(mx, y, 0.22, 0.66, 0.16, 0.09, -0.4) ||
        bar(mx, y, 0.34, 0.8, 0.18, 0.94, 0.04) ||
        bar(mx, y, 0.44, 0.18, 0.36, 0.04, 0.035)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.38) ||
        ringLine(x, y, n, 0.1, 0.5, 0.26) ||
        bar(mx, y, 0.36, 0.44, 0.04, 0.3, G(n)) ||
        bar(mx, y, 0.36, 0.5, 0.06, 0.44, G(n)) ||
        Math.abs(y - 0.4) <= G(n) / 2 && Math.abs(x - 0.5) < 0.2
      );
    },
  },

  knight: {
    fill: (x, y) =>
      poly(x, y, [
        [0.26, 0.9], [0.8, 0.9], [0.76, 0.8], [0.68, 0.74], [0.64, 0.56], [0.74, 0.46], [0.82, 0.36], [0.78, 0.26],
        [0.62, 0.12], [0.52, 0.02], [0.46, 0.12], [0.3, 0.2], [0.14, 0.38], [0.12, 0.5], [0.22, 0.56], [0.36, 0.46],
        [0.4, 0.54], [0.28, 0.7], [0.32, 0.8],
      ]) || rect(x, y, 0.16, 0.9, 0.9, 1.0),
    gap: (x, y, n) =>
      circle(x, y, 0.36, 0.3, 0.035) ||
      Math.abs(y - 0.9) <= G(n) / 2 ||
      lineDist(x, y, [[0.56, 0.14], [0.66, 0.3], [0.62, 0.46], [0.54, 0.62], [0.58, 0.8]]) <= G(n) / 2,
  },

  checker: {
    fill: FULL,
    gap: (x, y, n) => {
      const i = Math.floor(x * 5);
      const j = Math.floor(y * 5);
      const u = x * 5 - i;
      const v = y * 5 - j;
      const edge = Math.min(u, 1 - u, v, 1 - v) / 5;
      if (edge <= G(n) / 2) {
        return true;
      }
      return (i + j) % 2 === 0 && Math.abs(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) - 0.22) / 5 <= G(n) / 2;
    },
  },

  nestedHex: {
    fill: (x, y) => poly(x, y, hexPts(0.5, 0.5, 0.58, 0)),
    gap: (x, y, n) =>
      [0.44, 0.3, 0.16].some(r => outlineOf((u, v) => poly(u, v, hexPts(0.5, 0.5, r, 0)), x, y, n)) ||
      (Math.abs(y - 0.5) <= G(n) / 2 && polar(x, y).r > 0.16),
  },

  octagons: {
    fill: FULL,
    gap: (x, y, n) =>
      [1 / 6, 0.5, 5 / 6].some(cx => [1 / 6, 0.5, 5 / 6].some(cy => outlineOf((u, v) => poly(u, v, octPts(cx, cy, 0.18)), x, y, n))) ||
      ringLine(x, y, n, 0.07),
  },

  car: {
    fill: (x, y) =>
      rect(x, y, 0.02, 0.5, 0.98, 0.78) ||
      poly(x, y, [[0.2, 0.52], [0.32, 0.26], [0.68, 0.26], [0.82, 0.52]]) ||
      circle(x, y, 0.24, 0.8, 0.13) ||
      circle(x, y, 0.76, 0.8, 0.13),
    gap: (x, y, n) =>
      outlineOf((u, v) => poly(u, v, [[0.28, 0.5], [0.36, 0.32], [0.64, 0.32], [0.74, 0.5]]), x, y, n) ||
      (Math.abs(x - 0.5) <= G(n) / 2 && y > 0.3 && y < 0.72) ||
      ringLine(x, y, n, 0.06, 0.24, 0.8) ||
      ringLine(x, y, n, 0.06, 0.76, 0.8) ||
      Math.abs(y - 0.6) <= G(n) / 2 && (x < 0.12 || x > 0.88),
  },

  weave: {
    fill: FULL,
    gap: (x, y, n) => {
      const i = Math.floor(x * 5);
      const j = Math.floor(y * 5);
      const u = x * 5 - i;
      const v = y * 5 - j;
      if (Math.min(u, 1 - u, v, 1 - v) / 5 <= G(n) / 2) {
        return true;
      }
      const t = (i + j) % 2 === 0 ? v : u;
      return Math.abs(t - 0.5) / 5 <= G(n) / 2;
    },
  },

  ripples: {
    fill: FULL,
    gap: (x, y, n) => {
      let best = Infinity;
      let second = Infinity;
      let src = RIPPLES[0];
      for (const s of RIPPLES) {
        const d = Math.hypot(x - s[0], y - s[1]);
        if (d < best) {
          second = best;
          best = d;
          src = s;
        } else if (d < second) {
          second = d;
        }
      }
      if (second - best < 0.8 / n) {
        return true;
      }
      const k = (best * n) / 3;
      return best > 1.2 / n && Math.abs(k - Math.round(k)) * 3 <= 0.5 && src !== undefined;
    },
    flow: 'tangent',
  },

  tornado: {
    fill: (x, y) => {
      if (y > 0.94) {
        return false;
      }
      const cx = 0.5 + 0.12 * Math.sin(y * 5);
      const w = 0.05 + 0.44 * Math.pow(1 - y, 1.3);
      return Math.abs(x - cx) <= w || circle(x, y, 0.16, 0.86, 0.04) || circle(x, y, 0.84, 0.72, 0.035);
    },
    gap: (x, y, n) => [1, 2, 3, 4, 5, 6].some(k => Math.abs(y - k / 7 - 0.02 * Math.cos((x - 0.5) * 6)) <= G(n) / 2),
    flow: 'horizontal',
  },

  comet: {
    fill: (x, y) =>
      circle(x, y, 0.72, 0.28, 0.17) ||
      poly(x, y, [[0.52, 0.1], [0.9, 0.46], [0.22, 1.0], [0.0, 0.8]]) ||
      poly(x, y, starPts(0.16, 0.18, 0.08, 0.03, 4)) ||
      poly(x, y, starPts(0.9, 0.84, 0.07, 0.025, 4)),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.1, 0.72, 0.28) ||
      ringLine(x, y, n, 0.18, 0.72, 0.28) && x < 0.7 && y > 0.3,
  },

  ufo: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.5, 0.49, 0.15) ||
      (ellipse(x, y, 0.5, 0.42, 0.22, 0.2) && y < 0.46) ||
      poly(x, y, [[0.36, 0.62], [0.64, 0.62], [0.86, 1.0], [0.14, 1.0]]),
    gap: (x, y, n) =>
      Math.abs(y - 0.47) <= G(n) / 2 ||
      [0.2, 0.35, 0.5, 0.65, 0.8].some(cx => circle(x, y, cx, 0.54, 0.03)) ||
      (y > 0.64 && [0.72, 0.82, 0.92].some(k => Math.abs(y - k) <= G(n) / 2)) ||
      Math.abs(y - 0.62) <= G(n) / 2,
  },

  solar: {
    fill: (x, y) => polar(x, y, 0.0, 0.5).r <= 1.05,
    gap: (x, y, n) => {
      const r = polar(x, y, 0.0, 0.5).r;
      if (r < 0.22) {
        return ringLine(x, y, n, 0.12, 0.0, 0.5);
      }
      if ([0.24, 0.42, 0.62, 0.84].some(k => Math.abs(r - k) <= G(n) / 2)) {
        return true;
      }
      return [[0.3, 0.3, 0.05], [0.4, 0.8, 0.07], [0.72, 0.22, 0.06], [0.9, 0.62, 0.08]].some(([cx, cy, s]) =>
        ringLine(x, y, n, s, cx, cy));
    },
    flow: 'tangent',
  },

  parachute: {
    fill: (x, y) =>
      (circle(x, y, 0.5, 0.56, 0.54) && y < 0.5 && ![0.1, 0.3, 0.5, 0.7, 0.9].some(cx => circle(x, y, cx, 0.54, 0.06))) ||
      [0.04, 0.3, 0.7, 0.96].some(ex => bar(x, y, ex, 0.46, 0.5, 0.8, 0.035)) ||
      circle(x, y, 0.5, 0.8, 0.06) ||
      rect(x, y, 0.42, 0.85, 0.58, 1.0),
    gap: (x, y, n) => {
      if (y > 0.5) {
        return false;
      }
      const t = Math.max(0, 1 - ((y - 0.56) / 0.54) ** 2);
      return [-0.4, 0, 0.4].some(k => Math.abs(x - 0.5 - k * Math.sqrt(t) * 0.5) <= G(n) / 2) || Math.abs(y - 0.22) <= G(n) / 2;
    },
  },

  burger: {
    fill: (x, y) =>
      (ellipse(x, y, 0.5, 0.36, 0.47, 0.3) && y < 0.37) ||
      (y >= 0.37 && y <= 0.45 + 0.02 * Math.sin(x * 30) && x > 0.02 && x < 0.98) ||
      rect(x, y, 0.04, 0.46, 0.96, 0.62) ||
      (ellipse(x, y, 0.5, 0.64, 0.45, 0.2) && y > 0.63),
    gap: (x, y, n) =>
      Math.abs(y - 0.37) <= G(n) / 2 ||
      Math.abs(y - 0.47) <= G(n) / 2 ||
      Math.abs(y - 0.63) <= G(n) / 2 ||
      [[0.3, 0.2], [0.5, 0.14], [0.7, 0.2], [0.4, 0.28], [0.6, 0.28]].some(([cx, cy]) => ellipse(x, y, cx, cy, 0.03, 0.02)),
    flow: 'horizontal',
  },

  watermelon: {
    fill: (x, y) => circle(x, y, 0.5, 0.06, 0.7) && y > 0.14,
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        ringLine(x, y, n, 0.62, 0.5, 0.06) ||
        ringLine(x, y, n, 0.55, 0.5, 0.06) ||
        [[0.22, 0.3], [0.38, 0.4], [0.16, 0.48], [0.3, 0.58], [0.44, 0.66], [0.26, 0.74]].some(([cx, cy]) => ellipse(mx, y, cx, cy, 0.022, 0.035)) ||
        Math.abs(y - 0.15) <= G(n) / 2
      );
    },
  },

  pineapple: {
    fill: (x, y) =>
      ellipse(x, y, 0.5, 0.66, 0.3, 0.33) ||
      poly(x, y, [[0.46, 0.38], [0.28, 0.02], [0.4, 0.14], [0.5, 0.0], [0.6, 0.14], [0.72, 0.02], [0.54, 0.38]]) ||
      poly(x, y, [[0.44, 0.38], [0.14, 0.14], [0.4, 0.28]]) ||
      poly(x, y, [[0.56, 0.38], [0.86, 0.14], [0.6, 0.28]]),
    gap: (x, y, n) =>
      Math.abs(y - 0.36) <= G(n) / 2 ||
      (y > 0.37 && (Math.abs((((x - 0.5 + y) * n) / 4 + 10) % 1) < 0.08 || Math.abs((((0.5 - x + y) * n) / 4 + 10) % 1) < 0.08)),
  },

  cherries: {
    fill: (x, y) =>
      circle(x, y, 0.26, 0.74, 0.25) ||
      circle(x, y, 0.72, 0.78, 0.22) ||
      bar(x, y, 0.3, 0.52, 0.6, 0.08, 0.08) ||
      bar(x, y, 0.7, 0.58, 0.6, 0.08, 0.08) ||
      ellipse(x, y, 0.76, 0.14, 0.17, 0.08, -0.3),
    gap: (x, y, n) => ringLine(x, y, n, 0.1, 0.24, 0.7) && x < 0.26 && y < 0.72,
  },

  coffee: {
    fill: (x, y) => {
      const hr = polar(x, y, 0.76, 0.56).r;
      return (
        poly(x, y, [[0.08, 0.38], [0.74, 0.38], [0.66, 0.86], [0.16, 0.86]]) ||
        (x > 0.7 && hr >= 0.09 && hr <= 0.17) ||
        ellipse(x, y, 0.42, 0.9, 0.42, 0.07) ||
        [0.24, 0.41, 0.58].some(cx => lineDist(x, y, [[cx, 0.32], [cx - 0.04, 0.22], [cx + 0.03, 0.12], [cx, 0.02]]) <= 0.03)
      );
    },
    gap: (_x, y, n) => Math.abs(y - 0.45) <= G(n) / 2 || Math.abs(y - 0.87) <= G(n) / 2,
  },

  goblet: {
    fill: (x, y) =>
      (circle(x, y, 0.5, 0.16, 0.4) && y > 0.1) ||
      rect(x, y, 0.45, 0.54, 0.55, 0.88) ||
      ellipse(x, y, 0.5, 0.92, 0.32, 0.07) ||
      ellipse(x, y, 0.5, 0.7, 0.1, 0.04),
    gap: (x, y, n) =>
      Math.abs(y - 0.26) <= G(n) / 2 ||
      ringLine(x, y, n, 0.3, 0.5, 0.16) && y > 0.28 ||
      outlineOf((u, v) => poly(u, v, starPts(0.5, 0.4, 0.09, 0.04, 5)), x, y, n),
  },

  gem: {
    fill: (x, y) => poly(x, y, [[0.2, 0.08], [0.8, 0.08], [1.02, 0.36], [0.5, 1.0], [-0.02, 0.36]]),
    gap: (x, y, n) =>
      Math.abs(y - 0.36) <= G(n) / 2 ||
      bar(x, y, 0.32, 0.36, 0.5, 0.98, G(n)) ||
      bar(x, y, 0.68, 0.36, 0.5, 0.98, G(n)) ||
      bar(x, y, 0.2, 0.08, 0.32, 0.36, G(n)) ||
      bar(x, y, 0.5, 0.08, 0.32, 0.36, G(n)) ||
      bar(x, y, 0.5, 0.08, 0.68, 0.36, G(n)) ||
      bar(x, y, 0.8, 0.08, 0.68, 0.36, G(n)),
  },

  ring: {
    fill: (x, y) =>
      (ellipse(x, y, 0.5, 0.64, 0.44, 0.35) && !ellipse(x, y, 0.5, 0.64, 0.24, 0.17)) ||
      poly(x, y, [[0.32, 0.16], [0.68, 0.16], [0.78, 0.28], [0.5, 0.5], [0.22, 0.28]]) ||
      rect(x, y, 0.4, 0.06, 0.6, 0.16),
    gap: (x, y, n) =>
      Math.abs(y - 0.28) <= G(n) / 2 && Math.abs(x - 0.5) < 0.26 ||
      Math.abs(y - 0.165) <= G(n) / 2 ||
      bar(x, y, 0.4, 0.28, 0.5, 0.48, G(n)) ||
      bar(x, y, 0.6, 0.28, 0.5, 0.48, G(n)) ||
      outlineOf((u, v) => ellipse(u, v, 0.5, 0.64, 0.34, 0.26), x, y, n) && y > 0.4,
  },

  chest: {
    fill: (x, y) => rect(x, y, 0.04, 0.44, 0.96, 0.96) || (ellipse(x, y, 0.5, 0.44, 0.46, 0.3) && y < 0.44),
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        Math.abs(y - 0.45) <= G(n) / 2 ||
        Math.abs(mx - 0.2) <= G(n) / 2 ||
        rect(x, y, 0.43, 0.46, 0.57, 0.6) ||
        [0.68, 0.84].some(k => Math.abs(y - k) <= G(n) / 2 && mx > 0.2) ||
        Math.abs(y - 0.3) <= G(n) / 2 && mx > 0.2
      );
    },
  },

  ship: {
    fill: (x, y) =>
      poly(x, y, [[0.02, 0.64], [0.98, 0.6], [0.84, 0.84], [0.16, 0.86]]) ||
      [0.28, 0.52, 0.76].some(cx =>
        rect(x, y, cx - 0.02, 0.06, cx + 0.02, 0.62) ||
        poly(x, y, [[cx - 0.11, 0.12], [cx + 0.11, 0.12], [cx + 0.13, 0.32], [cx - 0.13, 0.32]]) ||
        poly(x, y, [[cx - 0.13, 0.36], [cx + 0.13, 0.36], [cx + 0.15, 0.56], [cx - 0.15, 0.56]])) ||
      poly(x, y, [[0.54, 0.02], [0.66, 0.05], [0.54, 0.08]]) ||
      rect(x, y, 0.0, 0.9, 1.0, 1.0),
    gap: (x, y, n) =>
      Math.abs(y - 0.72) <= G(n) / 2 ||
      [0.3, 0.5, 0.7].some(cx => circle(x, y, cx, 0.66, 0.025)) ||
      Math.abs(y - 0.95 - 0.02 * Math.sin(x * 22)) <= G(n) / 2,
  },

  treasureMap: {
    fill: FULL,
    gap: (x, y, n) =>
      squareLine(x, y, n, 0.47) ||
      (lineDist(x, y, [[0.1, 0.88], [0.3, 0.7], [0.2, 0.5], [0.44, 0.4], [0.6, 0.56], [0.76, 0.3], [0.82, 0.18]]) <= G(n) / 2 &&
        Math.floor((x + y) * n * 0.5) % 2 === 0) ||
      bar(x, y, 0.78, 0.08, 0.9, 0.2, G(n)) ||
      bar(x, y, 0.9, 0.08, 0.78, 0.2, G(n)) ||
      outlineOf((u, v) => ellipse(u, v, 0.28, 0.26, 0.16, 0.1), x, y, n) ||
      outlineOf((u, v) => ellipse(u, v, 0.7, 0.76, 0.18, 0.12), x, y, n) ||
      outlineOf((u, v) => poly(u, v, starPts(0.14, 0.14, 0.08, 0.03, 4)), x, y, n),
  },

  unicorn: {
    fill: (x, y) =>
      poly(x, y, [[0.2, 1.0], [0.24, 0.66], [0.3, 0.42], [0.42, 0.28], [0.56, 0.22], [0.7, 0.3], [0.94, 0.48], [0.96, 0.58], [0.86, 0.62], [0.66, 0.54], [0.58, 0.66], [0.62, 1.0]]) ||
      poly(x, y, [[0.5, 0.26], [0.6, 0.22], [0.78, 0.0]]) ||
      poly(x, y, [[0.4, 0.3], [0.36, 0.12], [0.48, 0.24]]) ||
      poly(x, y, [[0.3, 0.42], [0.06, 0.5], [0.16, 0.62], [0.04, 0.74], [0.2, 0.8], [0.24, 0.66]]),
    gap: (x, y, n) =>
      circle(x, y, 0.62, 0.38, 0.03) ||
      circle(x, y, 0.9, 0.54, 0.02) ||
      [0.56, 0.68].some(k => Math.abs(y - k) <= G(n) / 2 && x < 0.26) ||
      lineDist(x, y, [[0.3, 0.44], [0.32, 0.7], [0.28, 0.98]]) <= G(n) / 2 ||
      bar(x, y, 0.58, 0.18, 0.66, 0.16, G(n)),
  },

  wolf: {
    fill: (x, y) =>
      poly(x, y, [[0.26, 1.0], [0.2, 0.7], [0.28, 0.48], [0.42, 0.34], [0.5, 0.04], [0.6, 0.28], [0.66, 0.2], [0.72, 0.34], [0.7, 0.56], [0.8, 0.76], [0.8, 1.0]]) ||
      (circle(x, y, 0.82, 0.18, 0.16) && !circle(x, y, 0.88, 0.14, 0.12)),
    gap: (x, y, n) =>
      circle(x, y, 0.56, 0.36, 0.025) ||
      lineDist(x, y, [[0.5, 0.1], [0.46, 0.3]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.36, 0.54], [0.3, 0.7], [0.36, 0.86]]) <= G(n) / 2 ||
      lineDist(x, y, [[0.64, 0.58], [0.7, 0.74], [0.66, 0.9]]) <= G(n) / 2,
  },

  astronaut: {
    fill: (x, y) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        circle(x, y, 0.5, 0.28, 0.26) ||
        rect(x, y, 0.24, 0.5, 0.76, 0.86) ||
        rect(mx, y, 0.06, 0.52, 0.24, 0.78) ||
        rect(mx, y, 0.28, 0.86, 0.46, 1.0)
      );
    },
    gap: (x, y, n) => {
      const mx = x < 0.5 ? x : 1 - x;
      return (
        outlineOf((u, v) => ellipse(u, v, 0.5, 0.3, 0.18, 0.12), x, y, n) ||
        outlineOf((u, v) => rect(u, v, 0.36, 0.58, 0.64, 0.72), x, y, n) ||
        Math.abs(y - 0.78) <= G(n) / 2 && mx > 0.24 ||
        Math.abs(mx - 0.245) <= G(n) / 2 && y > 0.5 ||
        Math.abs(y - 0.51) <= G(n) / 2
      );
    },
  },

  moonPhases: {
    fill: (x, y) =>
      circle(x, y, 0.5, 0.5, 0.35) ||
      (circle(x, y, 0.14, 0.14, 0.14) && !circle(x, y, 0.21, 0.1, 0.11)) ||
      (circle(x, y, 0.86, 0.14, 0.14) && x > 0.83) ||
      (circle(x, y, 0.14, 0.86, 0.14) && x < 0.17) ||
      (circle(x, y, 0.86, 0.86, 0.14) && !circle(x, y, 0.79, 0.9, 0.11)),
    gap: (x, y, n) =>
      ringLine(x, y, n, 0.07, 0.4, 0.4) ||
      ringLine(x, y, n, 0.05, 0.62, 0.58) ||
      ringLine(x, y, n, 0.04, 0.44, 0.66) ||
      circle(x, y, 0.6, 0.36, 0.025),
  },

  pizza: {
    fill: (x, y) => poly(x, y, [[0.04, 0.06], [0.96, 0.18], [0.42, 0.99]]),
    gap: (x, y, n) =>
      Math.abs(y - 0.13 - (x - 0.04) * 0.13) <= G(n) / 2 ||
      [[0.36, 0.32, 0.07], [0.6, 0.36, 0.06], [0.44, 0.58, 0.06]].some(([cx, cy, s]) => ringLine(x, y, n, s, cx, cy)) ||
      [[0.24, 0.26], [0.72, 0.28], [0.52, 0.46], [0.4, 0.78]].some(([cx, cy]) => circle(x, y, cx, cy, 0.02)),
  },

  zigzag: {
    fill: FULL,
    gap: (x, y, n) => {
      if (squareLine(x, y, n, 0.47)) {
        return true;
      }
      const tri = Math.abs(((Math.abs(x - 0.5) * 6) % 2) - 1);
      return [1, 2, 3, 4, 5].some(k => Math.abs(y - k / 6 - 0.06 * tri) <= G(n) * 0.55);
    },
  },

  wind: {
    fill: FULL,
    gap: (x, y, n) => {
      for (const [cx, cy, r] of SWIRLS) {
        if (circle(x, y, cx, cy, r)) {
          return !spiralAt(x, y, n, cx, cy, 1, 3, 2) || ringLine(x, y, n, r, cx, cy);
        }
      }
      return [0.12, 0.3, 0.5, 0.7, 0.9].some(k => Math.abs(y - k - 0.04 * Math.sin(x * 9 + k * 7)) <= G(n) / 2);
    },
    flow: 'tangent',
  },

  ouroboros: {
    fill: (x, y) => {
      const {r, a} = polar(x, y);
      const t = ((a + Math.PI * 0.75 + 4 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
      const w = 0.04 + 0.08 * Math.min(1, t * 1.4);
      return (
        Math.abs(r - 0.37) <= w ||
        ellipse(x, y, 0.5 + 0.37 * Math.cos(-0.75 * Math.PI), 0.5 + 0.37 * Math.sin(-0.75 * Math.PI), 0.15, 0.11, Math.PI / 4) ||
        poly(x, y, starPts(0.5, 0.5, 0.26, 0.17, 8, 0)) ||
        [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]].some(([cx, cy]) => circle(x, y, cx, cy, 0.14))
      );
    },
    gap: (x, y, n) => {
      const {r, a} = polar(x, y);
      if (r > 0.29 && r < 0.49) {
        for (let i = 0; i < 18; i++) {
          const b = (i * Math.PI) / 9;
          if (Math.abs(Math.sin(a - b)) * r <= G(n) / 2 && Math.cos(a - b) > 0 && Math.abs(r - 0.37) < 0.06) {
            return true;
          }
        }
      }
      return (
        circle(x, y, 0.5 + 0.4 * Math.cos(-0.72 * Math.PI), 0.5 + 0.4 * Math.sin(-0.72 * Math.PI), 0.025) ||
        outlineOf((u, v) => poly(u, v, starPts(0.5, 0.5, 0.14, 0.07, 8, 0)), x, y, n) ||
        [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]].some(([cx, cy]) => ringLine(x, y, n, 0.07, cx, cy))
      );
    },
    flow: 'tangent',
  },
};
Object.assign(P, P4);

// --------------------------------------------------------------------- plan

export const E = 'Easy' as const;
export const M = 'Medium' as const;
export const H = 'Hard' as const;
export const V = 'Very Hard' as const;

export const ROWS: [number, number, Tier, string, string, Symmetry][] = [
  // 3-10: introduce the visual language
  [3, 10, E, 'Open Field', 'field', 'none'],
  [4, 12, E, 'Diamond', 'diamond', 'mirror'],
  [5, 12, M, 'Heart', 'heart', 'mirror'],
  [6, 15, H, 'Lightning', 'bolt', 'none'],
  [7, 12, M, 'Cross', 'plus', 'rot4'],
  [8, 10, E, 'Up Arrow', 'arrowUp', 'mirror'],
  [9, 15, H, 'Spiral', 'spiral', 'none'],
  [10, 18, V, 'Crown', 'crown', 'mirror'],
  // 11-20: larger grids, more structure
  [11, 15, M, 'X', 'xcross', 'rot4'],
  [12, 18, H, 'Flower', 'flower', 'partial'],
  [13, 15, M, 'Hourglass', 'hourglass', 'partial'],
  [14, 20, H, 'Butterfly', 'butterfly', 'mirror'],
  [15, 18, V, 'Nested Squares', 'squares', 'rot4'],
  [16, 15, M, 'Star', 'star5', 'mirror'],
  [17, 20, H, 'Pine Tree', 'tree', 'partial'],
  [18, 18, M, 'Four Islands', 'clusters', 'none'],
  [19, 22, V, 'Thunder', 'storm', 'none'],
  [20, 20, H, 'Mandala', 'mandala', 'rot4'],
  // 21-30: 20 / 25 / 30 arrive; art patterns take over
  [21, 20, M, 'Whale', 'whale', 'none'],
  [22, 25, H, 'Double Spiral', 'spiral2', 'rot2'],
  [23, 22, V, 'Dragon', 'dragon', 'none'],
  [24, 18, M, 'Cat', 'cat', 'mirror'],
  [25, 25, V, 'Rose Mandala', 'mandalaL', 'rot4'],
  [26, 20, H, 'Nested Diamonds', 'diamonds', 'rot4'],
  [27, 30, H, 'Heart in Heart', 'hearts', 'mirror'],
  [28, 22, M, 'Owl', 'owl', 'mirror'],
  [29, 25, V, 'Coiled Snake', 'coil', 'none'],
  [30, 30, V, 'Star Seal', 'starRing', 'partial'],
  // 31-40: large, dense, deep
  [31, 25, H, 'Monarch', 'butterflyL', 'mirror'],
  [32, 28, V, 'Galaxy', 'galaxy', 'none'],
  [33, 22, H, 'Chevrons', 'chevrons', 'partial'],
  [34, 30, V, 'Great Oak', 'treeL', 'partial'],
  [35, 20, H, 'Celtic Cross', 'celtic', 'rot4'],
  [36, 25, V, 'Broken Mandala', 'brokenMandala', 'none'],
  [37, 25, H, 'Lotus', 'flower8', 'rot4'],
  [38, 28, V, 'Dragon II', 'dragon', 'none'],
  [39, 22, H, 'Jewelled Crown', 'crownL', 'mirror'],
  [40, 30, V, 'Twin Vortex', 'spiralFrame', 'rot2'],
  // 41-50: the showpieces, with a couple of relief levels
  [41, 25, V, 'Compass Star', 'compass', 'rot4'],
  [42, 30, H, 'Four Hearts', 'fourHearts', 'rot4'],
  [43, 22, M, 'Argyle', 'argyle', 'mirror'],
  [44, 28, V, 'Eagle', 'eagle', 'mirror'],
  [45, 30, V, 'Grand Mandala', 'mandalaXL', 'rot4'],
  [46, 25, H, 'Storm Cloud', 'cloudStorm', 'none'],
  [47, 30, V, 'Emperor Butterfly', 'butterflyXL', 'partial'],
  [48, 20, M, 'Rising Arrow', 'bigArrow', 'mirror'],
  [49, 28, V, 'Nested Worlds', 'nested', 'rot4'],
  [50, 30, V, 'Phoenix', 'phoenix', 'mirror'],
  // 51-60: large boards from the start, new picture families
  [51, 25, H, 'Sunburst', 'sun', 'rot4'],
  [52, 28, V, 'Spider Web', 'web', 'rot4'],
  [53, 20, M, 'Anchor', 'anchor', 'mirror'],
  [54, 30, V, 'Labyrinth', 'labyrinth', 'rot2'],
  [55, 22, H, 'Rocket', 'rocket', 'mirror'],
  [56, 18, E, 'Tulip', 'tulip', 'mirror'],
  [57, 30, V, 'Octopus', 'octopus', 'mirror'],
  [58, 25, H, 'Yin Yang', 'yinyang', 'rot2'],
  [59, 28, V, 'Triskele', 'triskele', 'none'],
  [60, 30, V, 'Pinwheel', 'pinwheel', 'rot4'],
  // 61-70
  [61, 22, M, 'Angelfish', 'fish2', 'none'],
  [62, 25, H, 'Maple Leaf', 'maple', 'mirror'],
  [63, 30, V, 'Bullseye', 'target', 'partial'],
  [64, 20, H, 'Keyhole', 'keyhole', 'mirror'],
  [65, 28, V, 'Sea Turtle', 'turtle', 'mirror'],
  [66, 15, E, 'Waves', 'waves', 'none'],
  [67, 30, V, 'Lighthouse', 'lighthouse', 'partial'],
  [68, 25, H, 'Four-Leaf Clover', 'clover', 'rot4'],
  [69, 28, V, 'Fox', 'fox', 'mirror'],
  [70, 30, V, 'Quad Spiral', 'spiral4', 'rot4'],
  // 71-80
  [71, 22, M, 'Shield', 'shield', 'mirror'],
  [72, 25, V, 'Jellyfish', 'jellyfish', 'partial'],
  [73, 30, H, 'Infinity', 'infinity', 'rot2'],
  [74, 28, V, 'Bat', 'bat', 'mirror'],
  [75, 30, V, 'Sunflower', 'sunflower', 'partial'],
  [76, 20, M, 'Mushroom', 'mushroom', 'mirror'],
  [77, 25, H, 'Honeycomb', 'hive', 'partial'],
  [78, 30, V, 'Seahorse', 'seahorse', 'none'],
  [79, 28, H, 'Trophy', 'trophy', 'mirror'],
  [80, 30, V, 'Kaleidoscope', 'kaleido', 'rot4'],
  // 81-90
  [81, 18, E, 'Pyramid', 'pyramid', 'mirror'],
  [82, 30, V, 'Twin Serpents', 'serpents', 'none'],
  [83, 25, H, 'Bee', 'bee', 'mirror'],
  [84, 28, V, 'Castle', 'castle', 'mirror'],
  [85, 30, V, 'Maltese Cross', 'maltese', 'rot4'],
  [86, 20, M, 'Moon & Stars', 'moon', 'none'],
  [87, 30, H, 'Penguin', 'penguin', 'mirror'],
  [88, 28, V, 'Celtic Knot', 'knot', 'rot4'],
  [89, 25, V, 'Sword & Shield', 'swords', 'mirror'],
  [90, 30, V, 'Tiger', 'tiger', 'mirror'],
  // 91-100: the second showcase run
  [91, 22, M, 'Sailboat', 'sailboat', 'none'],
  [92, 30, V, 'Stained Glass', 'stained', 'none'],
  [93, 28, H, 'Rabbit', 'rabbit', 'mirror'],
  [94, 30, V, 'Rose Window', 'roseWindow', 'rot4'],
  [95, 25, H, 'Cactus', 'cactus', 'none'],
  [96, 30, V, 'Mountain Range', 'mountains', 'none'],
  [97, 20, M, 'Hot Air Balloon', 'balloon', 'mirror'],
  [98, 30, V, 'Lion', 'lion', 'mirror'],
  [99, 28, V, 'Twin Galaxies', 'twinGalaxy', 'rot2'],
  [100, 30, V, 'Royal Seal', 'royalSeal', 'rot4'],
  // 101-110
  [101, 25, H, "Ship's Wheel", 'wheel', 'rot4'],
  [102, 30, V, 'Peacock', 'peacock', 'mirror'],
  [103, 20, M, 'Bell', 'bell', 'mirror'],
  [104, 28, V, 'Hurricane', 'hurricane', 'none'],
  [105, 30, V, 'Gear Works', 'gear', 'rot4'],
  [106, 18, E, 'Apple', 'apple', 'mirror'],
  [107, 25, H, 'Strawberry', 'strawberry', 'mirror'],
  [108, 30, V, 'Koi Pond', 'koi', 'rot2'],
  [109, 22, M, 'Cottage', 'house', 'mirror'],
  [110, 30, V, 'Aztec Sun', 'aztec', 'rot4'],
  // 111-120
  [111, 25, H, 'Crab', 'crab', 'mirror'],
  [112, 28, V, 'Elephant', 'elephant', 'none'],
  [113, 20, M, 'Umbrella', 'umbrella', 'mirror'],
  [114, 30, V, 'Star Mosaic', 'mosaic', 'rot4'],
  [115, 25, H, 'Saturn', 'saturn', 'rot2'],
  [116, 30, V, 'Circuit Board', 'circuit', 'none'],
  [117, 15, E, 'Gift Box', 'gift', 'mirror'],
  [118, 28, H, 'Robot', 'robot', 'mirror'],
  [119, 30, V, 'Nautilus', 'nautilus', 'none'],
  [120, 25, V, 'Spider', 'spider', 'mirror'],
  // 121-130
  [121, 22, M, 'Ice Cream', 'icecream', 'mirror'],
  [122, 30, H, 'Globe', 'globe', 'mirror'],
  [123, 28, V, 'Atom', 'atom', 'rot2'],
  [124, 25, H, 'Ladybug', 'ladybug', 'mirror'],
  [125, 30, V, 'City Skyline', 'skyline', 'none'],
  [126, 20, M, 'Jack-o-Lantern', 'pumpkin', 'mirror'],
  [127, 30, V, 'Pagoda', 'pagoda', 'mirror'],
  [128, 25, H, 'Dragonfly', 'dragonfly', 'mirror'],
  [129, 28, V, 'Double Helix', 'helix', 'rot2'],
  [130, 30, V, 'Tiki Mask', 'tiki', 'mirror'],
  // 131-140
  [131, 18, E, 'Rainbow', 'rainbow', 'mirror'],
  [132, 25, H, 'Volcano', 'volcano', 'none'],
  [133, 30, V, 'Chain Links', 'chain', 'rot2'],
  [134, 28, H, 'Panda', 'panda', 'mirror'],
  [135, 30, V, 'Greek Temple', 'temple', 'mirror'],
  [136, 22, M, 'Cupcake', 'cupcake', 'mirror'],
  [137, 30, V, 'Fingerprint', 'fingerprint', 'none'],
  [138, 25, H, 'Padlock', 'padlock', 'mirror'],
  [139, 28, V, 'Sierpinski', 'sierpinski', 'mirror'],
  [140, 30, V, 'Windmill', 'windmill', 'partial'],
  // 141-150: third showcase run
  [141, 22, M, 'Ghost', 'ghost', 'mirror'],
  [142, 30, H, 'Swan', 'swan', 'none'],
  [143, 28, V, 'Skull', 'skull', 'mirror'],
  [144, 25, H, 'Frog', 'frog', 'mirror'],
  [145, 30, V, 'Dolphin Pair', 'dolphins', 'rot2'],
  [146, 20, M, 'Music Note', 'note', 'none'],
  [147, 30, V, 'Pentagram Seal', 'pentagram', 'mirror'],
  [148, 28, H, 'Snowman', 'snowman', 'mirror'],
  [149, 30, V, 'Floor Plan', 'rooms', 'none'],
  [150, 30, V, 'Grand Clockwork', 'clockwork', 'rot4'],
  // 151-160: fewer breathers from here on
  [151, 25, H, 'Hexagram', 'hexagram', 'mirror'],
  [152, 30, V, 'Scorpion', 'scorpion', 'none'],
  [153, 22, M, 'Teapot', 'teapot', 'none'],
  [154, 28, V, 'Airplane', 'airplane', 'mirror'],
  [155, 30, V, 'Steam Train', 'train', 'none'],
  [156, 20, M, 'Brick Wall', 'brick', 'none'],
  [157, 28, H, 'Guitar', 'guitar', 'partial'],
  [158, 30, V, 'Totem Pole', 'totem', 'mirror'],
  [159, 25, H, 'Bonsai', 'bonsai', 'none'],
  [160, 30, V, 'Rune Circle', 'runes', 'rot4'],
  // 161-170
  [161, 25, H, 'All-Seeing Eye', 'eye', 'mirror'],
  [162, 28, V, 'Open Hand', 'hand', 'none'],
  [163, 22, M, 'Key', 'key', 'none'],
  [164, 25, H, 'Candle', 'candle', 'mirror'],
  [165, 30, V, 'Paper Lantern', 'lantern', 'mirror'],
  [166, 18, E, 'Kite', 'kite', 'mirror'],
  [167, 28, V, 'Raindrops', 'raindrops', 'none'],
  [168, 25, H, 'Pine Cone', 'pinecone', 'mirror'],
  [169, 30, V, 'Scarab', 'scarab', 'mirror'],
  [170, 28, V, 'Chess Knight', 'knight', 'none'],
  // 171-180
  [171, 30, V, 'Checkerboard', 'checker', 'rot4'],
  [172, 25, H, 'Nested Hexagons', 'nestedHex', 'mirror'],
  [173, 30, V, 'Octagon Tiles', 'octagons', 'rot4'],
  [174, 22, M, 'Car', 'car', 'none'],
  [175, 28, V, 'Basket Weave', 'weave', 'mirror'],
  [176, 30, V, 'Ripples', 'ripples', 'none'],
  [177, 25, H, 'Tornado', 'tornado', 'none'],
  [178, 28, V, 'Comet', 'comet', 'none'],
  [179, 20, M, 'UFO', 'ufo', 'mirror'],
  [180, 30, V, 'Solar System', 'solar', 'none'],
  // 181-190
  [181, 25, H, 'Parachute', 'parachute', 'mirror'],
  [182, 20, M, 'Burger', 'burger', 'mirror'],
  [183, 28, H, 'Watermelon', 'watermelon', 'mirror'],
  [184, 30, V, 'Pineapple', 'pineapple', 'mirror'],
  [185, 18, E, 'Cherries', 'cherries', 'none'],
  [186, 25, H, 'Coffee Cup', 'coffee', 'none'],
  [187, 28, V, 'Goblet', 'goblet', 'mirror'],
  [188, 30, V, 'Diamond Gem', 'gem', 'mirror'],
  [189, 22, M, 'Ring', 'ring', 'mirror'],
  [190, 30, V, 'Treasure Chest', 'chest', 'mirror'],
  // 191-200: fourth showcase run
  [191, 30, V, 'Pirate Ship', 'ship', 'none'],
  [192, 28, V, 'Treasure Map', 'treasureMap', 'none'],
  [193, 30, V, 'Unicorn', 'unicorn', 'none'],
  [194, 28, H, 'Wolf & Moon', 'wolf', 'none'],
  [195, 30, V, 'Astronaut', 'astronaut', 'mirror'],
  [196, 22, M, 'Moon Phases', 'moonPhases', 'none'],
  [197, 25, H, 'Pizza Slice', 'pizza', 'none'],
  [198, 30, V, 'Zigzag Rug', 'zigzag', 'mirror'],
  [199, 28, V, 'Wind Swirls', 'wind', 'none'],
  [200, 30, V, 'Ouroboros', 'ouroboros', 'none'],
];

export const MOCK_PLAN: MockPlan[] = ROWS.map(([id, grid, tier, title, key, symmetry]) => {
  const pattern = P[key];
  if (!pattern) {
    throw new Error(`level ${id}: unknown pattern ${key}`);
  }
  return {id, grid, tier, title, symmetry, pattern};
});

// ------------------------------------------------------------- rasterising

/** 4x4 supersampled mask: filled when half the cell is fill and under a third is gap. */
export function rasterisePattern(p: Pattern, n: number, strictGap = false): boolean[][] {
  const SS = 4;
  const out: boolean[][] = [];
  for (let row = 0; row < n; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < n; col++) {
      let fill = 0;
      let gap = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (col + (sx + 0.5) / SS) / n;
          const y = (row + (sy + 0.5) / SS) / n;
          if (p.fill(x, y, n)) {
            fill++;
          }
          if (p.gap && p.gap(x, y, n)) {
            gap++;
          }
        }
      }
      // strictGap (levels 51+): a channel sitting exactly on a cell border takes one row,
      // not both. Levels 3-50 keep the original rule so their approved boards are unchanged.
      const g = gap / (SS * SS);
      line.push(fill / (SS * SS) >= 0.45 && (strictGap ? g <= 0.5 : g < 0.5));
    }
    out.push(line);
  }
  return out;
}

/** Preferred axis at a cell centre, or null. */
export function flowAxis(flow: Flow | undefined, x: number, y: number, n: number): 'h' | 'v' | null {
  const u = (x + 0.5) / n - 0.5;
  const v = (y + 0.5) / n - 0.5;
  switch (flow) {
    case 'tangent':
      // tangent of a circle is perpendicular to the radius
      return Math.abs(u) > Math.abs(v) ? 'v' : 'h';
    case 'square':
      return Math.abs(u) > Math.abs(v) ? 'v' : 'h';
    case 'horizontal':
      return 'h';
    case 'vertical':
      return 'v';
    default:
      return null;
  }
}
