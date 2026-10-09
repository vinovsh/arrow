/** Render review boards through the same geometry functions used by the app. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {unpackLevel} from '../src/game/levels/codec.ts';
import type {LevelPack} from '../src/game/levels/codec.ts';
import {buildArrowGeometry} from '../src/game/renderer/arrowGeometry.ts';
const root = join(import.meta.dirname, '..');
const pack = JSON.parse(
  readFileSync(join(root, 'src/game/levels/packs/pack_001_020.json'), 'utf8'),
) as LevelPack;
mkdirSync(join(root, 'mock/previews'), {recursive: true});
for (const packed of pack.levels) {
  const level = unpackLevel(packed),
    cell = 420 / level.gridSize;
  const paths = level.arrows
    .map(a => {
      const g = buildArrowGeometry(a, cell);
      return `<path d="${g.body}" fill="none" stroke="#061242" stroke-width="${g.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/><path d="${g.head}" fill="#061242"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="460" viewBox="-20 -20 460 460"><title>Level ${level.id}: ${level.theme}, ${level.band}</title><rect x="-20" y="-20" width="460" height="460" fill="white"/>${paths}</svg>`;
  writeFileSync(
    join(root, `mock/previews/level_${String(level.id).padStart(3, '0')}.svg`),
    svg + '\n',
  );
}
console.log('20 exact-geometry SVG previews rendered.');
