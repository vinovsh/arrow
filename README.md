# Arrow Escape

An offline, single-player, score-based tap puzzle for Android. Coloured arrow paths are
packed onto a dotted grid so they collectively form a recognisable picture. Tapping an
arrow slides its whole path off the board in the direction its head points — but only
if nothing blocks the way. Clear the board to finish the level.

React Native CLI + TypeScript. **Not Expo**, and nothing `expo-*` may enter the
dependency graph, including transitively (`__tests__/packaging.test.ts` enforces this).

The full specification is `ref/ARROW_ESCAPE_REQUIREMENTS_v3.md`. Section references
throughout the source (`§4.2`, `§9.4`, …) point into it.

---

## Running it

```bash
npm install
npm start            # Metro
npm run android      # build and install a debug APK
```

## Verifying it

```bash
npm run verify       # typecheck + lint + tests + level validation
```

Individually:

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc` over the app and, separately, over the build-time pipeline |
| `npm run lint` | ESLint |
| `npm test` | Jest — 100 tests, including a full play-through check of all 500 levels |
| `npm run levels:validate` | §8.4's CI gate over the committed packs |
| `npm run levels:curve` | The achieved difficulty curve against the plan |
| `npm run levels:contactsheet` | §8.6's human review sheet, into `tools/out/` |
| `npm run shapes:preview -- 12` | ASCII preview of the shape library at a grid size |

## Regenerating levels

Levels are built offline and committed as data; the app never generates a level at
runtime. Levels 3-500 are approved designs: each was reviewed as an image
(`mock/level_NNN.png`) and is shipped exactly as drawn from `mock/data/level_NNN.json`.
Levels 1-2 are the drawn tutorial boards.

```bash
npm run levels:generate                 # packs from the approved mocks, about 2 seconds
npm run levels:validate                 # fails if any pack drifts from its approved mock
npm run mock:build -- --from 501 --to 550   # design new boards (after adding plan rows)
npm run mock:render -- 501 550              # images for review
npm run levels:generate:procedural      # the old procedural generator; overwrites 3-500
```

The mock tooling lives in `tools/mock/`: `patterns.ts` holds the hand-drawn pictures and
plan for 3-200, `families.ts` and `plan201.ts` the parametric families for 201-500.
Every mock board is solvable by construction and re-proven by the shipped validator.
The section below describes the procedural pipeline, which now only builds the tutorial
levels.

---

## How the level pipeline works

`tools/` runs on Node's native TypeScript support and imports the app's own engine
(`tools/register.mjs` supplies the resolution hook), so the generator and the game
agree on what "solvable" means by construction rather than by convention.

1. **Mask** (`pipeline/mask.ts`) — a shape from `tools/shapes/library.ts` is rasterised
   at the slot's grid size and reshaped to the exact cell count the slot needs, one
   boundary cell at a time, keeping the silhouette connected.
2. **Decomposition** (`pipeline/decompose.ts`) — the mask is carved into 1–8 cell paths
   matching the band's length mix. Lengths are allocated by largest-remainder quota
   rather than sampled, then a merge/split repair pass drives the carve back onto that
   multiset.
3. **Orientation** (`pipeline/orient.ts`) — the search space is `4^k · 2^(n−k)`, which
   is hopeless by brute force at n = 90. The way through is that **orientation never
   changes which cells a path occupies**, only where its head points. Occupancy is
   therefore fixed before the search starts, so a solvable assignment can be
   *constructed*: peel paths one at a time, giving each a direction whose corridor is
   clear of whatever is still on the board. The peel order is a valid solve order by
   construction. Annealing over single-arrow flips then steers difficulty, rejecting
   any move that breaks solvability.
4. **Validation** (`src/game/engine/LevelValidator.ts`) — monotonicity (§2.3) makes a
   greedy pass a *proof*, not a heuristic: removing an arrow only ever frees cells, so
   a board that empties greedily is solvable from every reachable state.
5. **Packing** — 25 levels per JSON pack, aligned to the level-select pager. 660KB for
   the set; three packs stay resident and the rest are dropped.

## Project layout

```
src/
  app/          App.tsx, featureFlags.ts
  navigation/   RootNavigator.tsx, types.ts
  screens/      Splash, Home, LevelSelection, Game, Settings, HowToPlay
  components/   Button, Panel, StarRow, Hearts, HintPill, CoachMark, GuideHand,
                Confetti, Ribbon, Toggle, FitButton, Wordmark, and the five overlays
  game/
    engine/     GameEngine, CollisionDetector, LevelValidator, ScoreManager,
                HintService, HitTester
    models/     types.ts
    renderer/   Board, BoardViewport, ArrowRenderer, DotGrid, DecorLayer,
                ParticleSystem, arrowGeometry
    tutorial/   TutorialController, steps
    levels/     packs/*.json, codec, index (lazy loader)
  storage/      SaveStore, migrations
  audio/        AudioService
  haptics/      HapticService
  theme/        theme, typography
  utils/        math, layout, rng
tools/          generateLevels, validateLevels, curveReport, renderContactSheet,
                previewShapes, pipeline/, shapes/
__tests__/      engine, validator, score, hitTest, levels, storage, tutorial, packaging
```

## Things worth knowing before changing them

- **Game state never lives in React state.** `GameEngine` is held in a ref;
  viewport state lives entirely in Reanimated shared values on the UI thread.
- **Zoom transforms the container view, not the SVG.** No SVG work happens during a
  gesture. One debounced re-render, 120ms after the gesture settles and only above
  1.5×, restores crispness (§5.5, §13).
- **An arrow is a line, not a pipe, and it has exactly one colour.** Two paths per
  arrow — a stroke and a filled triangle, both `theme.board.ink` — and nothing
  underneath. The glow, casing and gloss are gone, and so is `arrow.color`: the data
  still carries a palette and nothing reads it. On a maze of interlocking paths the
  only separator that works is the white page between them, which is why
  `strokeWidthFor(cellSize)` is 19% of a cell. That ratio and the arrowhead's
  (`HEAD_LENGTH_RATIO`, `HEAD_HALF_WIDTH_RATIO`) are all measured off the reference
  screenshots in `ref/Arrow`, not chosen.
- **A small board does not fill the screen.** `computeBoardMetrics` divides by
  `max(gridSize, FULL_WIDTH_GRID)`, so a 6×6 draws at the same cell size as a 17×17
  and simply sits small in the middle of the page. Fitting it to the width instead is
  what turned the tutorial levels into three enormous pipes.
- **The game screen is the app's one light surface.** `theme.board` belongs to it and
  nothing else; Home, Level Select and Settings are still dark.
- **Touch targets are unrelated to what is drawn.** `HIT_RADIUS_DP` is 44dp around a
  3-7dp line, because hit-testing is by proximity to the centreline (§4.4). Thinning
  the arrows cost nothing here, and nothing here constrains how thin they can get.
- **Rendering is no longer tiered.** `renderTierFor` returns one shared object.
  There used to be a layer count, a glow scale and a baked-underlay flag above 60
  arrows; all three described a five-layer arrow, and a two-path arrow makes the
  densest board cheaper than a 40-arrow one used to be. Idle breathing is off
  everywhere, for the reason recorded on the flag.
- **The dot grid is a single `<Path>`, and it only marks cells a path runs through.**
  A 22×22 board is 484 dots; as individual nodes that alone blows the frame budget
  before an arrow is drawn. The dots are also not a sheet of graph paper under the
  board: the reference shows none at all on its level 1 until an arrow leaves, and
  then exactly the six cells it vacated (`ref/Arrow`, 210909 and 210919). A dot is the
  ghost of a path, which is what lets a small board read as a few lines on a blank
  page. Above the tutorial every dot is covered by the arrow drawn over it anyway.
- **Path length has one home, `MAX_PATH_CELLS` in `src/game/models/types.ts`.** The
  carver and the runtime structural validator both read it. They held separate copies
  once, and widening the carver turned 2,840 legal paths into fatal errors.
- **An escaping arrow travels to the viewport's clip, not to the board edge**, and
  never fades. `BoardViewport` clips, and the board is centred inside it, so those two
  edges are ~100dp apart top and bottom — an arrow retired at the board edge is
  retired in full view. `EscapingArrow` takes a `clearance` prop because only the
  screen can measure that gap.
- **Hit slop is capped in cell units, not just in dp.** 22dp of slop is one and a half
  cells on a 22×22 board, which reaches the neighbouring path; `MAX_HIT_RADIUS_CELLS`
  keeps an ambiguous tap resolving to nothing rather than to the wrong arrow.
- **Audio does not ship yet.** `AudioService` is wired to the whole §14 event table and
  no-ops on missing files, so the game plays silently. See `assets/audio/LICENSES.md`.
- **The coach-mark hand is a third-party icon** — Font Awesome Free's `hand-pointer`,
  embedded as path data in `src/components/GuideHand.tsx`. It is CC BY 4.0, so it
  needs a visible credit before release; `assets/art/LICENSES.md` records the licence
  and what still has to happen.

## Where the spec and the implementation disagree

Three §7.2/§3.1 tensions surfaced during level generation and are resolved in code with
the reasoning recorded at the site:

- **`freeMinCount` is measured over the decision phase**, not literally over every
  state. Every solve ends with one free arrow, so the literal reading pins the signal
  to 1 on every level ever generated and makes §8.3's `freeMinCount ≥ 3` gate
  unsatisfiable. See `LevelValidator.ts`.
- **Slot targets are anchored to a measured floor**, not to §4.1's absolute band
  averages. §7.2's D cannot score below roughly 2.0 on any real board, so a target of
  1.0 is unreachable and drives every level to the floor. The floor is per grid size
  for levels 11-500 (`MEASURED_FLOOR`) and per level for the ten onboarding boards
  (`ONBOARDING_FLOOR`), which share grid sizes with bands carrying entirely different
  arrow counts. Both are in `tools/pipeline/plan.ts`.
- **§4.1's grid and arrow columns are re-cut below level 11, against `ref/Arrow`.**
  The published table opened at 8-12 arrows on an 8×8 by level 5; the reference's
  level 5 is 36 arrows and its level 10 is 86. Levels 1-10 are now one row each — a
  scripted ramp rather than a band, which is how the reference treats them too — and
  their arrow counts are read off the counter in those screenshots. Mean path length
  roughly doubled to pay for it, since `cells = arrows × length` and the mask has to
  hold them. **Levels 11-500 are untouched**: ten boards is all the reference shows,
  and widening the refit means regenerating 490 levels and reviewing the contact sheet
  again. See `BAND_TABLE` and `meanLengthFor` in `tools/pipeline/plan.ts`.
- **Level 2 is the generated board with its left corner re-carved.** The carver left a
  single-cell path there — a lone arrowhead with no body behind it — sealed in a
  pocket the 12-cell arrow wrapped around, so the neighbour gives up the left column:
  it now starts at (1,1) and keeps the rest of its route, and the stub becomes the
  column below the corner arrow, five cells pointing off the bottom edge. Down rather
  than left, because a left-pointing head at (0,2) can only be fed from a cell that is
  mid-path for the neighbour. Every head still leaves the board directly, which is
  what §6's "Any order works" needs. The board is pinned in `handcrafted.ts` for the
  same reason level 1 is: regenerating would otherwise put the stub back.
- **Level 1 is drawn by hand, not generated.** `tools/pipeline/handcrafted.ts` holds
  the board and `generateLevel` returns it before the search runs. It is the first
  thing a player ever sees and the reference treats it as a diagram: three 6-cell
  columns on a 7-wide grid, two pointing up and one down, one empty column between
  each pair. The generator can draw three paths on a small grid but not *those* three,
  and a tutorial board that changes shape whenever the carver is retuned is one whose
  coach mark has to be re-aimed every time. Its slot in `BAND_TABLE`, its
  `ONBOARDING_FLOOR` entry and the §4.1 row in `__tests__/levels.test.ts` all describe
  that drawing rather than constrain it, and `validateLevels` skips the path-length
  mix rule for it — a drawn board has no carver output to audit.
- **Levels 2-9 have no silhouette.** They are carved out of a rectangular region of
  the grid (`BLOCK_SHAPE`, punched through with interior gaps by `poreCandidates`);
  the picture arrives at level 10, the first showcase. That is the reference's own
  split — its levels 5, 7, 8 and 9 are plain fields and the picture is the reward for
  reaching 10. Every level above 10 still draws a silhouette as it always has.
- **The onboarding levels have their own difficulty floors**, per level rather than
  per grid (`ONBOARDING_FLOOR`). Levels 5-10 share grid sizes with bands hundreds of
  levels above them that carry entirely different arrow counts, so one floor cannot
  describe both, and correcting the shared entry would move the targets of 400 levels
  that were not regenerated.
- **§3.1's "three levels at blockAvg − 1.5" is not reachable everywhere.** Each band's
  average sits within 1.5 of its own floor, so the gap does not exist to use.
  `curveReport` scores both the literal rule and what was achieved, and the §7.2 refit
  the spec already calls for after playtest is what would widen it.
