# Arrow Escape

**Mixed-arrow redesign: 20 completely new levels, awaiting player review.**

A tap puzzle built from dense, interlocking maze paths. Follow the arrowhead: an
arrow can leave only after every other arrow in its exit lane has cleared.
Level 1 teaches tapping with four straight arrows. Blocking puzzles start at level 2.

React Native CLI + TypeScript. No Expo dependencies.

## Current level design

The previous packs, silhouette templates, short-arrow distributions, difficulty
ceiling and 500-level generator have been replaced. `tools/designFirst20.ts` is
now the only generator. It builds original paths in reverse solve order, expands
their bodies into empty lanes, and checks every orientation change for solvability.
It introduces short and medium arrows into selected lanes while keeping long
winding arrows and checking every resulting dependency for solvability.

- One 12×12 tutorial and 19 unique mazes, from 20×20 to 40×40.
- No arrowhead points toward its own body anywhere along its forward exit lane.
- Levels 2–20 mix short (4–7 cells), medium (8–19) and long (20–64) arrows.
- At least 20% short, 25% medium and 25% long arrows; long arrows occupy at most
  half the arrow count. No head-only arrows. Average length stays at least 12 cells.
- Level 1 has four separate five-cell arrows and a solid “Tap to remove” bubble
  that follows the next arrow until all four are removed.
- Levels 2–20 have at least 94% board coverage, with nested lanes and interlocking exits.
- Minimum dependency depths: 5 on level 2, 8 on levels 3–9,
  and 12 on levels 10–20. Opening moves are limited as well.
- Labels use board scale and dependency structure. The numeric difficulty signal
  supports validation; real player review remains the final test of challenge.

`mock/first-20-overview.png` shows every board. `mock/previews/` contains individual
PNG and SVG images rendered with the app's geometry. Open `mock/review-first-20.html`
for the playable review. `mock/review-first-20.json` records measured lengths,
coverage, opening moves and dependency depths. Levels 21+ wait for user approval.

## Tutorial and visuals

The old cartoon hand, white tutorial veil, decorative board overlays and translucent
arrow halos are removed. An original tap-target icon accompanies an inline tip above
the board. Level 1 uses a solid bubble below its four practice arrows, highlights
the next arrow blue and shows the touch-target icon on its body. Guides never block taps;
they explain blocking after a failed move on level 2, zoom on level 3 and hints on
level 4. Dismissing tips never skips a puzzle.

Campaign revision 2 starts these new puzzles at level 1 with fresh completions, stars,
per-level scores, times and tutorial history. Sound, music and vibration preferences
and the lifetime best score survive. Progress within this revision is preserved.

## Development and verification

```bash
npm ci
npm start
npm run android
npm run verify
npm run levels:generate
npm run levels:contactsheet
python3 tools/mock/renderFirst20.py
```

Verification covers typing, lint, unit and gameplay tests, exact preview/pack parity,
mixed-length design gates, and 30 random legal playthroughs of each board. Regenerating
previews does not build an APK or deploy anything.

## Arrow movement

Every attempt shows one short emoji reaction after half the arrows are removed.
It bounces and wiggles without blocking taps. Once the final arrow finishes exiting,
a completion emoji celebrates before the existing reward screen. Captions vary by
level and result: “You got it!”, “Great job!”, “Impressive!” or “Genius!”.
Restart resets the halfway milestone. Reduced-motion settings show a static reaction.

Successful moves use the approved option 4, a 260ms glassy glide: bright, smooth
falling tones with soft edges. Pitch varies subtly across short, medium and long arrows. Reanimated drives rope-like
exit paths on the UI thread, preserving bends while the tail follows the head.
Hint and blocked states use solid color changes, with no translucent underlays.
Pinch-to-zoom, pan and fit remain available for precise taps on dense boards.

## Rewarded lives (Google AdMob)

Every blocked arrow costs one heart. At zero hearts the game pauses and offers
**Get more lives** (complete a rewarded ad for one heart) or **Restart level**.
Closing an ad early or an ad failure does not grant a life or dismiss the popup.
A restart restores all three hearts and resets the puzzle without requiring an ad.

Debug APKs always use Google's sample Android app and rewarded ad unit IDs.
Rebuild the Android APK after adding the native ad module; a Metro reload alone
cannot install it. The integration uses Mobile Ads SDK 23.6.0 and UMP 3.1.0,
compatible with this React Native version's Kotlin 1.9.24 toolchain.
Release builds need your own Gradle properties:

```properties
ADMOB_APP_ID=ca-app-pub-YOUR_PUBLISHER_ID~YOUR_APP_ID
ADMOB_REWARDED_AD_UNIT_ID=ca-app-pub-YOUR_PUBLISHER_ID/YOUR_REWARDED_UNIT_ID
```

Set these in your Gradle properties or pass them with `-P`. A release build with
no rewarded unit configured reports the ad as unavailable. Configure your AdMob
privacy messages before serving production ads. Required consent forms run before
ad initialization; Settings provides **Ad privacy choices** to change consent.
Ads need internet, while restarting and playing puzzles still work offline.

## Menu UI revision (2026-10-12)

The approved white-and-blue storyboard is implemented across launch, home, level
selection, settings, help, pause, hints, lives, rewards and the leaderboard. A
separate menu palette preserves gameplay colors and geometry. Menus use opaque
surfaces, navy text, blue main buttons and numbered level tiles. Home shows actual
progress and best score. Help has five working Next steps. Dialogs scroll on short
screens; reward and ranking animations, ad behavior and saved progress are retained.

## Minimal leaderboard and immediate navigation (2026-10-13)

Leaderboard shows rank, final points and five nearby players, including You.
Results scroll while Next Level and Home stay outside the scrolling area. The
large artwork, seasonal banners and timed ranking reveal have been removed.
Next Level is enabled immediately and guarded against double taps. Reward-screen
Continue also advances on its first tap while finishing its animation. Score and
ranking calculations are unchanged.

## Approved arrow-out sound (2026-10-13)

The user selected Glassy glide (option 4). The movement resource is generated from
the exact audition master, encoded as mono 44.1kHz AAC. The browser review embeds
the same resource. Existing sound settings, subtle pitch variation and voice limits
remain in effect.
