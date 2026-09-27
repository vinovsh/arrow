/**
 * Builds the mock designs for levels 3-50 as data, for render.py to draw.
 *
 *   node --import ./tools/register.mjs tools/mock/buildMocks.ts [--only 12] [--from 51 --to 100]
 *
 * Writes mock/data/level_NNN.json. Touches nothing the game reads.
 *
 * Every mock is a real board: paths are carved inside the pattern's mask, grouped by
 * the level's symmetry, and pointed by peeling groups off one at a time so that each
 * corridor is clear of what is still on the board — so the peel order is a solve order
 * and the board is solvable by construction. The shipped LevelValidator then solves it
 * again independently and supplies the difficulty signals printed on each card.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {ArrowPath, Direction, GridPoint} from '../../src/game/models/types.ts';
import {DIR_VECTORS, MAX_PATH_CELLS} from '../../src/game/models/types.ts';
import {analyse, validate} from '../../src/game/engine/LevelValidator.ts';
import {createRng, hashSeed} from '../../src/utils/rng.ts';
import type {Rng} from '../../src/utils/rng.ts';
import {MOCK_PLAN as PLAN_3_200, flowAxis, rasterisePattern} from './patterns.ts';
import {PLAN_201} from './plan201.ts';

const MOCK_PLAN = [...PLAN_3_200, ...PLAN_201];
import type {MockPlan, Tier} from './patterns.ts';

const OUT = join(import.meta.dirname, '..', '..', 'mock', 'data');

interface TierStyle {
  minLen: number;
  maxLen: number;
  /** Weight of carrying straight on vs. turning (turn = 1). */
  straight: number;
  maxTurns: number;
  /** 0 = point everything at the nearest clear edge, 1 = through as much as possible. */
  hardness: number;
}

const STYLE: Record<Tier, TierStyle> = {
  Easy: {minLen: 2, maxLen: 6, straight: 4, maxTurns: 2, hardness: 0.15},
  Medium: {minLen: 2, maxLen: 9, straight: 2.4, maxTurns: 4, hardness: 0.55},
  Hard: {minLen: 3, maxLen: 12, straight: 1.6, maxTurns: 6, hardness: 0.85},
  'Very Hard': {minLen: 3, maxLen: MAX_PATH_CELLS, straight: 1.2, maxTurns: 8, hardness: 1},
};

/**
 * Levels 201+ only. Boards past 30 cells need longer paths to stay under the engine's
 * 254-arrow cap, and 401+ is where the user asked for the most complex boards: twistier
 * paths with more turns allowed. Earlier levels keep STYLE exactly as approved.
 */
function styleFor(plan: MockPlan): TierStyle {
  const base = STYLE[plan.tier];
  if (plan.id <= 200) {
    return base;
  }
  const big = plan.grid >= 32;
  const late = plan.id > 400 && plan.tier === 'Very Hard';
  return {
    ...base,
    minLen: big ? Math.max(base.minLen, 4) : base.minLen,
    maxLen: big ? MAX_PATH_CELLS : base.maxLen,
    straight: late ? 1.0 : base.straight,
    maxTurns: late ? 10 : base.maxTurns,
  };
}

// ------------------------------------------------------------ symmetry maps

type Xf = (p: GridPoint) => GridPoint;
type Df = (d: Direction) => Direction;

interface SymmetrySpec {
  /** Transforms producing the other members of a group (identity excluded). */
  maps: {cell: Xf; dir: Df}[];
  /** Cells carved freely; everything else is an image of these. */
  domain: (p: GridPoint) => boolean;
  /** Cells that are their own image and must be carved separately, or null. */
  fixed: ((p: GridPoint) => boolean) | null;
  /** Cells that can never be used (a lone centre cell). */
  banned: (p: GridPoint) => boolean;
}

const mirrorDir: Df = d => (d === 'L' ? 'R' : d === 'R' ? 'L' : d);
const rotDir: Df = d => ({U: 'R', R: 'D', D: 'L', L: 'U'} as const)[d];

