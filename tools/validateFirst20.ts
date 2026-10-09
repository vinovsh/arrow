/** Validate only the current review batch using the runtime engine. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {unpackLevel} from '../src/game/levels/codec.ts';
import type {LevelPack} from '../src/game/levels/codec.ts';
import {
  validate,
  randomPlayStaysSolvable,
} from '../src/game/engine/LevelValidator.ts';
import {createRng} from '../src/utils/rng.ts';
import {REVIEW_PLAN} from './designFirst20.ts';
const root = join(import.meta.dirname, '..');
const pack = JSON.parse(
  readFileSync(join(root, 'src/game/levels/packs/pack_001_020.json'), 'utf8'),
) as LevelPack;
if (pack.levels.length !== 20 || pack.from !== 1 || pack.to !== 20) {
  throw Error('Expected exactly levels 1–20');
}
const seen = new Set<string>();
const rng = createRng(20261009);
for (const [i, packed] of pack.levels.entries()) {
  const level = unpackLevel(packed),
    design = REVIEW_PLAN[i];
  if (level.id !== i + 1 || level.band !== design.tier) {
    throw Error(`Wrong level identity: ${level.id}`);
  }
  const result = validate(level),
    s = result.signals;
  if (!result.solvable || result.errors.length || !s) {
    throw Error(`Level ${level.id}: ${result.errors.join(', ')}`);
  }
  if (
    s.depth < design.minDepth ||
    s.blockedStart + 1e-9 < design.minBlocked ||
    1 - s.blockedStart > design.maxFree + 1e-9
  ) {
    throw Error(`Level ${level.id} fails difficulty gate`);
  }
  if (level.difficulty !== result.difficulty) {
    throw Error(`Stale difficulty: ${level.id}`);
  }
  if (level.arrows.length > 254) {
    throw Error('Engine capacity exceeded');
  }
  const key = level.arrows
    .map(a => JSON.stringify([a.cells, a.direction]))
    .sort()
    .join('|');
  if (seen.has(key)) {
    throw Error('Duplicate board');
  }
  seen.add(key);
  const mock = JSON.parse(
    readFileSync(
      join(root, `mock/data/level_${String(level.id).padStart(3, '0')}.json`),
      'utf8',
    ),
  );
  if (
    JSON.stringify(
      level.arrows.map(a => ({
        cells: a.cells.map(p => [p.x, p.y]),
        direction: a.direction,
      })),
    ) !== JSON.stringify(mock.arrows)
  ) {
    throw Error(`Preview differs: ${level.id}`);
  }
  for (let run = 0; run < 30; run++) {
    if (!randomPlayStaysSolvable(level, () => rng.next())) {
      throw Error('Random play deadlock');
    }
  }
}
console.log(
  'PASS: 20 unique boards; structural, difficulty, mock parity and 600 random playthrough checks.',
);
