import {MOCK_PLAN as BASE, rasterisePattern} from './patterns.ts';
import {PLAN_201} from './plan201.ts';
const MOCK_PLAN = [...BASE, ...PLAN_201];
const ids = process.argv.slice(2).map(Number);
for (const plan of MOCK_PLAN) {
  if (ids.length && !ids.includes(plan.id)) {continue;}
  const m = rasterisePattern(plan.pattern, plan.grid, plan.id > 50);
  const c = m.flat().filter(Boolean).length;
  console.log(`L${plan.id} ${plan.title} ${plan.grid} fill=${Math.round(100 * c / plan.grid ** 2)}%`);
  if (ids.length) {for (const r of m) {console.log(r.map(v => v ? '#' : '.').join(''));}}
}