function symmetryFor(plan: MockPlan): SymmetrySpec {
  const n = plan.grid;
  const odd = n % 2 === 1;
  const c = (n - 1) / 2;
  const h = Math.floor(n / 2);
  const none: SymmetrySpec = {maps: [], domain: () => true, fixed: null, banned: () => false};
  switch (plan.symmetry) {
    case 'mirror':
      return {
        maps: [{cell: p => ({x: n - 1 - p.x, y: p.y}), dir: mirrorDir}],
        domain: p => p.x < h,
        fixed: odd ? p => p.x === c : null,
        banned: () => false,
      };
    case 'rot4': {
      const r1: Xf = p => ({x: n - 1 - p.y, y: p.x});
      return {
        maps: [
          {cell: r1, dir: rotDir},
          {cell: p => r1(r1(p)), dir: d => rotDir(rotDir(d))},
          {cell: p => r1(r1(r1(p))), dir: d => rotDir(rotDir(rotDir(d)))},
        ],
        domain: odd ? p => (p.x < c && p.y < c) || (p.y === c && p.x < c) : p => p.x < h && p.y < h,
        fixed: null,
        banned: odd ? p => p.x === c && p.y === c : () => false,
      };
    }
    case 'rot2':
      return {
        maps: [{cell: p => ({x: n - 1 - p.x, y: n - 1 - p.y}), dir: d => rotDir(rotDir(d))}],
        domain: odd ? p => p.y < c || (p.y === c && p.x < c) : p => p.y < h,
        fixed: null,
        banned: odd ? p => p.x === c && p.y === c : () => false,
      };
    default:
      return none;
  }
}

// ------------------------------------------------------------------- mask

function buildMask(plan: MockPlan, sym: SymmetrySpec): boolean[][] {
  const n = plan.grid;
  const raw = rasterisePattern(plan.pattern, n, plan.id > 50);
  const mask = raw.map(r => r.slice());
  // Force exact symmetry: every image of a domain cell takes the domain cell's value.
  if (sym.maps.length > 0) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const p = {x, y};
        if (sym.banned(p)) {
          mask[y][x] = false;
          continue;
        }
        if (sym.domain(p)) {
          for (const m of sym.maps) {
            const q = m.cell(p);
            mask[q.y][q.x] = raw[y][x];
          }
        }
      }
    }
  }
  // Drop crumbs: components too small to hold a real arrow.
  const seen = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!mask[y][x] || seen[y * n + x]) {
        continue;
      }
      const comp: GridPoint[] = [];
      const stack = [{x, y}];
      seen[y * n + x] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        comp.push(p);
        for (const d of Object.values(DIR_VECTORS)) {
          const q = {x: p.x + d.x, y: p.y + d.y};
          if (q.x >= 0 && q.y >= 0 && q.x < n && q.y < n && mask[q.y][q.x] && !seen[q.y * n + q.x]) {
            seen[q.y * n + q.x] = 1;
            stack.push(q);
          }
        }
      }
      if (comp.length < 4) {
        for (const p of comp) {
          mask[p.y][p.x] = false;
        }
      }
    }
  }
  return mask;
}

// ------------------------------------------------------------------ carving

function drawLength(style: TierStyle, rng: Rng): number {
  // Skewed towards the upper-middle of the range: long snakes, a few stubs.
  const t = (rng.next() + rng.next() + rng.next()) / 3;
  return Math.round(style.minLen + t * (style.maxLen - style.minLen) * 1.15);
}

/**
 * Cover `cells` with paths. Each path starts from the most constrained free cell and
 * grows by a weighted walk: straight vs. turn from the tier, a Warnsdorff bias towards
 * constrained neighbours so no pockets are stranded, and a flow bias so runs follow the
 * picture's rings.
 */
