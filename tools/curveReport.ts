/**
 * Difficulty curve report (§4, §3.1).
 *
 *   node --import ./tools/register.mjs tools/curveReport.ts
 *
 * Prints the achieved curve against the plan, block by block, and checks the §3.1
 * rhythm rules on the *achieved* D rather than on the targets — the rules are about
 * what the player feels, so they have to hold for the boards that actually shipped.
 */
import {loadAllLevels} from './validateLevels.ts';
import {
  planLevel,
  isMilestone,
  isShowcase,
  DIFFICULTY_CEILING,
} from './pipeline/plan.ts';
import type {Level} from '../src/game/models/types.ts';

interface BlockCheck {
  block: number;
  from: number;
  to: number;
  avg: number;
  /** Levels at blockAvg - 1.5 or lower — §3.1 read literally. */
  easyCount: number;
  /** Levels in the block's easiest tier, whatever gap the formula actually allows. */
  restCount: number;
  /** How far below the block average its easiest level actually sits. */
  deepestRest: number;
  spikeCount: number;
  consecutiveSpikes: boolean;
  showcaseIsEasy: boolean;
}

/**
 * §3.1 wants three levels per block at blockAvg - 1.5 or lower. That magnitude is not
 * always reachable: §7.2's D has a per-grid floor (see MEASURED_FLOOR in plan.ts), and
 * every band average sits within 1.5 of its own floor, so the gap simply does not
 * exist to be used. What the rule is *for* — three genuine rests per block — is
 * reachable, so the report scores both: the literal test, and the count of levels in
 * the block's easiest tier alongside the gap actually achieved.
 */
const REST_TIER_GAP = 0.75;

/** §3.1, measured on achieved D within each block of ten. */
export function checkBlocks(levels: readonly Level[]): BlockCheck[] {
  const checks: BlockCheck[] = [];
  for (let start = 0; start < levels.length; start += 10) {
    const block = levels.slice(start, start + 10);
    if (block.length === 0) {
      continue;
    }
    const avg = block.reduce((sum, l) => sum + l.difficulty, 0) / block.length;
    const easy = block.filter(l => l.difficulty <= avg - 1.5);
    const rests = block.filter(l => l.difficulty <= avg - REST_TIER_GAP);
    const lowest = Math.min(...block.map(l => l.difficulty));
    const spikes = block.map(l => l.difficulty >= avg + 1.0);
    let consecutive = false;
    for (let i = 1; i < spikes.length; i++) {
      if (spikes[i] && spikes[i - 1]) {
        consecutive = true;
      }
    }
    const showcase = block.find(l => isShowcase(l.id) && !isMilestone(l.id));
    checks.push({
      block: start / 10 + 1,
      from: block[0].id,
      to: block[block.length - 1].id,
      avg,
      easyCount: easy.length,
      restCount: rests.length,
      deepestRest: avg - lowest,
      spikeCount: spikes.filter(Boolean).length,
      consecutiveSpikes: consecutive,
      showcaseIsEasy: showcase ? showcase.difficulty < avg : true,
    });
  }
  return checks;
}

function histogram(values: readonly number[], buckets = 10): string {
  const counts = new Array(buckets).fill(0);
  for (const value of values) {
    const at = Math.min(buckets - 1, Math.max(0, Math.floor(value - 1)));
    counts[at]++;
  }
  const peak = Math.max(...counts, 1);
  return counts
    .map((count, i) => {
      const bar = '#'.repeat(Math.round((count / peak) * 40));
      return `  D ${i + 1}-${i + 2}  ${String(count).padStart(4)}  ${bar}`;
    })
    .join('\n');
}

