# Arrow Escape — progress

Last updated: 2026-09-02.

This is the working handoff note. `README.md` documents the project as built;
this file records where the work stopped and what to pick up next.

---

## State: playable end to end

All 500 levels generate, validate and play. The app builds, installs and runs on an
emulator, and a full loop has been walked through on device: tutorial coach mark →
tap arrows → win sequence → Score Summary → next level.

```
npm run verify     # typecheck + lint + 116 tests + level validation
```

Last run: clean. 10 suites, 121 tests, 0 fatal level issues, 6 non-fatal warnings
(4 difficulty-window, 2 length-mix on tutorial boards — both explained in README's
"Where the spec and the implementation disagree").

---

## Pick up here

**Nothing since the arrow redesign has been on a screen.** The maze refit regenerated
all 500 levels and has only been checked headlessly — validator, tests, and ASCII
renders of the boards. Look at a late level first (381 or 500): it should read as a
dense interlocking maze of snaking paths, close to the reference the redesign was
asked against, not as scattered stubs.

**The redesign is confirmed on screen; the rope exit still is not.**

The thin arrows were verified by measuring the device framebuffer on level 11 (8x8,
cell 41dp): a 5.3dp bright core inside a 1.7dp casing rim each side, against the
18.9dp the old code drew. That is `strokeWidthFor(41)` exactly. Do not re-verify the
widths by eye from a screenshot — at thumbnail scale the casing and glow read as much
heavier than they measure, which cost a round trip already.

**Restart the app fully after a structural change; do not trust Fast Refresh.** The
blank screen seen on 2026-09-02 came back to a working board on a force-stop and
relaunch, with Metro already serving the new bundle correctly.

Restart Metro first; it was killed with a stale module graph:

```bash
npx react-native start --reset-cache
npm run android            # or: cd android && ./gradlew installDebug -PreactNativeArchitectures=x86_64
```

**The board redesign (§10.2).** Arrows are now thin lines with small heads instead of
tubes: 3dp at 14×14 up to 7dp at 5×5, against 10.6-29.9dp before. Look for a board
that reads as a maze of paths with air between them, and heads that terminate a line
rather than replacing it. Level data did not change and did not need to — L5 was
already 9 arrows on 7×7, L500 already 81 on 14×14. It was never the arrow count that
filled the screen, it was the ink.

**The exit no longer vanishes in view (§9.2).** Two faults compounded, and the maze
refit made both worse by making paths long. Travel was measured to the *board* edge,
but `BoardViewport` clips further out — the board is centred in it, so on a 20x20
board there is 100dp of open space above and below where an arrow was being removed
in plain sight, 68dp short of the clip. On top of that the fade ran from 82% of the
animation, which the easing puts only 72% of the way along the travel; the longer the
body, the earlier in the journey that lands. Arrows now travel to the clip and there
is no fade at all. Watch a long vertical arrow near the top of a late level — it
should slide up and be gone, never dim.

**The rope exit.** Tap an L- or U-shaped arrow. It should **unbend** — the corner
feeding backwards down the body until the arrow is straight — then leave the board in
the direction its head points, staying visible until it is well clear. Nothing else on
the board should shift while it travels. It now draws through the same `ArrowShape` as
the resting board, so if the resting arrow looks right the flying one cannot drift.

One judgement call worth a second opinion on screen: the head is **1.5× the stroke in
half-width**, i.e. 3× across. Read as full width that is above the "1.5-2×" the
redesign asked for, but a head 2× the line across barely registers as a triangle. If
it still looks big, `arrowHeadSizeFor` in `src/utils/layout.ts` is the one place.

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

- **Fine grids lean on zoom.** A 22×22 board is a 14dp cell; `MAX_HIT_RADIUS_CELLS`
  keeps taps honest but the target is genuinely small at fit scale. §5.5's pinch-zoom
  is the intended answer and the level-11 coach mark teaches it, but whether that
  feels right on a real board is unknown until someone plays a late level.
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