function carve(
  n: number,
  cells: GridPoint[],
  style: TierStyle,
  plan: MockPlan,
  rng: Rng,
  axisOnly: 'v' | null = null,
): GridPoint[][] {
  const free = new Uint8Array(n * n);
  for (const p of cells) {
    free[p.y * n + p.x] = 1;
  }
  const owner = new Int32Array(n * n).fill(-1);
  const paths: GridPoint[][] = [];
  const dirs = Object.values(DIR_VECTORS);
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const deg = (x: number, y: number) => {
    let d = 0;
    for (const v of dirs) {
      if (inb(x + v.x, y + v.y) && free[(y + v.y) * n + x + v.x]) {
        d++;
      }
    }
    return d;
  };

  let remaining = cells.length;
  while (remaining > 0) {
    // most constrained free cell, random tie-break
    let best: GridPoint[] = [];
    let bestDeg = 99;
    for (const p of cells) {
      if (!free[p.y * n + p.x]) {
        continue;
      }
      const d = deg(p.x, p.y);
      if (d < bestDeg) {
        bestDeg = d;
        best = [p];
      } else if (d === bestDeg) {
        best.push(p);
      }
    }
    const start = rng.pick(best);
    const path = [start];
    free[start.y * n + start.x] = 0;
    remaining--;
    const target = Math.max(1, Math.min(MAX_PATH_CELLS, drawLength(style, rng)));
    let prev: GridPoint | null = null;
    let turns = 0;
    while (path.length < target) {
      const head = path[path.length - 1];
      const options: {p: GridPoint; w: number; turn: boolean}[] = [];
      for (const v of dirs) {
        if (axisOnly === 'v' && v.x !== 0) {
          continue;
        }
        const q = {x: head.x + v.x, y: head.y + v.y};
        if (!inb(q.x, q.y) || !free[q.y * n + q.x]) {
          continue;
        }
        const straight = prev === null || (v.x === prev.x && v.y === prev.y);
        if (!straight && turns >= style.maxTurns) {
          continue;
        }
        let w = straight ? style.straight : 1;
        w *= 1 / Math.pow(1 + deg(q.x, q.y), 1.4);
        const axis = flowAxis(plan.pattern.flow, q.x, q.y, n);
        if (axis && (axis === 'h') === (v.y === 0)) {
          w *= 3;
        }
        options.push({p: q, w, turn: !straight});
      }
      if (options.length === 0) {
        break;
      }
      let roll = rng.next() * options.reduce((s, o) => s + o.w, 0);
      let chosen = options[0];
      for (const o of options) {
        roll -= o.w;
        if (roll <= 0) {
          chosen = o;
          break;
        }
      }
      if (chosen.turn) {
        turns++;
      }
      prev = {x: chosen.p.x - head.x, y: chosen.p.y - head.y};
      path.push(chosen.p);
      free[chosen.p.y * n + chosen.p.x] = 0;
      remaining--;
    }
    for (const p of path) {
      owner[p.y * n + p.x] = paths.length;
    }
    paths.push(path);
  }

  // Fold stubs into a neighbouring path's end where there is room.
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p.length !== 1) {
      continue;
    }
    const c = p[0];
    for (const v of dirs) {
      const q = {x: c.x + v.x, y: c.y + v.y};
      if (!inb(q.x, q.y)) {
        continue;
      }
      const j = owner[q.y * n + q.x];
      if (j < 0 || j === i || paths[j].length === 0 || paths[j].length >= MAX_PATH_CELLS) {
        continue;
      }
      const other = paths[j];
      if (axisOnly === 'v' && v.x !== 0) {
        continue;
      }
      const tail = other[0];
      const head = other[other.length - 1];
      if (tail.x === q.x && tail.y === q.y) {
        other.unshift(c);
      } else if (head.x === q.x && head.y === q.y) {
        other.push(c);
      } else {
        continue;
      }
      owner[c.y * n + c.x] = j;
      paths[i] = [];
      break;
    }
  }
  return paths.filter(p => p.length > 0);
}

