/** Deterministic campaign expansion. Each new board is independently carved. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {Level, Band} from '../src/game/models/types.ts';
import {headFacesOwnBody} from '../src/game/models/types.ts';
import {
  packLevel,
  unpackLevel,
  type LevelPack,
} from '../src/game/levels/codec.ts';
import {validate} from '../src/game/engine/LevelValidator.ts';
import {createRng, hashSeed} from '../src/utils/rng.ts';
import {
  carve,
  fillLanes,
  mixLengths,
  refine,
  hasLengthMix,
  lengthMix,
  type Design,
} from './designFirst20.ts';
const root = join(import.meta.dirname, '..');
export const FAMILIES = [
  'Square weave',
  'Rounded square',
  'Diamond vault',
  'Circular maze',
  'Twin chambers',
  'Four chambers',
  'Crossroads',
  'Open courtyard',
  'Stepped fortress',
  'Woven ring',
] as const;
export function shapeFor(
  family: number,
  grid: number,
  variation: number,
): (x: number, y: number) => boolean {
  const center = (grid - 1) / 2,
    r = grid / 2,
    notch = Math.max(3, Math.floor(grid / 7));
  return (x, y) => {
    const dx = Math.abs(x - center),
      dy = Math.abs(y - center);
    switch (family) {
      case 1:
        return !(
          (x < notch || x >= grid - notch) &&
          (y < notch || y >= grid - notch)
        );
      case 2:
        return dx + dy < r * 1.45;
      case 3:
        return dx * dx + dy * dy < r * r;
      case 4:
        return !(dx < 1.5 && dy < r * 0.48);
      case 5:
        return !((dx < 1.5 && dy < r * 0.4) || (dy < 1.5 && dx < r * 0.4));
      case 6:
        return dx < r * 0.62 || dy < r * 0.62;
      case 7:
        return !(dx < notch * 0.65 && dy < notch * 0.65);
      case 8:
        return !(dx > r * (0.58 + (variation % 3) * 0.05) && dy > r * 0.72);
      case 9:
        return !(dx * dx + dy * dy < (r * 0.24) ** 2);
      default:
        return true;
    }
  };
}
export function planFor(id: number): Design & {family: number; area: number} {
  const stage = Math.min(5, Math.floor((id - 21) / 80)),
    family = (id - 21) % FAMILIES.length;
  const grid = Math.min(
    42,
    30 + stage * 2 + 2 * (Math.floor((id - 21) / 10) % 3),
  );
  const allows = shapeFor(family, grid, id),
    area = Array.from({length: grid * grid}, (_, k) =>
      allows(k % grid, Math.floor(k / grid)) ? 1 : 0,
    ).reduce<number>((a, b) => a + b, 0);
  const milestone = id % 25 === 0;
  const tier: Band =
    stage === 0
      ? 'Very Hard'
      : stage < 3
      ? 'Expert'
      : stage < 5
      ? 'Expert+'
      : 'Master';
  return {
    id,
    title: `${FAMILIES[family]} ${Math.floor((id - 21) / 10) + 1}`,
    family,
    area,
    grid,
    tier,
    minDepth: 12 + stage * 2 + (milestone ? 2 : 0),
    minBlocked: 0.78 + stage * 0.014,
    maxFree: 0.22 - stage * 0.014,
    minFill: (area / (grid * grid)) * 0.9,
    minLength: 4,
    meanLength: 12,
    maxLength: 64,
    allows,
    straightRun: 3 + (id % 4),
    trials: 40,
    refineIterations: 240,
  };
}
export function buildLevel(id: number): {
  level: Level;
  stats: Record<string, unknown>;
} {
  const d = planFor(id);
  for (let attempt = 0; attempt < 128; attempt++) {
    const rng = createRng(hashSeed(`campaign-500-v1:${id}:${attempt}`));
    const arrows = refine(
      mixLengths(fillLanes(carve(d, rng), d, rng), d, rng),
      d,
      rng,
    );
    const v = validate({gridSize: d.grid, arrows}),
      s = v.signals;
    const lengths = arrows.map(a => a.cells.length),
      mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (
      !v.solvable ||
      v.errors.length ||
      !s ||
      arrows.length > 254 ||
      !hasLengthMix(arrows) ||
      arrows.some(headFacesOwnBody) ||
      s.depth < d.minDepth ||
      s.blockedStart + 1e-9 < d.minBlocked ||
      s.occupancy + 1e-9 < d.minFill ||
      mean < d.meanLength ||
      Math.min(...lengths) < 4 ||
      Math.max(...lengths) > 64
    ) {
      continue;
    }
    return {
      level: {
        id,
        gridSize: d.grid,
        theme: d.title,
        band: d.tier,
        difficulty: v.difficulty,
        parTime: v.parTime,
        arrows,
      },
      stats: {
        id,
        title: d.title,
        tier: d.tier,
        grid: d.grid,
        arrows: arrows.length,
        depth: s.depth,
        freeAtStart: v.freeCounts[0],
        blockedStart: s.blockedStart,
        coverage: (s.occupancy * d.grid * d.grid) / d.area,
        meanLength: mean,
        mix: lengthMix(arrows),
        attempt,
        D: v.difficulty,
      },
    };
  }
  throw new Error(`No eligible level ${id}`);
}
function main() {
  const from = Number(process.env.LEVEL_FROM ?? 21),
    to = Number(process.env.LEVEL_TO ?? 500);
  const out = join(root, 'tools/out/campaign-500');
  mkdirSync(out, {recursive: true});
  for (let id = from; id <= to; id++) {
    const file = join(out, `level_${id}.json`);
    if (process.env.RESUME === '1') {
      try {
        JSON.parse(readFileSync(file, 'utf8'));
        continue;
      } catch {}
    }
    const t = Date.now(),
      result = buildLevel(id);
    writeFileSync(file, JSON.stringify(result) + '\n');
    console.log(`${id} ${Date.now() - t}ms ${JSON.stringify(result.stats)}`);
  }
  if (to !== 500 || from !== 21) {
    return;
  }
  const original = JSON.parse(
    readFileSync(join(root, 'tools/fixtures/approved-first-20.json'), 'utf8'),
  ) as LevelPack;
  const levels = original.levels.map(unpackLevel),
    report = [];
  for (let id = 21; id <= 500; id++) {
    const row = JSON.parse(readFileSync(join(out, `level_${id}.json`), 'utf8'));
    levels.push(row.level);
    report.push(row.stats);
  }
  for (let first = 1; first <= 500; first += 25) {
    const last = first + 24;
    writeFileSync(
      join(
        root,
        `src/game/levels/packs/pack_${String(first).padStart(3, '0')}_${String(
          last,
        ).padStart(3, '0')}.json`,
      ),
      JSON.stringify({
        v: 1,
        from: first,
        to: last,
        levels: levels.slice(first - 1, last).map(packLevel),
      }) + '\n',
    );
  }
  writeFileSync(
    join(root, 'tools/campaign-500-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  writeFileSync(
    join(root, 'src/game/levels/packLoaders.ts'),
    '/** Campaign: 500 levels in 20 lazy-loaded packs. */\nexport const PACK_LOADERS: (() => unknown)[] = [\n' +
      Array.from(
        {length: 20},
        (_, i) =>
          `  () => require('./packs/pack_${String(i * 25 + 1).padStart(
            3,
            '0',
          )}_${String(i * 25 + 25).padStart(3, '0')}.json'),`,
      ).join('\n') +
      '\n];\n',
  );
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main();
}
