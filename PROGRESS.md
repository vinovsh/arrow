# Arrow Escape — progress

Last updated: 2026-09-23.

This is the working handoff note. `README.md` documents the project as built;
this file records where the work stopped and what to pick up next.

---

## State: playable end to end

All 500 levels generate, validate and play. The app builds, installs and runs on an
emulator, and a full loop has been walked through on device: tutorial coach mark →
tap arrows → win sequence → Score Summary → next level.

```
npm run verify     # typecheck + lint + tests + level validation
```

Last run (2026-09-23): clean. 12 suites, 158 tests, 500 levels validated, 0 fatal
issues, 0 warnings.

---

## Pick up here

**The launch screen was redrawn on 2026-09-25 after `ref/screens (2).png` panel 6**
(light gradient, glowing brain with ← → arrows, sparkles). It holds 5s (4 progress
dots fill), then goes to Home, or Level 1 on a fresh install. The headline/line under
the brain rotates through `src/config/quotes.ts`, one per app open, index kept under
its own AsyncStorage key. Not yet seen on a device.

**The level-complete overlay was redrawn the same day after `ref/reward model.png`
frame 4**: trophy + laurels, "Level N Completed!", stars from `assets/art/star.png`
(the owner's `ref/star.png`, scaled), a Score / Time / Best Time / Total Levels card
with "New!" badges, a quote card (`COMPLETE_QUOTES`) and
Next Level / Home. Best time is a new save field, `levelBestTimes` (migrates to `{}`).
Not yet seen on a device — check it fits on a short phone (it scrolls if not).

**Levels 3-500 were replaced on 2026-09-23 with the approved mock designs, and none of
the new boards has been on a screen.** The user asked for real progression (level 500
used to look like level 3), reviewed every design as an image first, and approved them
all. The images are `mock/level_NNN.png` plus one `mock/overview*.png` sheet per 50.

- **Where levels come from now.** `npm run levels:generate` runs
  `tools/levelsFromMocks.ts`, which copies each approved board from
  `mock/data/level_NNN.json` into the packs arrow for arrow and adds colour, band,
  stored D (capped at 7) and par time. Levels 1-2 (the drawn tutorial boards) are kept
  from the existing pack. The old procedural generator is still there as
  `npm run levels:generate:procedural`, but running it over 3-500 overwrites the
  approved designs.
- **Designing more.** The mocks come from `tools/mock/`: `patterns.ts` (the plan for
  3-200, drawn pictures), `families.ts` + `plan201.ts` (parametric families for
  201-500), `buildMocks.ts --from A --to B` (solvable boards) and `render.py A B`
  (images). `levels:validate` and `levels.test.ts` fail if a pack drifts from its mock.
- **What changed for the player.** Grids go 10 -> 40 (25-40 from 201, 35-40 in the
  400s), arrow counts 24 -> ~180 average (max 252, under the engine's 254 cap), and
  difficulty is mixed Easy/Medium/Hard/Very Hard rather than a staircase, with no Easy or
  Medium after 400. The level 6 win caption now says "Nice — it was lightning!" because
  the heart moved to level 5.
- **Open it and check:** level 3, 10, 50, 150, 300 and 500. Boards above 30 cells rely
  on pinch-zoom (up to 3.5x); the user said players will zoom. Render cost of a
  250-arrow SVG board on a real device is untested. Restart Metro with
  `--reset-cache` — the packs changed.

---

### Earlier notes (before the level redesign)

**Level 1, level 2's stub arrow and the coach mark were rebuilt against the reference
on 2026-09-22, and none of it has been on a screen.** The board is now the reference's own: three 6-cell
columns on a 7x7 — two up, one down, an empty column between each pair — drawn by hand
in `tools/pipeline/handcrafted.ts` rather than generated, and returned by
`generateLevel` before the search runs. Only level 1 moved; `npm run levels:validate`
is clean and down to 3 warnings, all of them pre-existing difficulty-window drift on
levels 167, 327 and 447.

Level 2 is otherwise untouched: it is the generated board with its left corner
re-carved. Its one single-cell arrow — a bare arrowhead, boxed in on three sides by
the 12-cell arrow and on the fourth by the board edge — keeps its column and gains a
five-cell body pointing off the bottom edge, and the 12-cell arrow gives up column 0
to make room. All five arrows still start free, which is what its "Any order works"
caption needs.

Three things to look at when it is opened:

- **The guiding hand** (`src/components/GuideHand.tsx`) — Font Awesome's
  `hand-pointer` icon where an emoji used to be, rotated 25° so it points up-left with
  its fingertip on the middle of the target arrow, white with a navy outline, sized at
  two cells (44dp on the tutorial board) so it indicates rather than upstages. Checked
  headless against a 1080px mock of the reference screen, not on a device.
  **It is CC BY 4.0 and the credit it requires is not in the app yet** — see
  `assets/art/LICENSES.md` for what has to ship before release, and for the
  Apache-2.0 alternative if carrying a credit is not wanted.
- **The caption is now a bubble with a nub**, hanging under the arrow it explains
  rather than sitting at 18% of the screen. Board-wide marks (levels 2, 5, 6, 8, 11)
  still use the old centred slot.
- **Level 1 no longer dims the board.** `TutorialStep.veil` is false there and the
  overlay is `box-none`, so all three arrows stay full strength and the board stays
  tappable — which is also what dismisses the mark. Every other mark still veils.

The dot grid changed with it: dots are drawn under path cells only, never as a full
grid (`DotGrid` takes `cells` now). That is measured off the reference too, and it
affects every level, though above the tutorial the arrows cover the dots anyway.

**Nothing in the reference refit has been on a screen.** The whole board — colour,
weight, scale — and levels 1-10 changed in one pass, and every check so far has been
headless: typecheck, lint, 156 tests, level validation, and ASCII renders of the
boards. Open level 1, then 5, then 10.

What it should look like, and the reference to check against is `ref/Arrow`:

- **One colour.** Navy `#061242` on white, every arrow, no exceptions. If anything on
  the board is cyan, pink or orange, `ArrowShape` is reading `arrow.color` again — it
  must not; the palette is still in the level data and nothing draws it.
- **No glow, no casing, no gloss.** Two paths per arrow. Two paths running side by
  side are separated by the white page between them and by nothing else.
- **Small boards stay small.** Level 1 is a 6×6 sitting in the middle of a mostly
  empty white page, not a board stretched to the screen width. Anything at 17 columns
  or wider fills the width; below that the cell size does not change.
- **Level 5 is 27 arrows on a 13×13**, where it used to be 9 on an 8×8, and levels
  1-9 are plain rectangular fields rather than silhouettes. Level 10 is 78 arrows on a
  22×22 drawn as a strawberry — the first showcase, and the only picture in the ten.
  If level 5 still looks sparse the app is running against stale packs; Metro caches
  them, hence `--reset-cache` below.

Do not re-verify the stroke width by eye from a screenshot; at thumbnail scale a
0.19-of-a-cell line reads heavier than it measures. The ratios in `src/utils/layout.ts`
are measured off the reference screenshots to the pixel — see the comments there.

**Restart the app fully after a structural change; do not trust Fast Refresh.** The
blank screen seen on 2026-09-02 came back to a working board on a force-stop and
relaunch, with Metro already serving the new bundle correctly.

Restart Metro first; it was killed with a stale module graph:

```bash
npx react-native start --reset-cache
npm run android            # or: cd android && ./gradlew installDebug -PreactNativeArchitectures=x86_64
```

**The one judgement call worth a second opinion on screen** is how the game screen's
chrome sits against the white page. `theme.board` owns that screen and only that
screen: Home, Level Select and Settings are still dark, and the hand-off between them
has not been looked at. The hint pill is also still the old yellow gradient — it reads
fine on white but it is not what the reference draws, which is a plain white circle
with a lightbulb in it.

**Levels 11-500 were deliberately left alone.** They still carry the old curve — 16-22
arrows on a 10×10 at level 11, against 27 on a 13×13 at level 5 — so the game gets
*easier* and sparser at level 11 and stays that way for a while. That is the one
visible seam this refit leaves, and closing it means re-cutting `BAND_TABLE` above
level 10 and regenerating 490 levels, which is roughly an hour of generation plus a
contact-sheet review.

Worth knowing before doing that: the machinery is already in place and was measured
once. `BLOCK_SHAPE` + `poreCandidates` + `startingBox` in `tools/pipeline/mask.ts`
give the reference's rectangular fields at any grid size; `shapeForLevel` is what
currently gates them to levels 1-10. Two things bit when it was tried across all 500
and would bite again: §7.2's D saturates on dense boards — turns, span and occupancy
all pin, the reachable window narrows to about a point above grid 20, and the 7.0
ceiling has to come up or every target above level 250 is unreachable — and the
orientation search stops finding a solvable board past roughly 520 cells
(`arrows × mean length`), which is what caps the tail rather than anything visual.

---

## What was built, in order

0. **Maze refit** (§4.1, §4.2) — the levels themselves, rebuilt to read as mazes.
   Path length was the whole problem: mean 2.1 cells with 80% of arrows dead straight
   is a scatter of stubs however it is drawn. `lengthMixFor` is now generated from a
   target mean rather than five hand-typed weights, the carver rewards bends after a
   straight run instead of penalising them, and `MAX_PATH_LENGTH`/`MAX_TURNS` went
   8/3 -> 16/6. Mean length is 4.51, longest path 16, turns per arrow 1.39 at L500.
   Since `cells = arrows x length` and the arrow counts were kept, the grids grew:
   5..14 -> 6..22. Difficulty floors re-measured, hit slop capped in cell units.
0. **Board redesign** (§10.2) — the arrow layer stack rebuilt around a thin stroke.
   Every width is now a multiple of `strokeWidthFor`, the arrowhead included; a dark
   casing separates paths that run close; single-cell arrows gained a stub of body so
   they read as arrows rather than as loose triangles; the dot grid was dimmed under
   them. `EscapingArrow` and the contact-sheet tool were folded onto the shared
   drawing code rather than keeping their own copies of it.

1. **Level pipeline** (`tools/`) — mask fitting, path decomposition, orientation
   search, validation, packing. 500 levels, 700KB, ~90s to regenerate, reproducible.
2. **The whole app** — 6 screens, 5 overlays, board renderer, viewport gestures,
   render tiers, tutorial, storage, audio, haptics, ad seam, dev overlay.
3. **Device fixes**, each found by running it rather than by reading it:
   - Overlays were completely inert. `Modal` content lives in its own Android window
     that `GestureHandlerRootView` does not wrap, so gesture-handler swallowed every
     touch. Now rendered as in-tree layers.
   - Coach-mark dim panels swallowed taps without dismissing, against §6's
     "dismissible by tapping anywhere". Each panel now dismisses.
   - The exit animation did not animate. Reanimated cannot drive a transform on a
     react-native-svg `<G>` — the transform resolves to a matrix at render time and
     never sees the update — so arrows sat still until a timer removed them.
   - RN template shipped an `INTERNET` permission and no portrait lock, both against
     §18. Permission moved to the debug variant; portrait pinned.
   - **Particles could grow until one covered the screen**, which reads as the app
     going blank. `useFrameCallback`'s `timeSinceFirstFrame` restarts at zero when the
     callback is re-armed (a remount, or a Fast Refresh) while `lastFrame` survives in
     a shared value, so the delta went negative; `p.life -= dt` then added life and the
     sprite scaled without bound. The delta is now clamped at both ends, not just the
     top. Found by measuring the framebuffer, not by reading the code.

## Known environment quirks (already worked around, do not re-diagnose)

- **Gradle cache race on `D:`.** `Could not move temporary workspace` — pass
  `--project-cache-dir` outside the project, or just retry.
- **NDK.** `android/build.gradle` is pinned to `27.1.12297006`, the one actually
  installed here. RN 0.76 defaults to `26.1.10909125`, which is an empty stub in this
  SDK.
- **Reanimated native build race.** `libreanimated.so` can link before
  `libworklets.so` exists. Clears on a rerun. Building one ABI makes it rarer:
  `-PreactNativeArchitectures=x86_64`.
- **Never run two Gradle builds at once.** Doing so corrupted `intermediates/` and
  cost a 2.5GB clean rebuild.

## Still outstanding

- **Every grid now leans on zoom, not just the fine ones.** `FULL_WIDTH_GRID` stops
  a small board growing to fill the screen, so a 6×6 draws at the same ~19dp cell a
  17×17 does — that is what the reference does and it is why its early boards sit
  small on the page, but it means level 1 has the same touch precision as level 300
  rather than a much easier one. `MAX_HIT_RADIUS_CELLS` keeps an ambiguous tap
  resolving to nothing, and §5.5's pinch-zoom is the intended answer, but whether a
  19dp cell is comfortable on a real phone is unknown until someone plays it.
- **Level packs grew 700KB -> 960KB.** More cells per arrow is more path data. They
  are still lazy-loaded three at a time, so this is bundle weight, not memory.

- **Audio ships three of eleven effects.** `ui_tap`, `arrow_move` and `arrow_blocked`
  are in `android/app/src/main/res/raw/`, synthesised for this project and recorded in
  `assets/audio/LICENSES.md` with the expressions that generated them. The remaining
  eight and the music loop are still absent; `AudioService` no-ops on a missing file,
  so those events are simply silent. The three that ship are placeholders in intent —
  plain, and meant to be replaced by produced audio.
- **Performance unmeasured.** §13 wants 60fps at 14×14 / 90 arrows on a low-end
  device. An x86_64 emulator says nothing useful about that.
- **Only x86_64 has been built.** A physical device needs the full
  `reactNativeArchitectures` list from `android/gradle.properties`.
- **Not a git repository.** Nothing is version-controlled yet — worth `git init`
  before the next big change.