// ------------------------------------------------------------- orientation

interface Group {
  /** Member paths as cell lists in carve order; member 0 is the base. */
  members: GridPoint[][];
  /** Per option, per member: oriented cells and direction. */
  options: {cells: GridPoint[]; direction: Direction}[][];
}

function stepDir(a: GridPoint, b: GridPoint): Direction {
  return b.x > a.x ? 'R' : b.x < a.x ? 'L' : b.y > a.y ? 'D' : 'U';
}

function baseOptions(cells: GridPoint[]): {cells: GridPoint[]; direction: Direction}[] {
  if (cells.length === 1) {
    return (['U', 'D', 'L', 'R'] as Direction[]).map(direction => ({cells, direction}));
  }
  const back = [...cells].reverse();
  return [
    {cells, direction: stepDir(cells[cells.length - 2], cells[cells.length - 1])},
    {cells: back, direction: stepDir(back[back.length - 2], back[back.length - 1])},
  ];
}

function makeGroup(cells: GridPoint[], sym: SymmetrySpec, self: boolean): Group {
  const base = baseOptions(cells);
  if (self) {
    return {members: [cells], options: base.map(o => [o])};
  }
  const members = [cells, ...sym.maps.map(m => cells.map(m.cell))];
  const options = base.map(o => [
    o,
    ...sym.maps.map(m => ({cells: o.cells.map(m.cell), direction: m.dir(o.direction)})),
  ]);
  return {members, options};
}

