# Arrow Escape: 500-level campaign

The approved levels 1–20 are preserved byte-for-byte in `fixtures/approved-first-20.json` and are included in the first runtime pack. The campaign adds 480 independently carved layouts and ships twenty complete packs of 25 levels. Level selection opens at saved progress and supports Previous/Next pages; completion unlocks the next level across every pack boundary.

## Design progression

| Levels | Band | Grid range | Minimum blocking chain | Minimum initially blocked |
| --- | --- | --- | --- | --- |
| 21–100 | Very Hard | 30–34 | 12 | 78% |
| 101–180 | Expert | 32–36 | 14 | 79.4% |
| 181–260 | Expert | 34–38 | 16 | 80.8% |
| 261–340 | Expert+ | 36–40 | 18 | 82.2% |
| 341–420 | Expert+ | 38–42 | 20 | 83.6% |
| 421–500 | Master | 40–42 | 22 | 85% |

Every 25th new level requires two extra steps of blocking-chain depth. Ten shape families cycle through independently seeded square weaves, rounded squares, diamonds, circles, twin chambers, four chambers, crosses, open courtyards, stepped fortresses and rings. Grids grow in waves to provide variety rather than repeating a single silhouette.

Each new board mixes at least 20% short, 25% medium and 25% long arrows, with long arrows capped at 50% of the count. Paths contain 4–64 cells and average at least 12; at least 90% of the playable shape is covered. There are no decorative overlays, isolated arrowheads, overlapping paths or heads pointing into their own bodies. Labels follow measured blocking and dependency gates. Runtime difficulty scores and par times are recalculated by the existing validator.

## Reproduction and validation

- `npm run levels:generate`: deterministic generation from `campaign-500-v1:<id>:<attempt>` seeds. `RESUME=1` reuses local checkpoints; full campaign validation is required after generation.
- `npm run levels:validate`: validates the approved first 20 and all 500 runtime boards. It checks pack boundaries, complete ID coverage, structural validity, solvability, shape/length/difficulty gates, and uniqueness across all rotations/reflections; it runs 20 random legal playthroughs per board.
- `node --import ./tools/register.mjs tools/renderCampaignSample.ts`: renders twelve sample boards using the actual runtime arrow geometry, saved as `mock/campaign-500-overview.svg`.
- `campaign-500-report.json`: measured signals and accepted seed attempt for every new level.

Validation completed: 179 automated tests, 10,000 campaign random playthroughs plus the 600 approved-board checks, TypeScript, lint and Android Metro bundling. The puzzle engine, approved level-screen UI, slower arrow escape speed and Glassy Glide audio are retained.
