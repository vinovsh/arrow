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

Last run: clean. 10 suites, 116 tests, 0 fatal level issues, 7 non-fatal warnings
(1 difficulty-window on level 5, 6 length-mix on tutorial boards — both explained in
README's "Where the spec and the implementation disagree").

---

## Pick up here

**Verify the rope exit animation on device.** It was implemented and unit-tested but
never run — the last session ended before testing it, deliberately.

Restart Metro first; it was killed with a stale module graph:

```bash
npx react-native start --reset-cache
npm run android            # or: cd android && ./gradlew installDebug -PreactNativeArchitectures=x86_64
```

What to look for: tap an L- or U-shaped arrow. It should **unbend** — the corner
feeding backwards down the body until the arrow is straight — then leave the board in
the direction its head points, staying visible until it is well clear. Nothing else on
the board should shift while it travels.

---

## What was built, in order

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

- **Audio does not ship.** `AudioService` is wired to the whole §14 event table and
  no-ops on missing files, so the game plays silently. Spec and licence table in
  `assets/audio/LICENSES.md`.
- **Performance unmeasured.** §13 wants 60fps at 14×14 / 90 arrows on a low-end
  device. An x86_64 emulator says nothing useful about that.
- **Only x86_64 has been built.** A physical device needs the full
  `reactNativeArchitectures` list from `android/gradle.properties`.
- **Not a git repository.** Nothing is version-controlled yet — worth `git init`
  before the next big change.