/** Peel groups off in an order where every corridor is clear; null on deadlock. */
function orient(n: number, input: Group[], hardness: number, rng: Rng): {arrows: ArrowPath[]; gids: number[]} | null {
  const groups = [...input];
  const owner = new Int32Array(n * n).fill(-1);
  groups.forEach((g, gi) => g.members.forEach(m => m.forEach(p => (owner[p.y * n + p.x] = gi))));
  const remaining = new Set(groups.map((_, i) => i));
  const chosen: number[] = groups.map(() => -1);
  const gone: number[] = groups.map(() => 0);

  while (remaining.size > 0) {
    let best = -1;
    let bestOpt = -1;
    let bestScore = -Infinity;
    for (const gi of remaining) {
      const g = groups[gi];
      opts: for (let oi = 0; oi < g.options.length; oi++) {
        let crossedGone = 0;
        for (const m of g.options[oi]) {
          const head = m.cells[m.cells.length - 1];
          const v = DIR_VECTORS[m.direction];
          let x = head.x + v.x;
          let y = head.y + v.y;
          let lastOwner = -1;
          const selfCells = new Set(m.cells.map(p => p.y * n + p.x));
          while (x >= 0 && y >= 0 && x < n && y < n) {
            const o = owner[y * n + x];
            if (o >= 0 && !selfCells.has(y * n + x)) {
              if (!gone[o]) {
                continue opts;
              }
              if (o !== lastOwner) {
                crossedGone++;
                lastOwner = o;
              }
            }
            x += v.x;
            y += v.y;
          }
        }
        const score =
          (hardness * 2 - 1) * (crossedGone / g.options[oi].length) * 3 +
          (1 - hardness) * (4 - g.options.length) +
          rng.next() * 2;
        if (score > bestScore) {
          bestScore = score;
          best = gi;
          bestOpt = oi;
        }
      }
    }
    if (best < 0) {
      // Stuck: every remaining arrow faces something still on the board. Cut the
      // least-blocked long path in two (all its symmetric images at the same point, so
      // the picture stays symmetric); the new ends give new directions. Once only
      // stubs remain, break one symmetric group into free-standing arrows instead.
      const blockedCount = (gi: number) => {
        let bestCount = Infinity;
        for (const opt of groups[gi].options) {
          const hit = new Set<number>();
          for (const m of opt) {
            const head = m.cells[m.cells.length - 1];
            const v = DIR_VECTORS[m.direction];
            for (let x = head.x + v.x, y = head.y + v.y; x >= 0 && y >= 0 && x < n && y < n; x += v.x, y += v.y) {
              const o = owner[y * n + x];
              if (o >= 0 && !gone[o] && !m.cells.some(c => c.x === x && c.y === y)) {
                hit.add(o);
              }
            }
          }
          bestCount = Math.min(bestCount, hit.size);
        }
        return bestCount;
      };
      const long = [...remaining].filter(gi => groups[gi].members[0].length >= 2);
      const replace = (gi: number, parts: GridPoint[][][]) => {
        remaining.delete(gi);
        gone[gi] = 1;
        for (const members of parts) {
          const ni = groups.length;
          const base = baseOptions(members[0]);
          const options = base.map(o => {
            const rev = o.cells[0] !== members[0][0];
            return members.map((cells, k) => {
              if (k === 0) {
                return o;
              }
              const oc = rev ? [...cells].reverse() : cells;
              const dir = oc.length === 1 ? groups[gi].options[0][k].direction : stepDir(oc[oc.length - 2], oc[oc.length - 1]);
              return {cells: oc, direction: dir};
            });
          });
          groups.push({members, options: members.length === 1 || members[0].length > 1 ? options : base.map(o => [o])});
          chosen.push(-1);
          gone.push(0);
          remaining.add(ni);
          members.forEach(m => m.forEach(q => (owner[q.y * n + q.x] = ni)));
        }
        groups[gi] = {members: [], options: []};
      };
      if (long.length > 0) {
        // Prefer the cut that opens a clear exit for one of the pieces while keeping
        // the shorter piece as long as possible.
        const clearRay = (cells: GridPoint[], dir: Direction, skip: Set<number>) => {
          const head = cells[cells.length - 1];
          const v = DIR_VECTORS[dir];
          for (let x = head.x + v.x, y = head.y + v.y; x >= 0 && y >= 0 && x < n && y < n; x += v.x, y += v.y) {
            const o = owner[y * n + x];
            if (o >= 0 && !gone[o] && !skip.has(y * n + x)) {
              return false;
            }
          }
          return true;
        };
        let pick = -1;
        let pickCut = -1;
        let pickScore = -1;
        for (const cand of long) {
          const g = groups[cand];
          const len = g.members[0].length;
          for (let k = 1; k < len; k++) {
            let ok = false;
            for (const piece of [g.members.map(m => m.slice(0, k)), g.members.map(m => m.slice(k))]) {
              for (const o of baseOptions(piece[0])) {
                const rev = o.cells[0] !== piece[0][0];
                const all = piece.map((cells, mi) => {
                  const oc = rev ? [...cells].reverse() : cells;
                  const d = oc.length === 1 ? (mi === 0 ? o.direction : null) : stepDir(oc[oc.length - 2], oc[oc.length - 1]);
                  return {oc, d};
                });
                if (all.some(a => a.d === null)) {
                  continue;
                }
                if (all.every(a => clearRay(a.oc, a.d as Direction, new Set(a.oc.map(c => c.y * n + c.x))))) {
                  ok = true;
                }
              }
            }
            const score = ok ? Math.min(k, len - k) : -1;
            if (score > pickScore) {
              pickScore = score;
              pick = cand;
              pickCut = k;
            }
          }
        }
        if (pick < 0 || pickScore < 1) {
          long.sort((a, b) => blockedCount(a) - blockedCount(b) || groups[b].members[0].length - groups[a].members[0].length);
          pick = long[0];
          pickCut = Math.floor(groups[pick].members[0].length / 2);
        }
        const gi = pick;
        const cut = pickCut;
        const g = groups[gi];
        // 1-cell pieces of a symmetric group lose their image mapping, so dissolve them
        const partA = g.members.map(m => m.slice(0, cut));
        const partB = g.members.map(m => m.slice(cut));
        const pieces: GridPoint[][][] = [];
        for (const part of [partA, partB]) {
          if (part[0].length === 1 && part.length > 1) {
            part.forEach(m => pieces.push([m]));
          } else {
            pieces.push(part);
          }
        }
        replace(gi, pieces);
        continue;
      }
      const splittable = [...remaining].filter(gi => groups[gi].members.length > 1);
      if (splittable.length === 0) {
        return null;
      }
      const gi = rng.pick(splittable);
      replace(gi, groups[gi].members.map(m => [m]));
      continue;
    }
    chosen[best] = bestOpt;
    remaining.delete(best);
    gone[best] = 1;
  }

  const arrows: ArrowPath[] = [];
  const gids: number[] = [];
  groups.forEach((g, gi) =>
    g.members.length > 0 && g.options[chosen[gi]].forEach(m => {
      arrows.push({id: `a${arrows.length}`, color: 'blue', cells: m.cells, direction: m.direction});
      gids.push(gi);
    }),
  );
  return {arrows, gids};
}

