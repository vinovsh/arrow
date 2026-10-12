# Arrow Escape

**Long-arrow redesign: 20 completely new levels, awaiting player review.**

A tap puzzle built from dense, interlocking maze paths. Follow the arrowhead: an
arrow can leave only after every other arrow in its exit lane has cleared.
Every board has blocking dependencies from the start, including level 1.

React Native CLI + TypeScript. No Expo dependencies.

## Current level design

The previous packs, silhouette templates, short-arrow distributions, difficulty
ceiling and 500-level generator have been replaced. `tools/designFirst20.ts` is
now the only generator. It builds original paths in reverse solve order, expands
their bodies into empty lanes, and checks every orientation change for solvability.
It never repairs a puzzle by breaking arrows into tiny pieces.

- Exactly 20 unique mazes, from 16×16 to 40×40.
- Every arrow has 8–64 cells; board averages are about 28–42 cells per arrow.
- At least 94% board coverage, with many turns, nested lanes and interlocking exits.
- Minimum dependency depths: 3 on level 1, 5 on level 2, 8 on levels 3–9,
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
the board. Level 1 colors one free arrow blue. Tips never cover or block the puzzle;
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
long-arrow design gates, and 30 random legal playthroughs of each board. Regenerating
previews does not build an APK or deploy anything.

## Arrow movement

Successful moves use the existing original soft whoosh. Reanimated drives rope-like
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