function main(): void {
  const levels = loadAllLevels();

  console.log('=== achieved vs planned, per band ===');
  const bands = new Map<string, Level[]>();
  for (const level of levels) {
    const list = bands.get(level.band) ?? [];
    list.push(level);
    bands.set(level.band, list);
  }
  for (const [band, list] of bands) {
    const avgD = list.reduce((s, l) => s + l.difficulty, 0) / list.length;
    const avgTarget =
      list.reduce((s, l) => s + planLevel(l.id).targetD, 0) / list.length;
    const avgN = list.reduce((s, l) => s + l.arrows.length, 0) / list.length;
    const avgPar = list.reduce((s, l) => s + l.parTime, 0) / list.length;
    console.log(
      `${band.padEnd(11)} ${String(list.length).padStart(3)} levels  ` +
        `n ${avgN.toFixed(1).padStart(5)}  ` +
        `D ${avgD.toFixed(2).padStart(5)} (planned ${avgTarget.toFixed(2)})  ` +
        `par ${avgPar.toFixed(0).padStart(4)}s`,
    );
  }

  console.log('\n=== difficulty distribution ===');
  console.log(histogram(levels.map(l => l.difficulty)));
  const max = Math.max(...levels.map(l => l.difficulty));
  console.log(`  max D ${max.toFixed(2)} (ceiling ${DIFFICULTY_CEILING})`);

  console.log('\n=== §3.1 rhythm, measured on achieved D ===');
  const checks = checkBlocks(levels);
  const badEasy = checks.filter(c => c.easyCount < 3);
  const badRest = checks.filter(c => c.restCount < 3);
  const badSpike = checks.filter(c => c.spikeCount > 2);
  const badConsecutive = checks.filter(c => c.consecutiveSpikes);
  const badShowcase = checks.filter(c => !c.showcaseIsEasy);
  const deepest = checks.map(c => c.deepestRest);
  console.log(`  blocks: ${checks.length}`);
  console.log(`  blocks with fewer than 3 rests       : ${badRest.length}`);
  console.log(`  blocks with more than 2 spikes       : ${badSpike.length}`);
  console.log(
    `  blocks with consecutive spikes       : ${badConsecutive.length}`,
  );
  console.log(`  showcases not below their block avg  : ${badShowcase.length}`);
  console.log(
    `  deepest rest per block: min ${Math.min(...deepest).toFixed(2)}, ` +
      `mean ${(deepest.reduce((a, b) => a + b, 0) / deepest.length).toFixed(
        2,
      )}, ` +
      `max ${Math.max(...deepest).toFixed(2)} below block average`,
  );
  console.log(
    '  §3.1 literal test (3 levels at blockAvg-1.5): ' +
      `${checks.length - badEasy.length}/${checks.length} blocks pass`,
  );
  if (badEasy.length > 0) {
    console.log(
      '    Not reachable everywhere: §7.2 floors D per grid size, and every §4.1 band\n' +
        '    average sits within 1.5 of its own floor, so the gap does not exist to use.\n' +
        '    Refit the §7.2 weights (the spec asks for this after playtest) to widen it.',
    );
  }
  for (const c of [...badRest, ...badSpike, ...badConsecutive].slice(0, 8)) {
    console.log(
      `    block ${c.block} (${c.from}-${c.to}) avg ${c.avg.toFixed(2)} ` +
        `rests ${c.restCount} spikes ${c.spikeCount}` +
        `${c.consecutiveSpikes ? ' CONSECUTIVE' : ''}`,
    );
  }

  console.log('\n=== path-length mix, achieved ===');
  const lengthTotals = new Array(8).fill(0);
  let arrows = 0;
  for (const level of levels) {
    for (const arrow of level.arrows) {
      lengthTotals[arrow.cells.length - 1]++;
      arrows++;
    }
  }
  console.log(
    lengthTotals
      .map(
        (count, i) => `  len ${i + 1}: ${((count / arrows) * 100).toFixed(1)}%`,
      )
      .join('\n'),
  );

  console.log('\n=== shape usage ===');
  const shapes = new Map<string, number>();
  for (const level of levels) {
    shapes.set(level.theme, (shapes.get(level.theme) ?? 0) + 1);
  }
  const sorted = [...shapes.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    `  ${shapes.size} distinct silhouettes, ` +
      `most used ${sorted[0][0]} (${sorted[0][1]}), ` +
      `least used ${sorted[sorted.length - 1][0]} (${
        sorted[sorted.length - 1][1]
      })`,
  );

  const bytes = JSON.stringify(levels).length;
  console.log(
    `\n=== size ===\n  ${(bytes / 1024 / 1024).toFixed(2)} MB unpacked JSON`,
  );
}

main();