// ------------------------------------------------------------------- build

interface Candidate {
  arrows: ArrowPath[];
  stats: Record<string, number>;
  score: number;
}

function turnsOf(cells: GridPoint[]): number {
  let t = 0;
  for (let i = 2; i < cells.length; i++) {
    const a = cells[i - 2];
    const b = cells[i - 1];
    const c = cells[i];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
      t++;
    }
  }
  return t;
}

/** How well a candidate fits its tier: depth of the blocking chain above all. */
function tierScore(tier: Tier, depth: number, blocked: number, n: number): number {
  switch (tier) {
    case 'Easy':
      return -Math.abs(depth - 3) - Math.abs(blocked - 0.35) * 4;
    case 'Medium':
      return -Math.abs(depth - Math.max(6, n / 3)) - Math.abs(blocked - 0.6) * 4;
    case 'Hard':
      return -Math.abs(depth - Math.max(10, n * 0.6)) - Math.abs(blocked - 0.8) * 4;
    default:
      return depth + blocked * 10;
  }
}

/**
 * Flip whole symmetry groups (every member reversed together, so the picture keeps its
 * symmetry) and keep a flip when the board stays solvable and fits its tier at least as
 * well. Easy boards are left as constructed.
 */
function climb(n: number, arrows: ArrowPath[], gids: number[], tier: Tier, rng: Rng, id: number): ArrowPath[] {
  if (tier === 'Easy') {
    return arrows;
  }
  const byGroup = new Map<number, number[]>();
  gids.forEach((g, i) => byGroup.set(g, [...(byGroup.get(g) ?? []), i]));
  const flippable = [...byGroup.values()].filter(ix => arrows[ix[0]].cells.length > 1);
  if (flippable.length === 0) {
    return arrows;
  }
  const fit = (a: ArrowPath[]) => {
    const v = analyse({gridSize: n, arrows: a});
    return v.solvable && v.signals ? tierScore(tier, v.signals.depth, v.signals.blockedStart, n) : -Infinity;
  };
  let current = arrows;
  let score = fit(current);
  // 51+ get a longer pass so the second fifty run deeper than the first.
  const iterations = tier === 'Very Hard' ? (id > 400 ? 1500 : id > 150 ? 1300 : id > 100 ? 1100 : id > 50 ? 900 : 500) : 250;
  for (let it = 0; it < iterations; it++) {
    const ix = rng.pick(flippable);
    const next = current.slice();
    for (const i of ix) {
      const cells = [...current[i].cells].reverse();
      next[i] = {...current[i], cells, direction: stepDir(cells[cells.length - 2], cells[cells.length - 1])};
    }
    const s = fit(next);
    if (s >= score) {
      current = next;
      score = s;
    }
  }
  return current;
}

