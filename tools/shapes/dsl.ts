/**
 * Shape authoring DSL.
 *
 * §8.1 asks for hand-authored binary masks per shape per grid size, stored as
 * reviewable strings. Authoring 60 shapes x 10 grid sizes as literal ASCII is both
 * enormous and fragile, so shapes are instead composed from vector primitives in a
 * normalised [0,1] square and rasterised per grid size. The rasterised masks are
 * written out as ASCII to tools/shapes/masks.generated.ts, which is committed and is
 * the artifact a human reviews alongside the contact sheet (§8.6).
 *
 * All geometry here is original. No traced third-party artwork (§4.5).
 */

export type Primitive =
  | {k: 'circle'; cx: number; cy: number; r: number}
  | {k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number}
  | {k: 'rect'; x: number; y: number; w: number; h: number}
  | {k: 'poly'; pts: [number, number][]}
  | {k: 'bar'; x1: number; y1: number; x2: number; y2: number; t: number};

export interface ShapeOp {
  add: boolean;
  prim: Primitive;
}

export const add = (prim: Primitive): ShapeOp => ({add: true, prim});
export const cut = (prim: Primitive): ShapeOp => ({add: false, prim});

export const circle = (cx: number, cy: number, r: number): Primitive => ({
  k: 'circle',
  cx,
  cy,
  r,
});
export const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
): Primitive => ({k: 'ellipse', cx, cy, rx, ry, rot});
export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
): Primitive => ({
  k: 'rect',
  x,
  y,
  w,
  h,
});
export const poly = (pts: [number, number][]): Primitive => ({k: 'poly', pts});
export const bar = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): Primitive => ({k: 'bar', x1, y1, x2, y2, t});

function insidePrimitive(p: Primitive, x: number, y: number): boolean {
  switch (p.k) {
    case 'circle': {
      const dx = x - p.cx;
      const dy = y - p.cy;
      return dx * dx + dy * dy <= p.r * p.r;
    }
    case 'ellipse': {
      const rot = p.rot ?? 0;
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const dx = x - p.cx;
      const dy = y - p.cy;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      return (rx * rx) / (p.rx * p.rx) + (ry * ry) / (p.ry * p.ry) <= 1;
    }
    case 'rect':
      return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
    case 'poly': {
      let inside = false;
      const pts = p.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }
    case 'bar': {
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((x - p.x1) * dx + (y - p.y1) * dy) / lenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = p.x1 + t * dx - x;
      const py = p.y1 + t * dy - y;
      return px * px + py * py <= (p.t / 2) * (p.t / 2);
    }
  }
}

function insideShape(ops: readonly ShapeOp[], x: number, y: number): boolean {
  let inside = false;
  for (const op of ops) {
    if (insidePrimitive(op.prim, x, y)) {
      inside = op.add;
    }
  }
  return inside;
}

export type Mask = boolean[][];

/**
 * Rasterise to a gridSize x gridSize mask with 3x3 supersampling; a cell is filled
 * when at least `threshold` of its area is covered. Lower thresholds fatten the
 * silhouette, which is how density is tuned per band before fitMaskDensity runs.
 */
export function rasterise(
  ops: readonly ShapeOp[],
  gridSize: number,
  threshold = 0.5,
): Mask {
  const SS = 3;
  const mask: Mask = [];
  for (let row = 0; row < gridSize; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < gridSize; col++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (col + (sx + 0.5) / SS) / gridSize;
          const y = (row + (sy + 0.5) / SS) / gridSize;
          if (insideShape(ops, x, y)) {
            hits++;
          }
        }
      }
      line.push(hits / (SS * SS) >= threshold);
    }
    mask.push(line);
  }
  return mask;
}

export const maskToStrings = (mask: Mask): string[] =>
  mask.map(row => row.map(v => (v ? '#' : '.')).join(''));

export const stringsToMask = (rows: readonly string[]): Mask =>
  rows.map(row => row.split('').map(ch => ch === '#'));

export const countCells = (mask: Mask): number =>
  mask.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
