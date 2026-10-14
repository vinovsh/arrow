/** Structural audit, difficulty gates, uniqueness and random engine play for all 500. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  packLevel,
  unpackLevel,
  type LevelPack,
} from '../src/game/levels/codec.ts';
import {
  validate,
  randomPlayStaysSolvable,
} from '../src/game/engine/LevelValidator.ts';
import {headFacesOwnBody} from '../src/game/models/types.ts';
import {createRng} from '../src/utils/rng.ts';
import {hasLengthMix} from './designFirst20.ts';
import {planFor} from './design500.ts';
/** Ignore arrow IDs and all eight rotations/reflections when checking originality. */
function canonicalKey(level: ReturnType<typeof unpackLevel>): string {
  const n = level.gridSize - 1,
    keys: string[] = [];
  for (let transform = 0; transform < 8; transform++) {
    keys.push(
      level.arrows
        .map(a =>
          a.cells
            .map(p => {
              let x = transform >= 4 ? n - p.x : p.x,
                y = p.y;
              for (let turn = 0; turn < transform % 4; turn++) {
                const previous = x;
                x = n - y;
                y = previous;
              }
              return `${x},${y}`;
            })
            .join(' '),
        )
        .sort()
        .join('|'),
    );
  }
  return `${level.gridSize}:` + keys.sort()[0];
}
const root = join(import.meta.dirname, '..'),
  rng = createRng(50020261013),
  seen = new Set<string>();
let count = 0,
  plays = 0;
for (let first = 1; first <= 500; first += 25) {
  const last = first + 24;
  const pack = JSON.parse(
    readFileSync(
      join(
        root,
        `src/game/levels/packs/pack_${String(first).padStart(3, '0')}_${String(
          last,
        ).padStart(3, '0')}.json`,
      ),
      'utf8',
    ),
  ) as LevelPack;
  if (
    pack.from !== first ||
    pack.to !== last ||
    pack.v !== 1 ||
    pack.levels.length !== 25
  ) {
    throw Error(`Pack range ${first}`);
  }
  for (const [offset, packed] of pack.levels.entries()) {
    const level = unpackLevel(packed),
      v = validate(level),
      s = v.signals;
    if (
      level.id !== first + offset ||
      !v.solvable ||
      v.errors.length ||
      !s ||
      v.difficulty !== level.difficulty ||
      JSON.stringify(packLevel(level)) !== JSON.stringify(packed) ||
      level.arrows.length > 254 ||
      level.decor?.length ||
      level.arrows.some(headFacesOwnBody)
    ) {
      throw Error(`Invalid level ${level.id}: ${v.errors}`);
    }
    if (level.id > 1 && !hasLengthMix(level.arrows)) {
      throw Error(`Length mix ${level.id}`);
    }
    const fingerprint = canonicalKey(level);
    if (seen.has(fingerprint)) {
      throw Error(`Duplicate level ${level.id}`);
    }
    seen.add(fingerprint);
    if (level.id > 20) {
      const d = planFor(level.id),
        lengths = level.arrows.map(a => a.cells.length);
      if (
        level.gridSize !== d.grid ||
        level.band !== d.tier ||
        s.depth < d.minDepth ||
        s.blockedStart + 1e-9 < d.minBlocked ||
        s.occupancy + 1e-9 < d.minFill ||
        Math.min(...lengths) < 4 ||
        Math.max(...lengths) > 64 ||
        lengths.reduce((a, b) => a + b, 0) / lengths.length < 12 ||
        level.arrows.some(a => a.cells.some(p => !d.allows!(p.x, p.y)))
      ) {
        throw Error(`Design gate ${level.id}`);
      }
    }
    for (let run = 0; run < 20; run++) {
      if (!randomPlayStaysSolvable(level, () => rng.next())) {
        throw Error(`Random play deadlock ${level.id}`);
      }
      plays++;
    }
    count++;
  }
}
const approved = JSON.parse(
  readFileSync(join(root, 'tools/fixtures/approved-first-20.json'), 'utf8'),
) as LevelPack;
const firstPack = JSON.parse(
  readFileSync(join(root, 'src/game/levels/packs/pack_001_025.json'), 'utf8'),
) as LevelPack;
if (
  JSON.stringify(approved.levels) !==
  JSON.stringify(firstPack.levels.slice(0, 20))
) {
  throw Error('Approved first 20 changed');
}
console.log(
  `PASS: ${count} unique levels, 20 complete packs, approved first 20 preserved, difficulty/path/shape gates and ${plays} random legal playthroughs.`,
);
