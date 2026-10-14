/** Original mixed-length mazes with clear arrowheads and interlocking paths. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {
  ArrowPath,
  Band,
  GridPoint,
  Level,
} from '../src/game/models/types.ts';
import {
  directionFromCells,
  headFacesOwnBody,
} from '../src/game/models/types.ts';
import {analyse, validate} from '../src/game/engine/LevelValidator.ts';
import {packLevel} from '../src/game/levels/codec.ts';
import {createRng, hashSeed} from '../src/utils/rng.ts';
import type {Rng} from '../src/utils/rng.ts';
const root = join(import.meta.dirname, '..');
export interface Design {
  id: number;
  title: string;
  grid: number;
  tier: Band;
  minDepth: number;
  minBlocked: number;
  maxFree: number;
  minFill: number;
  minLength: number;
  meanLength: number;
  maxLength: number;
  allows?: (x: number, y: number) => boolean;
  straightRun?: number;
  trials?: number;
  refineIterations?: number;
}
const rows: [string, number, Band][] = [
  ['Tap to remove', 12, 'Tutorial'],
  ['Nested lanes', 20, 'Medium'],
  ['Switchback', 22, 'Hard'],
  ['Coiled square', 24, 'Hard'],
  ['Cross stitch', 24, 'Hard'],
  ['Inner circuit', 26, 'Hard'],
  ['Winding vault', 26, 'Hard'],
  ['Double spiral', 28, 'Hard'],
  ['Braided routes', 28, 'Hard'],
  ['Hidden exits', 30, 'Very Hard'],
  ['Folded maze', 30, 'Very Hard'],
  ['Deep weave', 32, 'Very Hard'],
  ['Offset chambers', 32, 'Very Hard'],
  ['Tangled circuit', 34, 'Very Hard'],
  ['Spiral fortress', 34, 'Very Hard'],
  ['Long way out', 36, 'Very Hard'],
  ['Interwoven', 36, 'Very Hard'],
  ['Labyrinth', 38, 'Very Hard'],
  ['Final turns', 38, 'Very Hard'],
  ['Grand weave', 40, 'Very Hard'],
];
export const REVIEW_PLAN: Design[] = rows.map(([title, grid, tier], i) => ({
  id: i + 1,
  title,
  grid,
  tier,
  minDepth: i === 0 ? 0 : i === 1 ? 5 : i < 9 ? 8 : 12,
  minBlocked: i === 0 ? 0 : i === 1 ? 0.65 : i < 9 ? 0.75 : 0.8,
  maxFree: i === 0 ? 1 : i === 1 ? 0.35 : i < 9 ? 0.25 : 0.2,
  minFill: i === 0 ? 0 : 0.94,
  minLength: 4,
  meanLength: i === 0 ? 4 : 12,
  maxLength: 64,
}));
const steps: GridPoint[] = [
  {x: 1, y: 0},
  {x: 0, y: 1},
  {x: -1, y: 0},
  {x: 0, y: -1},
];
const key = (p: GridPoint, n: number) => p.y * n + p.x;
/** Four isolated, straight arrows teach tapping before level two teaches blocking. */
export function tutorialArrows(): ArrowPath[] {
  return [3, 5, 7, 9].map((x, i) => {
    const cells = Array.from({length: 5}, (_, k) => ({x, y: 4 + k}));
    if (i < 2) {
      cells.reverse();
    }
    return {
      id: `a${i}`,
      color: 'white',
      cells,
      direction: directionFromCells(cells)!,
    };
  });
}
export function lengthMix(arrows: ArrowPath[]) {
  const short = arrows.filter(a => a.cells.length <= 7).length;
  const medium = arrows.filter(
    a => a.cells.length >= 8 && a.cells.length <= 19,
  ).length;
  const long = arrows.length - short - medium;
  return {short, medium, long};
}
function mixDeficit(arrows: ArrowPath[]): number {
  const m = lengthMix(arrows),
    n = arrows.length;
  return (
    Math.max(0, 0.2 - m.short / n) +
    Math.max(0, 0.25 - m.medium / n) +
    Math.max(0, 0.25 - m.long / n) +
    Math.max(0, m.long / n - 0.5)
  );
}
export const hasLengthMix = (arrows: ArrowPath[]) => mixDeficit(arrows) < 1e-9;
function turns(cells: GridPoint[]): number {
  let count = 0;
  for (let i = 2; i < cells.length; i++) {
    const a = cells[i - 2],
      b = cells[i - 1],
      c = cells[i];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
      count++;
    }
  }
  return count;
}
/** Place in reverse solve order: every new head initially has a clear exit. */
export function carve(d: Design, rng: Rng): ArrowPath[] {
  const n = d.grid,
    used = new Uint8Array(n * n),
    arrows: ArrowPath[] = [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const empty = (x: number, y: number) =>
    inside(x, y) && (!d.allows || d.allows(x, y)) && !used[y * n + x];
  const degree = (p: GridPoint) =>
    steps.filter(s => empty(p.x + s.x, p.y + s.y)).length;
  for (let round = 0; round < (n * n) / 8; round++) {
    const starts: {p: GridPoint; s: GridPoint}[] = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (empty(x, y)) {
          for (const s of steps) {
            if (!empty(x - s.x, y - s.y)) {
              continue;
            }
            let clear = true;
            for (
              let xx = x + s.x, yy = y + s.y;
              inside(xx, yy);
              xx += s.x, yy += s.y
            ) {
              if (used[yy * n + xx]) {
                clear = false;
                break;
              }
            }
            if (clear) {
              starts.push({p: {x, y}, s});
            }
          }
        }
      }
    }
    if (!starts.length) {
      break;
    }
    let best: GridPoint[] = [];
    let bestScore = -Infinity;
    for (
      let trial = 0;
      trial < Math.min(starts.length, d.trials ?? 90);
      trial++
    ) {
      const {p, s} = rng.pick(starts),
        path = [p, {x: p.x - s.x, y: p.y - s.y}];
      for (const q of path) {
        used[key(q, n)] = 1;
      }
      let prev = {x: -s.x, y: -s.y},
        run = 1;
      const target = 10 + rng.int(20);
      while (path.length < target) {
        const head = path[path.length - 1];
        const options = steps
          .filter(v => empty(head.x + v.x, head.y + v.y))
          .filter(v => {
            const x = head.x + v.x,
              y = head.y + v.y;
            return !(s.x !== 0
              ? y === p.y && (x - p.x) * s.x > 0
              : x === p.x && (y - p.y) * s.y > 0);
          })
          .map(v => {
            const p2 = {x: head.x + v.x, y: head.y + v.y},
              straight = v.x === prev.x && v.y === prev.y;
            const weight =
              (straight
                ? run < (d.straightRun ?? 5)
                  ? 5
                  : 1.8
                : run < 2
                ? 0.15
                : 1.3) /
              (1 + degree(p2));
            return {v, p: p2, weight};
          });
        if (!options.length) {
          break;
        }
        let roll = rng.next() * options.reduce((sum, o) => sum + o.weight, 0),
          chosen = options[0];
        for (const o of options) {
          roll -= o.weight;
          if (roll <= 0) {
            chosen = o;
            break;
          }
        }
        run = chosen.v.x === prev.x && chosen.v.y === prev.y ? run + 1 : 1;
        prev = chosen.v;
        path.push(chosen.p);
        used[key(chosen.p, n)] = 1;
      }
      const value =
        path.length + Math.min(5, turns(path)) * 1.5 + rng.next() * 7;
      for (const q of path) {
        used[key(q, n)] = 0;
      }
      if (path.length >= 8 && value > bestScore) {
        best = path;
        bestScore = value;
      }
    }
    if (!best.length) {
      break;
    }
    best.reverse();
    for (const p of best) {
      used[key(p, n)] = 1;
    }
    arrows.push({
      id: `a${arrows.length}`,
      color: 'white',
      cells: best,
      direction: directionFromCells(best)!,
    });
  }
  return arrows;
}
/** Fill empty lanes by extending existing bodies, never by adding tiny arrows. */
export function fillLanes(
  input: ArrowPath[],
  d: Design,
  rng: Rng,
): ArrowPath[] {
  let arrows = input;
  const n = d.grid;
  for (let pass = 0; pass < 4; pass++) {
    const used = new Uint8Array(n * n);
    arrows.forEach(a => a.cells.forEach(p => (used[key(p, n)] = 1)));
    const empty = (p: GridPoint) =>
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < n &&
      p.y < n &&
      (!d.allows || d.allows(p.x, p.y)) &&
      !used[key(p, n)];
    let changes = 0;
    for (const ix of rng.shuffle(arrows.map((_, i) => i))) {
      for (let j = 0; j < arrows[ix].cells.length - 1; j++) {
        const a = arrows[ix],
          first = a.cells[j],
          second = a.cells[j + 1],
          dx = second.x - first.x,
          dy = second.y - first.y;
        for (const side of rng.shuffle([-1, 1])) {
          const px = -dy * side,
            py = dx * side;
          for (let length = 5; length >= 1; length--) {
            if (a.cells.length + length * 2 > d.maxLength) {
              continue;
            }
            const extra: GridPoint[] = [];
            for (let k = 1; k <= length; k++) {
              extra.push({x: first.x + px * k, y: first.y + py * k});
            }
            for (let k = length; k >= 1; k--) {
              extra.push({x: second.x + px * k, y: second.y + py * k});
            }
            if (!extra.every(empty)) {
              continue;
            }
            const cells = [
                ...a.cells.slice(0, j + 1),
                ...extra,
                ...a.cells.slice(j + 1),
              ],
              next = arrows.slice();
            next[ix] = {...a, cells, direction: directionFromCells(cells)!};
            if (
              !headFacesOwnBody(next[ix]) &&
              analyse({gridSize: n, arrows: next}).solvable
            ) {
              arrows = next;
              extra.forEach(p => (used[key(p, n)] = 1));
              changes++;
              j += extra.length;
              break;
            }
          }
          if (arrows[ix] !== a) {
            break;
          }
        }
      }
      for (let k = 0; k < 12 && arrows[ix].cells.length < d.maxLength; k++) {
        const a = arrows[ix],
          tail = a.cells[0],
          options = rng
            .shuffle(steps.map(v => ({x: tail.x + v.x, y: tail.y + v.y})))
            .filter(empty);
        let changed = false;
        for (const p of options) {
          const next = arrows.slice();
          next[ix] = {...a, cells: [p, ...a.cells]};
          if (
            !headFacesOwnBody(next[ix]) &&
            analyse({gridSize: n, arrows: next}).solvable
          ) {
            arrows = next;
            used[key(p, n)] = 1;
            changes++;
            changed = true;
            break;
          }
        }
        if (!changed) {
          break;
        }
      }
    }
    if (!changes) {
      break;
    }
  }
  return arrows;
}
/** Divide selected lanes into readable short and medium arrows, preserving coverage. */
export function mixLengths(
  input: ArrowPath[],
  d: Design,
  rng: Rng,
): ArrowPath[] {
  let arrows = input;
  for (let round = 0; round < 80 && !hasLengthMix(arrows); round++) {
    let best = arrows,
      bestScore = -Infinity;
    const deficit = mixDeficit(arrows);
    for (let trial = 0; trial < 100; trial++) {
      const ix = rng.int(arrows.length),
        source = arrows[ix];
      const size = 4 + rng.int(16);
      if (source.cells.length < size + 20) {
        continue;
      }
      const cut = rng.next() < 0.5 ? size : source.cells.length - size;
      const parts = [source.cells.slice(0, cut), source.cells.slice(cut)];
      for (let orientation = 0; orientation < 4; orientation++) {
        const pieces = parts.map((part, i) => {
          const reverse = i === 0 ? orientation % 2 === 1 : orientation >= 2;
          const cells = reverse ? [...part].reverse() : part;
          return {
            ...source,
            id: `${source.id}_${round}_${i}`,
            cells,
            direction: directionFromCells(cells)!,
          };
        });
        if (pieces.some(headFacesOwnBody)) {
          continue;
        }
        const next = [
          ...arrows.slice(0, ix),
          ...pieces,
          ...arrows.slice(ix + 1),
        ];
        if (mixDeficit(next) >= deficit - 1e-9) {
          continue;
        }
        const value = score(next, d) - mixDeficit(next) * 100000;
        if (
          value > bestScore &&
          analyse({gridSize: d.grid, arrows: next}).solvable
        ) {
          best = next;
          bestScore = value;
        }
      }
    }
    if (best === arrows) {
      break;
    }
    arrows = best;
  }
  return arrows.map((a, i) => ({...a, id: `a${i}`}));
}
function score(arrows: ArrowPath[], d: Design): number {
  if (arrows.some(headFacesOwnBody)) {
    return -1e6;
  }
  const v = analyse({gridSize: d.grid, arrows});
  if (!v.solvable || !v.signals) {
    return -1e6;
  }
  const s = v.signals,
    mean = arrows.reduce((sum, a) => sum + a.cells.length, 0) / arrows.length;
  return (
    s.occupancy * 180 +
    Math.min(s.depth, d.minDepth + 5) * 2 +
    s.blockedStart * 20 -
    Math.max(0, d.minFill - s.occupancy) * 10000 -
    Math.max(0, d.minDepth - s.depth) * 2000 -
    Math.max(0, d.minBlocked - s.blockedStart) * 5000 -
    Math.max(0, d.meanLength - mean) * 3
  );
}
export function refine(arrows: ArrowPath[], d: Design, rng: Rng): ArrowPath[] {
  let best = arrows,
    bestScore = score(arrows, d);
  for (let i = 0; i < (d.refineIterations ?? 1000); i++) {
    const ix = rng.int(best.length),
      cells = [...best[ix].cells].reverse(),
      next = best.slice();
    next[ix] = {...next[ix], cells, direction: directionFromCells(cells)!};
    if (headFacesOwnBody(next[ix])) {
      continue;
    }
    const s = score(next, d);
    if (s >= bestScore) {
      best = next;
      bestScore = s;
    }
  }
  return best;
}
export function main(): void {
  mkdirSync(join(root, 'mock/data'), {recursive: true});
  mkdirSync(join(root, 'src/game/levels/packs'), {recursive: true});
  const levels: Level[] = [],
    report = [];
  const only = Number(process.env.DESIGN_LEVEL || 0);
  for (const d of REVIEW_PLAN) {
    if (only && d.id !== only) {
      continue;
    }
    let arrows: ArrowPath[] = d.id === 1 ? tutorialArrows() : [],
      bestScore = -Infinity;
    for (let attempt = 0; d.id !== 1 && attempt < 1024; attempt++) {
      const rng = createRng(hashSeed(`mixed-weave-v4:${d.id}:${attempt}`)),
        candidate = refine(
          mixLengths(fillLanes(carve(d, rng), d, rng), d, rng),
          d,
          rng,
        );
      const signals = analyse({gridSize: d.grid, arrows: candidate}).signals;
      const eligible =
        signals &&
        hasLengthMix(candidate) &&
        signals.depth >= d.minDepth &&
        signals.blockedStart + 1e-9 >= d.minBlocked &&
        signals.occupancy >= d.minFill;
      const value = score(candidate, d) + (eligible ? 1e6 : 0);
      if (value > bestScore) {
        arrows = candidate;
        bestScore = value;
      }
      if (attempt >= 31 && bestScore > 1e5) {
        break;
      }
    }
    const v = validate({gridSize: d.grid, arrows}),
      s = v.signals!,
      lengths = arrows.map(a => a.cells.length),
      mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const stats = {
      arrows: arrows.length,
      depth: s?.depth,
      freeAtStart: v.freeCounts[0],
      blockedStart: Math.round(s?.blockedStart * 100),
      fill: Math.round(s?.occupancy * 100),
      minLength: Math.min(...lengths),
      meanLength: Math.round(mean * 10) / 10,
      longest: Math.max(...lengths),
      mix: lengthMix(arrows),
      turns: Math.round(s?.turns * 10) / 10,
      D: v.difficulty,
    };
    console.log(`${d.id} ${d.title} ${JSON.stringify(stats)}`);
    if (
      v.errors.length ||
      arrows.some(headFacesOwnBody) ||
      (d.id !== 1 && !hasLengthMix(arrows)) ||
      !v.solvable ||
      s.depth < d.minDepth ||
      s.blockedStart + 1e-9 < d.minBlocked ||
      s.occupancy < d.minFill ||
      mean < d.meanLength ||
      Math.min(...lengths) < d.minLength
    ) {
      throw Error('Design gate failed: ' + JSON.stringify(stats));
    }
    const level: Level = {
      id: d.id,
      gridSize: d.grid,
      theme: d.title,
      band: d.tier,
      difficulty: v.difficulty,
      parTime: v.parTime,
      arrows,
    };
    levels.push(level);
    report.push({
      id: d.id,
      title: d.title,
      tier: d.tier,
      grid: d.grid,
      ...stats,
    });
    writeFileSync(
      join(root, `mock/data/level_${String(d.id).padStart(3, '0')}.json`),
      JSON.stringify(
        {
          id: d.id,
          gridSize: d.grid,
          title: d.title,
          tier: d.tier,
          status: 'Awaiting user review',
          stats,
          arrows: arrows.map(a => ({
            cells: a.cells.map(p => [p.x, p.y]),
            direction: a.direction,
          })),
        },
        null,
        2,
      ) + '\n',
    );
  }
  if (!only) {
    writeFileSync(
      join(root, 'tools/fixtures/approved-first-20.json'),
      JSON.stringify({v: 1, from: 1, to: 20, levels: levels.map(packLevel)}) +
        '\n',
    );
    writeFileSync(
      join(root, 'mock/review-first-20.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main();
}