function buildOne(plan: MockPlan, tries: number): Candidate | null {
  const n = plan.grid;
  const sym = symmetryFor(plan);
  const mask = buildMask(plan, sym);
  const style = styleFor(plan);
  const domainCells: GridPoint[] = [];
  const fixedCells: GridPoint[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!mask[y][x]) {
        continue;
      }
      const p = {x, y};
      if (sym.fixed && sym.fixed(p)) {
        fixedCells.push(p);
      } else if (sym.domain(p)) {
        domainCells.push(p);
      }
    }
  }

  let best: Candidate | null = null;
  for (let t = 0; t < tries; t++) {
    const rng = createRng(hashSeed(`mock:${plan.id}:${t}`));
    const groups: Group[] = [
      ...carve(n, domainCells, style, plan, rng).map(c => makeGroup(c, sym, false)),
      ...carve(n, fixedCells, style, plan, rng, 'v').map(c => makeGroup(c, sym, true)),
    ];
    const hardness = Math.max(0, Math.min(1, style.hardness + (rng.next() - 0.5) * 0.2));
    const oriented = orient(n, groups, hardness, rng);
    // The engine's occupancy grid holds at most 254 arrows; reject before solving anything.
    const arrows = oriented && oriented.arrows.length <= 254 ? climb(n, oriented.arrows, oriented.gids, plan.tier, rng, plan.id) : null;
    if (!arrows || arrows.length > 254) {
      continue;
    }
    const v = validate({gridSize: n, arrows});
    if (!v.solvable || v.errors.length > 0 || !v.signals) {
      continue;
    }
    const s = v.signals;
    const free0 = v.freeCounts[0] ?? 0;
    const cellsUsed = arrows.reduce((a, b) => a + b.cells.length, 0);
    const stats = {
      arrows: arrows.length,
      cells: cellsUsed,
      fill: Math.round((cellsUsed / (n * n)) * 100),
      depth: s.depth,
      freeAtStart: free0,
      blockedStart: Math.round(s.blockedStart * 100),
      meanLength: Math.round((cellsUsed / arrows.length) * 10) / 10,
      longest: Math.max(...arrows.map(a => a.cells.length)),
      turns: arrows.reduce((a, b) => a + turnsOf(b.cells), 0),
      minFree: Math.min(...v.freeCounts.slice(0, Math.max(1, v.freeCounts.length - 3))),
      D: Math.round(v.difficulty * 10) / 10,
    };
    const score = tierScore(plan.tier, s.depth, s.blockedStart, n);
    if (!best || score > best.score) {
      best = {arrows, stats, score};
    }
  }
  return best;
}

function main(): void {
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt >= 0 ? Number(process.argv[onlyAt + 1]) : null;
  const argNum = (name: string, fallback: number) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 ? Number(process.argv[at + 1]) : fallback;
  };
  const from = argNum('from', 0);
  const to = argNum('to', Infinity);
  mkdirSync(OUT, {recursive: true});
  for (const plan of MOCK_PLAN) {
    if ((only !== null && plan.id !== only) || plan.id < from || plan.id > to) {
      continue;
    }
    const built = buildOne(plan, plan.id > 200 && plan.grid >= 35 ? 10 : 12);
    if (!built) {
      console.log(`L${plan.id}: FAILED`);
      continue;
    }
    const doc = {
      id: plan.id,
      gridSize: plan.grid,
      tier: plan.tier,
      title: plan.title,
      symmetry: plan.symmetry,
      stats: built.stats,
      arrows: built.arrows.map(a => ({
        cells: a.cells.map(p => [p.x, p.y]),
        direction: a.direction,
      })),
    };
    writeFileSync(join(OUT, `level_${String(plan.id).padStart(3, '0')}.json`), JSON.stringify(doc));
    const s = built.stats;
    console.log(
      `L${plan.id} ${plan.grid}x${plan.grid} ${plan.tier.padEnd(9)} ${plan.title.padEnd(18)} ` +
        `arrows=${s.arrows} fill=${s.fill}% depth=${s.depth} free0=${s.freeAtStart} ` +
        `blocked=${s.blockedStart}% len=${s.meanLength} D=${s.D}`,
    );
  }
}

main();
