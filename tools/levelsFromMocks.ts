/**
 * Ships the approved mock designs as the game's levels.
 *
 *   node --import ./tools/register.mjs tools/levelsFromMocks.ts
 *
 * Levels 3-500 were designed as mocks (tools/mock/, reviewed as images in mock/) and
 * approved as drawn, so this does not generate anything: it copies every approved
 * board — cells, cell order and direction, arrow for arrow — out of
 * mock/data/level_NNN.json into the 25-level packs. What it adds is only what the
 * packs need and the mocks never carried: a colour per arrow, the band label, the
 * stored difficulty and the par time, all computed by the shipped engine code.
 *
 * Levels 1 and 2 are the drawn tutorial boards and are kept from the existing pack.
 * The procedural generator that used to own every level is still available as
 * `npm run levels:generate:procedural`, but running it over 3-500 would replace the
 * approved designs.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {packLevel, unpackLevel} from '../src/game/levels/codec.ts';
import type {LevelPack} from '../src/game/levels/codec.ts';
import type {ArrowPath, Band, Direction, Level} from '../src/game/models/types.ts';
import {computeParTime, validate} from '../src/game/engine/LevelValidator.ts';
import {createRng, hashSeed} from '../src/utils/rng.ts';
import {assignColours} from './pipeline/colorise.ts';
import {DIFFICULTY_CEILING} from './pipeline/plan.ts';

const PACK_SIZE = 25;
const TOTAL_LEVELS = 500;
export const FIRST_MOCK_LEVEL = 3;
const ROOT = join(import.meta.dirname, '..');
const PACKS_DIR = join(ROOT, 'src', 'game', 'levels', 'packs');
export const MOCK_DATA_DIR = join(ROOT, 'mock', 'data');

export interface MockDoc {
  id: number;
  gridSize: number;
  tier: Band;
  title: string;
  symmetry: string;
  arrows: {cells: [number, number][]; direction: Direction}[];
}

export function readMock(id: number): MockDoc {
  return JSON.parse(
    readFileSync(join(MOCK_DATA_DIR, `level_${String(id).padStart(3, '0')}.json`), 'utf8'),
  );
}

const packName = (packIndex: number): string => {
  const from = packIndex * PACK_SIZE + 1;
  const to = from + PACK_SIZE - 1;
  return `pack_${String(from).padStart(3, '0')}_${String(to).padStart(3, '0')}.json`;
};

/** "Rose of Twelve" -> "rose-of-twelve"; the theme field is an identifier, not a caption. */
const slug = (title: string): string =>
  title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function levelFromMock(doc: MockDoc): Level {
  const arrows: ArrowPath[] = doc.arrows.map((a, i) => ({
    id: `a${i}`,
    color: 'blue',
    cells: a.cells.map(([x, y]) => ({x, y})),
    direction: a.direction,
  }));
  const colours = assignColours(arrows, doc.gridSize, createRng(hashSeed(`colour:${doc.id}`)));
  arrows.forEach((a, i) => (a.color = colours.colors[i]));

  const result = validate({gridSize: doc.gridSize, arrows});
  if (!result.solvable || result.errors.length > 0) {
    throw new Error(`level ${doc.id}: approved mock does not validate: ${result.errors.join('; ') || 'unsolvable'}`);
  }
  // §3.1 caps the stored D at 7. The 400s measure above that on the raw formula; they
  // are the hardest boards in the game either way, and D only feeds par time and the
  // dev overlay.
  const difficulty = Math.min(DIFFICULTY_CEILING, Math.round(result.difficulty * 100) / 100);
  return {
    id: doc.id,
    gridSize: doc.gridSize,
    theme: slug(doc.title),
    band: doc.tier,
    difficulty,
    parTime: computeParTime(arrows.length, difficulty),
    arrows,
  };
}

function main(): void {
  const firstPack: LevelPack = JSON.parse(readFileSync(join(PACKS_DIR, packName(0)), 'utf8'));
  const tutorial = new Map(firstPack.levels.filter(l => l.id < FIRST_MOCK_LEVEL).map(l => [l.id, l]));
  if (tutorial.size !== FIRST_MOCK_LEVEL - 1) {
    throw new Error('pack 1 is missing the tutorial levels 1-2');
  }

  const packs: LevelPack[] = [];
  for (let p = 0; p * PACK_SIZE < TOTAL_LEVELS; p++) {
    packs.push({v: 1, from: p * PACK_SIZE + 1, to: (p + 1) * PACK_SIZE, levels: []});
  }
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    const packed = id < FIRST_MOCK_LEVEL ? tutorial.get(id)! : packLevel(levelFromMock(readMock(id)));
    // Round-trip through the codec so what is written is exactly what the app reads.
    const back = unpackLevel(packed);
    if (id >= FIRST_MOCK_LEVEL && back.arrows.length !== readMock(id).arrows.length) {
      throw new Error(`level ${id}: codec round-trip changed the arrow count`);
    }
    packs[Math.floor((id - 1) / PACK_SIZE)].levels.push(packed);
  }
  let bytes = 0;
  packs.forEach((pack, p) => {
    const text = `${JSON.stringify(pack)}\n`;
    bytes += text.length;
    writeFileSync(join(PACKS_DIR, packName(p)), text, 'utf8');
  });
  console.log(`wrote ${packs.length} packs, ${TOTAL_LEVELS} levels, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

if (process.argv[1]?.endsWith('levelsFromMocks.ts')) {
  main();
}
