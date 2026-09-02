/**
 * Prints every silhouette as ASCII at a given grid size, side by side, so the shape
 * library can be eyeballed without a render pass. Run:
 *   npm run shapes:preview -- 14
 */
import {countCells, maskToStrings, rasterise} from './shapes/dsl.ts';
import {SHAPES} from './shapes/library.ts';

const gridSize = Number(process.argv[2] ?? 14);
const threshold = Number(process.argv[3] ?? 0.5);
const perRow = gridSize > 10 ? 4 : 6;

const usable = SHAPES.filter(s => s.minGrid <= gridSize);
console.log(
  `${usable.length} shapes at ${gridSize}x${gridSize} (threshold ${threshold}), ` +
    `${gridSize * gridSize} cells per board\n`,
);

for (let i = 0; i < usable.length; i += perRow) {
  const group = usable.slice(i, i + perRow);
  const rendered = group.map(s => {
    const mask = rasterise(s.ops, gridSize, threshold);
    return {name: s.name, rows: maskToStrings(mask), cells: countCells(mask)};
  });
  const header = rendered
    .map(r => `${r.name} (${r.cells})`.padEnd(gridSize + 3))
    .join(' ');
  console.log(header);
  for (let row = 0; row < gridSize; row++) {
    console.log(rendered.map(r => r.rows[row].padEnd(gridSize + 3)).join(' '));
  }
  console.log('');
}
