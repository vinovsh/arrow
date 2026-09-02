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

Levels are generated offline and committed as data; the app never generates a level at
runtime. Regenerating is reproducible from `(shape, gridSize, seed)`, so the same
command always produces the same 500 boards.

```bash
npm run levels:generate                      # all 500, about 90 seconds
npm run levels:generate -- --from 101 --to 150   # one band, rewriting only its packs
npm run levels:validate
npm run levels:curve
```

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
  components/   Button, Panel, StarRow, Hearts, HintPill, CoachMark, Confetti,
                Ribbon, Toggle, FitButton, Wordmark, and the five overlays
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
- **Rendering is tiered by arrow count** (`renderTierFor`). Above 60 arrows every
  arrow's glow collapses into one baked underlay; above 40, idle breathing stops.
- **The dot grid is a single `<Path>`.** 196 dots as individual nodes blows the frame
  budget before an arrow is drawn.
- **Audio does not ship yet.** `AudioService` is wired to the whole §14 event table and
  no-ops on missing files, so the game plays silently. See `assets/audio/LICENSES.md`.

## Where the spec and the implementation disagree

Three §7.2/§3.1 tensions surfaced during level generation and are resolved in code with
the reasoning recorded at the site:

- **`freeMinCount` is measured over the decision phase**, not literally over every
  state. Every solve ends with one free arrow, so the literal reading pins the signal
  to 1 on every level ever generated and makes §8.3's `freeMinCount ≥ 3` gate
  unsatisfiable. See `LevelValidator.ts`.
- **Slot targets are anchored to a measured per-grid floor**, not to §4.1's absolute
  band averages. §7.2's D cannot score below roughly 2.2 on any real 5×5 board, so a
  target of 1.0 is unreachable and drives every level to the floor. See
  `MEASURED_FLOOR` in `tools/pipeline/plan.ts`.
- **§3.1's "three levels at blockAvg − 1.5" is not reachable everywhere.** Each band's
  average sits within 1.5 of its own floor, so the gap does not exist to use.
  `curveReport` scores both the literal rule and what was achieved, and the §7.2 refit
  the spec already calls for after playtest is what would widen it.
