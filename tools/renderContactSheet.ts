/**
 * §8.6 — the human review gate.
 *
 *   node --import ./tools/register.mjs tools/renderContactSheet.ts [--from 1] [--to 500]
 *
 * Automated validation cannot judge whether a board still looks like a cat, so one
 * render per shape per grid size is produced for a human to review at 320dp scale
 * before a pack ships. Rejections go back to stage 2 with a new seed or a revised mask.
 *
 * The spec asks for PNGs; nothing in this project's dependency set can rasterise, and
 * pulling in a headless browser to make pictures of vectors would be the wrong trade.
 * The sheet is written as one self-contained SVG-per-board HTML file instead, which
 * opens in any browser, prints, and — unlike a PNG — can be zoomed to check a 14x14
 * board without resampling.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Level} from '../src/game/models/types.ts';
import {theme} from '../src/theme/theme.ts';
import {buildArrowGeometry} from '../src/game/renderer/arrowGeometry.ts';
import {dotRadiusFor} from '../src/utils/layout.ts';
import {loadAllLevels} from './validateLevels.ts';
import {planLevel} from './pipeline/plan.ts';

/** §8.6 — reviewed at 320dp scale, so that is what the sheet renders at. */
const REVIEW_WIDTH_DP = 320;
const OUT_DIR = join(import.meta.dirname, 'out');

function arg(name: string, fallback: number): number {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1]
    ? Number(process.argv[at + 1])
    : fallback;
}

function boardSvg(level: Level, sizePx: number): string {
  const cellSize = sizePx / level.gridSize;
  const parts: string[] = [];

  // Dots go under the path cells only, as the app draws them — see DotGrid.
  let dots = '';
  const radius = dotRadiusFor(cellSize);
  for (const arrow of level.arrows) {
    for (const cell of arrow.cells) {
      const cx = (cell.x + 0.5) * cellSize;
      const cy = (cell.y + 0.5) * cellSize;
      dots +=
        `M ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} ` +
        `a ${radius} ${radius} 0 1 0 ${(radius * 2).toFixed(2)} 0 ` +
        `a ${radius} ${radius} 0 1 0 ${(-radius * 2).toFixed(2)} 0 `;
    }
  }
  parts.push(`<path d="${dots}" fill="${theme.board.dot}"/>`);

  if (level.decor) {
    const inner = level.decor
      .map(
        d =>
          `<path d="${d.d}" fill="${d.fill ? theme.board.ink : 'none'}" ` +
          `stroke="${d.fill ? 'none' : theme.board.ink}" stroke-width="${
            d.w ?? 0.03
          }" ` +
          'stroke-linecap="round" stroke-linejoin="round"/>',
      )
      .join('');
    parts.push(`<g opacity="0.7" transform="scale(${sizePx})">${inner}</g>`);
  }

  // §10.2 — one ink, two paths per arrow, and nothing under them. `arrow.color` is
  // not read here for the same reason the app does not read it: the board is one
  // drawing, and the separation between two paths running side by side is the white
  // page between them.
  for (const arrow of level.arrows) {
    const geometry = buildArrowGeometry(arrow, cellSize);
    if (geometry.body !== '') {
      parts.push(
        `<path d="${geometry.body}" stroke="${theme.board.ink}" ` +
          `stroke-width="${geometry.strokeWidth.toFixed(2)}" ` +
          'stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      );
    }
    parts.push(`<path d="${geometry.head}" fill="${theme.board.ink}"/>`);
  }

  return (
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" ` +
    `xmlns="http://www.w3.org/2000/svg"><rect width="${sizePx}" height="${sizePx}" ` +
    `rx="14" fill="${theme.board.bg}"/>${parts.join('')}</svg>`
  );
}

function main(): void {
  const from = arg('from', 1);
  const to = arg('to', 500);
  const levels = loadAllLevels().filter(l => l.id >= from && l.id <= to);
  mkdirSync(OUT_DIR, {recursive: true});

  // One render per shape per grid size is what §8.6 actually requires; rendering all
  // 500 would bury the reviewer in near-duplicates of the same silhouette.
  const seen = new Set<string>();
  const chosen: Level[] = [];
  for (const level of levels) {
    const key = `${level.theme}@${level.gridSize}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    chosen.push(level);
  }

  const cards = chosen
    .map(level => {
      const slot = planLevel(level.id);
      return (
        '<figure>' +
        boardSvg(level, REVIEW_WIDTH_DP) +
        `<figcaption><b>${level.theme}</b> ${level.gridSize}x${level.gridSize}` +
        `<br>level ${level.id} · ${level.band}` +
        `<br>n=${level.arrows.length} · D=${level.difficulty.toFixed(2)} ` +
        `(target ${slot.targetD.toFixed(2)}) · par ${level.parTime}s` +
        '</figcaption></figure>'
      );
    })
    .join('\n');

  const html =
    '<!doctype html><meta charset="utf-8"><title>Arrow Escape — contact sheet</title>' +
    `<style>body{background:#F4F5F8;color:${theme.board.title};` +
    'font:13px system-ui,sans-serif;margin:24px}' +
    'h1{font-size:18px;letter-spacing:2px}' +
    `p.note{color:${theme.board.chipText};max-width:60ch;line-height:1.5}` +
    '.grid{display:flex;flex-wrap:wrap;gap:22px;margin-top:20px}' +
    'figure{margin:0}' +
    `figcaption{margin-top:8px;color:${theme.board.chipText};line-height:1.5}` +
    'figure svg{box-shadow:0 1px 4px rgba(11,22,64,0.14);border-radius:14px}' +
    `b{color:${theme.board.title}}</style>` +
    '<h1>ARROW ESCAPE — CONTACT SHEET</h1>' +
    `<p class="note">${chosen.length} boards, one per shape per grid size, from levels ` +
    `${from}–${to}, rendered at ${REVIEW_WIDTH_DP}dp — the review scale §8.6 specifies. ` +
    'Check each one reads as its named object at this size, that single-cell arrows are ' +
    'clearly directional, and that two paths running side by side stay separable. ' +
    'Reject by sending the shape back ' +
    'to stage 2 with a new seed or a revised mask.</p>' +
    `<div class="grid">${cards}</div>`;

  const target = join(OUT_DIR, `contact-sheet-${from}-${to}.html`);
  writeFileSync(target, html, 'utf8');
  console.log(`wrote ${chosen.length} boards to ${target}`);
}

main();
