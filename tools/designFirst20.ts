/** Reproducible first review batch. Never generates levels beyond 20. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildOne} from './mock/buildMocks.ts';
import {circle, ellipse, poly, starPts} from './mock/patterns.ts';
import type {Pattern, MockPlan} from './mock/patterns.ts';
import type {ArrowPath, Band, Level} from '../src/game/models/types.ts';
import {directionFromCells} from '../src/game/models/types.ts';
import {analyse, validate} from '../src/game/engine/LevelValidator.ts';
import type {Validation} from '../src/game/engine/LevelValidator.ts';
import {packLevel} from '../src/game/levels/codec.ts';
import {createRng, hashSeed} from '../src/utils/rng.ts';

const root = join(import.meta.dirname, '..');
const diamond: Pattern = {
  fill: (x, y) => Math.abs(x - 0.5) + Math.abs(y - 0.5) < 0.48,
};
const disk: Pattern = {fill: (x, y) => circle(x, y, 0.5, 0.5, 0.46)};
const square: Pattern = {
  fill: (x, y) => x > 0.07 && x < 0.93 && y > 0.07 && y < 0.93,
};
const cross: Pattern = {
  fill: (x, y) =>
    (Math.abs(x - 0.5) < 0.16 && Math.abs(y - 0.5) < 0.45) ||
    (Math.abs(y - 0.5) < 0.16 && Math.abs(x - 0.5) < 0.45),
};
const heart: Pattern = {
  fill: (x, y) =>
    circle(x, y, 0.32, 0.33, 0.23) ||
    circle(x, y, 0.68, 0.33, 0.23) ||
    poly(x, y, [
      [0.1, 0.36],
      [0.9, 0.36],
      [0.5, 0.92],
    ]),
};
const bolt: Pattern = {
  fill: (x, y) =>
    poly(x, y, [
      [0.55, 0.04],
      [0.16, 0.57],
      [0.43, 0.57],
      [0.35, 0.96],
      [0.85, 0.39],
      [0.56, 0.39],
    ]),
};
const clover: Pattern = {
  fill: (x, y) =>
    circle(x, y, 0.33, 0.33, 0.25) ||
    circle(x, y, 0.67, 0.33, 0.25) ||
    circle(x, y, 0.33, 0.67, 0.25) ||
    circle(x, y, 0.67, 0.67, 0.25),
};
const star: Pattern = {
  fill: (x, y) => poly(x, y, starPts(0.5, 0.5, 0.48, 0.27, 5)),
};
const leaf: Pattern = {
  fill: (x, y) => ellipse(x, y, 0.5, 0.5, 0.3, 0.46, -0.45),
};
const hourglass: Pattern = {
  fill: (x, y) =>
    poly(x, y, [
      [0.12, 0.07],
      [0.88, 0.07],
      [0.58, 0.5],
      [0.88, 0.93],
      [0.12, 0.93],
      [0.42, 0.5],
    ]),
};
const fish: Pattern = {
  fill: (x, y) =>
    ellipse(x, y, 0.45, 0.5, 0.36, 0.3) ||
    poly(x, y, [
      [0.68, 0.5],
      [0.95, 0.21],
      [0.95, 0.79],
    ]),
};
const owl: Pattern = {
  fill: (x, y) =>
    ellipse(x, y, 0.5, 0.57, 0.38, 0.36) ||
    poly(x, y, [
      [0.15, 0.41],
      [0.13, 0.06],
      [0.4, 0.23],
      [0.6, 0.23],
      [0.87, 0.06],
      [0.85, 0.41],
    ]),
};
const butterfly: Pattern = {
  fill: (x, y) =>
    ellipse(x, y, 0.29, 0.34, 0.25, 0.29, -0.2) ||
    ellipse(x, y, 0.71, 0.34, 0.25, 0.29, 0.2) ||
    ellipse(x, y, 0.31, 0.71, 0.21, 0.23, 0.2) ||
    ellipse(x, y, 0.69, 0.71, 0.21, 0.23, -0.2) ||
    Math.abs(x - 0.5) < 0.07,
};
const crown: Pattern = {
  fill: (x, y) =>
    poly(x, y, [
      [0.08, 0.25],
      [0.3, 0.46],
      [0.5, 0.07],
      [0.7, 0.46],
      [0.92, 0.25],
      [0.81, 0.88],
      [0.19, 0.88],
    ]),
};
const lock: Pattern = {
  fill: (x, y) =>
    (x > 0.12 && x < 0.88 && y > 0.4 && y < 0.94) ||
    (circle(x, y, 0.5, 0.37, 0.3) &&
      !circle(x, y, 0.5, 0.37, 0.16) &&
      y < 0.48),
};
interface Design {
  id: number;
  title: string;
  grid: number;
  tier: Band;
  pattern: Pattern;
  minDepth: number;
  minBlocked: number;
  maxFree: number;
}
const rows: [string, number, Band, Pattern, number, number, number][] = [
  ['First paths', 7, 'Tutorial', square, 0, 0, 1],
  ['Four corners', 8, 'Tutorial', square, 0, 0, 1],
  ['Crossroads', 10, 'Easy', cross, 2, 0.25, 0.75],
  ['Diamond steps', 11, 'Easy', diamond, 3, 0.35, 0.65],
  ['Heart lanes', 13, 'Easy', heart, 4, 0.45, 0.55],
  ['Lightning', 15, 'Medium', bolt, 5, 0.65, 0.4],
  ['Roundabout', 15, 'Medium', disk, 6, 0.68, 0.35],
  ['Interlock', 17, 'Hard', square, 10, 0.85, 0.15],
  ['Lucky clover', 16, 'Medium', clover, 6, 0.68, 0.35],
  ['Star gate', 21, 'Hard', star, 10, 0.8, 0.2],
  ['Leaf trail', 17, 'Medium', leaf, 6, 0.68, 0.35],
  ['Hourglass', 20, 'Hard', hourglass, 11, 0.85, 0.15],
  ['Reef fish', 18, 'Medium', fish, 7, 0.7, 0.3],
  ['Night owl', 21, 'Hard', owl, 12, 0.87, 0.13],
  ['Vault', 22, 'Very Hard', square, 16, 0.92, 0.08],
  ['Butterfly', 19, 'Medium', butterfly, 7, 0.72, 0.28],
  ['Compass', 26, 'Hard', diamond, 12, 0.82, 0.18],
  ['Royal maze', 23, 'Hard', crown, 13, 0.88, 0.12],
  ['Locksmith', 26, 'Very Hard', lock, 16, 0.9, 0.1],
  ['Grand labyrinth', 32, 'Very Hard', square, 18, 0.9, 0.1],
];
export const REVIEW_PLAN: Design[] = rows.map((r, i) => ({
  id: i + 1,
  title: r[0],
  grid: r[1],
  tier: r[2],
  pattern: r[3],
  minDepth: r[4],
  minBlocked: r[5],
  maxFree: r[6],
}));

function tutorial(id: number): ArrowPath[] {
  const paths =
    id === 1
      ? [
          [
            [1, 4],
            [2, 4],
            [2, 3],
            [1, 3],
            [1, 2],
          ],
          [
            [4, 2],
            [4, 3],
            [5, 3],
            [5, 4],
            [5, 5],
          ],
          [
            [2, 5],
            [2, 6],
            [3, 6],
            [4, 6],
          ],
        ]
      : [
          [
            [1, 2],
            [2, 2],
            [2, 1],
            [1, 1],
            [0, 1],
          ],
          [
            [5, 1],
            [5, 2],
            [6, 2],
            [6, 1],
            [7, 1],
          ],
          [
            [1, 5],
            [2, 5],
            [2, 6],
            [1, 6],
            [0, 6],
          ],
          [
            [5, 6],
            [5, 5],
            [6, 5],
            [6, 6],
            [7, 6],
          ],
        ];
  return paths.map((p, i) => {
    const cells = p.map(([x, y]) => ({x, y}));
    return {
      id: `a${i}`,
      color: 'white',
      cells,
      direction: directionFromCells(cells)!,
    };
  });
}
function loss(v: Validation, d: Design): number {
  if (!v.solvable || !v.signals) {
    return 1e6;
  }
  const s = v.signals,
    free = 1 - s.blockedStart;
  // Difficulty comes from actual dependency chains and limited opening choices.
  const deficit =
    Math.max(0, d.minDepth - s.depth) * 4 +
    Math.max(0, d.minBlocked - s.blockedStart) * 70 +
    Math.max(0, free - d.maxFree) * 70;
  const target =
    d.tier === 'Very Hard'
      ? 7.3
      : d.tier === 'Hard'
      ? 6.6
      : d.tier === 'Medium'
      ? 5.6
      : 4.4;
  return (
    deficit +
    Math.abs(v.difficulty - target) * 1.2 +
    Math.max(0, s.freeAvgCount / s.n - 0.3) * 5
  );
}
function refine(arrows: ArrowPath[], d: Design, seed: number): ArrowPath[] {
  const rng = createRng(seed);
  let current = arrows,
    score = loss(analyse({gridSize: d.grid, arrows}), d),
    best = current,
    bestScore = score;
  for (let i = 0; i < 2200; i++) {
    const ix = rng.int(current.length),
      a = current[ix];
    const cells = [...a.cells].reverse();
    const direction =
      cells.length > 1
        ? directionFromCells(cells)!
        : rng.pick(['U', 'D', 'L', 'R'] as const);
    const next = current.slice();
    next[ix] = {...a, cells, direction};
    const v = analyse({gridSize: d.grid, arrows: next});
    if (!v.solvable) {
      continue;
    }
    const cost = loss(v, d),
      temperature = 0.4 * (1 - i / 2200) + 0.01;
    if (cost <= score || rng.next() < Math.exp((score - cost) / temperature)) {
      current = next;
      score = cost;
      if (cost < bestScore) {
        best = current;
        bestScore = cost;
      }
    }
  }
  return best;
}
function meets(v: Validation, d: Design): boolean {
  return (
    !!v.signals &&
    v.solvable &&
    !v.errors.length &&
    v.signals.depth >= d.minDepth &&
    v.signals.blockedStart + 1e-9 >= d.minBlocked &&
    1 - v.signals.blockedStart <= d.maxFree + 1e-9
  );
}
function main(): void {
  mkdirSync(join(root, 'mock/data'), {recursive: true});
  mkdirSync(join(root, 'src/game/levels/packs'), {recursive: true});
  const levels: Level[] = [];
  const report = [];
  for (const d of REVIEW_PLAN) {
    let arrows: ArrowPath[] = d.id <= 2 ? tutorial(d.id) : [];
    let bestLoss = Infinity;
    if (d.id > 2) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const plan: MockPlan = {
          id: d.id + 1000 + attempt * 20,
          title: d.title,
          grid: d.grid,
          tier: d.tier === 'Tutorial' ? 'Easy' : (d.tier as MockPlan['tier']),
          symmetry: 'none',
          pattern: d.pattern,
        };
        const built = buildOne(plan, 3);
        if (!built) {
          continue;
        }
        const candidate = refine(
          built.arrows,
          d,
          hashSeed(`review-v1:${d.id}:${attempt}`),
        );
        const v = validate({gridSize: d.grid, arrows: candidate}),
          cost = loss(v, d);
        if (cost < bestLoss) {
          arrows = candidate;
          bestLoss = cost;
        }
        if (meets(v, d)) {
          break;
        }
      }
    }
    const v = validate({gridSize: d.grid, arrows});
    if (!arrows.length || !meets(v, d)) {
      throw Error(
        `Level ${d.id} fails review gate: ${JSON.stringify(v.signals)}`,
      );
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
    const stats = {
      arrows: arrows.length,
      depth: v.signals!.depth,
      freeAtStart: v.freeCounts[0],
      blockedStart: Math.round(v.signals!.blockedStart * 100),
      D: v.difficulty,
    };
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
    console.log(`${d.id} ${d.title} ${d.tier} ${JSON.stringify(stats)}`);
  }
  writeFileSync(
    join(root, 'src/game/levels/packs/pack_001_020.json'),
    JSON.stringify({v: 1, from: 1, to: 20, levels: levels.map(packLevel)}) +
      '\n',
  );
  writeFileSync(
    join(root, 'mock/review-first-20.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main();
}
