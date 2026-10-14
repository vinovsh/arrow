/** Campaign review sheet rendered with the exact app arrow geometry. */
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {unpackLevel, type LevelPack} from '../src/game/levels/codec.ts';
import {buildArrowGeometry} from '../src/game/renderer/arrowGeometry.ts';
const root = join(import.meta.dirname, '..');
const ids = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 250, 500],
  tiles: string[] = [];
for (const [i, id] of ids.entries()) {
  const first = Math.floor((id - 1) / 25) * 25 + 1,
    last = first + 24;
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
  const level = unpackLevel(pack.levels.find(l => l.id === id)!);
  const cell = 370 / level.gridSize,
    x = (i % 4) * 430 + 24,
    y = Math.floor(i / 4) * 470 + 120;
  const paths = level.arrows
    .map(a => {
      const g = buildArrowGeometry(a, cell);
      return `<path d="${g.body}" stroke="#18234B" stroke-width="${g.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${g.head}" fill="#18234B"/>`;
    })
    .join('');
  tiles.push(
    `<g transform="translate(${x} ${y})"><rect width="406" height="446" rx="18" fill="white"/><text x="18" y="30" font-size="17" font-weight="bold">Level ${id} · ${level.theme}</text><text x="18" y="55" font-size="14" fill="#516A90">${level.band} · ${level.arrows.length} arrows</text><g transform="translate(18 70)">${paths}</g></g>`,
  );
}
writeFileSync(
  join(root, 'mock/campaign-500-overview.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1744" height="1546" viewBox="0 0 1744 1546"><rect width="1744" height="1546" fill="#EFFAFF"/><g font-family="DejaVu Sans,sans-serif" fill="#102451"><text x="28" y="45" font-size="28" font-weight="bold">Arrow Escape · 500-level campaign</text><text x="28" y="81" font-size="18" fill="#516A90">Twelve real boards · Ten new pattern families · Mixed arrow lengths · Approved first 20 preserved</text>${tiles.join(
    '',
  )}</g></svg>\n`,
);
console.log('Campaign sample sheet rendered with runtime geometry.');
