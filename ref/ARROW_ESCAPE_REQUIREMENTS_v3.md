# Arrow Escape — Product & Technical Requirements

> Approved UI revision (2026-10-12): menus and reward screens use the white-and-blue
> storyboard implemented in `src/theme/menuTheme.ts`. Gameplay screen, its palette
> and level geometry stay unchanged. Launch uses the folded blue arrow emblem;
> Home displays progress and best score; level selection uses numbered four-column
> tiles; help advances through five lessons. Pause, hints and lives use opaque,
> scrollable surfaces. Existing navigation, saves, rewards and ad rules remain.
> Arrow movement uses the new original 235ms silky glide, with subtle pitch
> variation across the complete 4–64-cell range. These revisions supersede older
> menu appearance and movement-sound descriptions below.

> Level-design revision: 2026-10-12. The current 20-level mixed-arrow campaign
> replaces the previous short-arrow, silhouette and 500-level rules. See README.md
> and tools/designFirst20.ts for the current measured design gates. Other sections
> retain historical product context and are subject to the current implementation.

**Version:** 3.0 (supersedes v2.0)
**Platform:** Android, portrait — React Native CLI + TypeScript. **Not Expo.**
**Inputs:** written brief, 10-screen storyboard, confirmed difficulty/grid/arrow table
**Status:** Ready for Phase 1

---

## 0. Current design authority

The October 2026 user redesign replaces previous level-pattern rules. Sections 3.1,
4, 6, 8 and 20 below describe the current campaign. Legacy generator code is removed.

## 1. Product definition

**Arrow Escape** is an offline, single-player, score-based tap puzzle. Long arrow paths interlock into a dense maze. Tapping an arrow slides its entire path off the board in the direction its head points, but only if nothing blocks the way. Clear the board to finish the level.

**Pillars, in priority order:**
1. **Understood in one second.** No reading required.
2. **Never punishing.** No timers, no dead ends, no real fail state, no paywalls.
3. **Physically satisfying.** Every successful tap pays out in motion, glow, sound, haptics.
4. **Readable mazes.** Long winding paths create the visual design and the challenge.

**Session shape:** 30 seconds (level 4) to 3 minutes (level 480) per level, 3–8 levels per sitting.

---

## 2. Core mechanic

### 2.1 Definitions

- **Grid** — `gridSize × gridSize` cells, drawn as faint dots at cell centres.
- **Arrow** — an ordered list of 4–64 orthogonally adjacent cells in the shipped campaign. `cells[0]` = tail, `cells[n-1]` = head.
  - For paths of 2+ cells, direction = vector from `cells[n-2]` to `cells[n-1]`.
  - Head-only arrows are not permitted in any shipped level.
- **Corridor** — every cell from the head, stepping in `direction`, out to the board edge.
- **Free** — no corridor cell is occupied by any active arrow.

### 2.2 Tap resolution

```
onTap(point):
  arrow = hitTest(point)          // proximity-based, §4.4
  if !arrow || arrow.state !== ACTIVE: ignore
  if isFree(arrow):
      state = ESCAPING
      animate whole path off-board along direction     (§9.2)
      sound arrow_move · haptic impactLight · particle trail
      state = ESCAPED; clear cells from occupancy
      recomputeFreeSet()
      if activeArrowCount === 0 → win sequence          (§9.4)
  else:
      shake perpendicular to direction, 180ms          (§9.3)
      sound arrow_blocked (soft) · haptic selection
      outline the BLOCKING arrow at 25% for 300ms      ← teaching cue
      blockedTaps++
```

The cue that flashes the *blocker* is the highest-value readability feature in the game, and it matters more as boards get denser — on a 90-arrow board, "why didn't that move?" is otherwise unanswerable.

### 2.3 The monotonicity property

Removing an arrow only ever frees cells; it can never block another arrow. Therefore:

> If `F(S)` is the free set at state `S`, and `S → S'` removes any arrow, then `F(S) ⊆ F(S')`.

Consequences this document depends on:

1. **A dead end is impossible.** A level solvable at the start is solvable from *every* reachable state. The player cannot ruin a board — this matters enormously at 90 arrows.
2. **Undo is unnecessary** (matching the brief), and a hard fail state is meaningless (§3.2).
3. **Solvability checking is exact and cheap.** Greedily remove every free arrow and repeat. Board empties → solvable. `O(n²)`, no search (§8.4).

---

## 3. Anti-frustration system

### 3.1 Challenge

Require real blocking dependencies from level 1. No fixed difficulty ceiling, easy
showcase cadence or requirement that every early arrow be free remains. Challenge
comes from reading long paths, tracing exit lanes and finding unlocking sequences.
The current measurable gates and achieved values are in tools/designFirst20.ts and
mock/review-first-20.json. Human playtesting decides final difficulty.

### 3.2 Lives

Three hearts; every blocked tap costs one, from level 1. At zero hearts the player
can restart immediately or use the existing rewarded-life option. Restarting never
requires an ad. No wait timer, regeneration clock or life purchase.

### 3.3 Struggle detection (silent assist)

Once per attempt, when any of these fire — 4 blocked taps in a row, 25s with no successful move, or elapsed > 2.5 × parTime — gently pulse one valid arrow's outline for 1.2s at 60% hint strength. No modal, no text, no sound, no score penalty. If still stuck 30s later, the HINT pill pulses once.

### 3.4 Hints

- 3 per level, refilled on every level entry, **free**. The green `3` badge on the HINT pill is this counter.
- Confirm modal per storyboard screen 5 (§5.6). Confirming highlights the solver's next arrow; it never auto-plays.
- 8s cooldown between hints.
- On boards of 40+ arrows, the hint also **auto-pans and zooms** the board to bring the target arrow into view before pulsing it. Without this, a hint on a zoomed-in 14×14 board can point off-screen.
- Using a hint forfeits 3 stars and the Perfect bonus for that level. Nothing else.

### 3.5 Standing guarantees

- **No countdown timer, ever.** Time feeds the speed bonus only, never stars.
- Restart is instant and free; confirmation only after the first successful move.
- Levels unlock by completion alone. No star gates, no coins.
- The next level is never locked behind a perfect run.

---

## 4. Current progression: 20 original mixed-arrow mazes

### 4.1 Boards

Exactly 20 levels: a 12×12 tutorial followed by original dense mazes from 20×20 to 40×40;
no copied competitor geometry, picture masks or recycled old boards. No level 21+
is designed until this batch is approved.

### 4.2 Paths

Level 1 is a tutorial with four isolated straight five-cell arrows and a solid
“Tap to remove” guide following each remaining arrow. No blocking is required.
Levels 2–20 mix short (4–7 cells), medium (8–19) and long (20–64) arrows.
At least 20% of arrows are short, 25% medium and 25% long; at most 50% are long.
Board-average length is at least 12 cells and coverage at least 94%. No head-only
arrows. Keep bodies clearly separated and directional, with winding long paths.
No head points at its own body anywhere along its complete forward exit lane.

### 4.3 Dependencies

Level 1 has four free arrows for guided tapping. Level 2 requires dependency depth
5 and 65% initially blocked; levels 3–9 require 8 and 75%; levels 10–20
require 12 and 80%. These are minimum structural gates, not claims about a player's
solve time. Every possible sequence of legal removals must remain solvable.

### 4.4 Touch and zoom

Pinch, pan, fit and nearest-path hit testing remain essential. Dense boards can be
magnified for precise taps. Use the shared runtime geometry for preview images.

### 4.5 Appearance

Long maze paths carry the design. No decorative overlay, tutorial veil, translucent
arrow underlay or mandatory silhouette layer. Current arrow colors and widths live
in the renderer and theme. A temporary solid blue arrow identifies a tutorial or hint target.

## 5. Screens

Ten screens, matched to the storyboard. No store, no coins, no bottom navigation, no banner ads, no score during gameplay.

### 5.1 Splash

Dark panel, `ARROW / ESCAPE` gradient wordmark, cyan `UNLOCK YOUR WAY OUT`, coloured neon arrows drifting in the background, faint dotted cat and apple silhouettes at the base, `TAP TO START »`.

**Conflict resolved:** the brief says auto-advance in 1.5–2s; the storyboard shows `TAP TO START`. Both ship — auto-advance at 1.8s, tap skips immediately, the label pulses gently. Level packs, save data and audio preload during the animation.

### 5.2 Home

Settings gear top-left. Wordmark centred. Three 56dp buttons, full width minus 32dp, 14dp gap: `▶ PLAY` (blue), `▦ LEVELS` (purple), `⚙ SETTINGS` (green). Faint dotted silhouettes below as decoration. Small `LEVEL 27` progress line and best score under the wordmark, plus a `HOW TO PLAY` link. Nothing else.

### 5.3 Level Selection

Back arrow, `LEVELS` title. Paginated pager, **25 levels per page in a 5×5 grid**, page dots at the bottom, per the storyboard. The current batch uses one partial page.

- Completed: number + 1–3 gold stars beneath.
- Current: bright yellow neon outline with a slow pulse.
- Locked: dimmed card with a padlock, no number.
- Band name shown as a subtitle under the title, updating per page.
- Dot indicator shows a 5-dot window plus the current page count.
- Opens on the page containing the current level; horizontal swipe between pages.

### 5.4 Gameplay

```
┌──────────────────────────────────────┐
│ ❤❤❤          LEVEL 13           ⚙   │  56dp, safe-area aware
├──────────────────────────────────────┤
│                                  ⛶  │  ← fit button, only when zoomed
│         [   PUZZLE BOARD   ]         │  square, centred, pinch-zoomable
│                                      │  ≥ 62% of screen height
├──────────────────────────────────────┤
│      (💡 HINT ③)         ( ↻ )       │  72dp
└──────────────────────────────────────┘
```

- **No score, no move counter, no timer, no ad.**
- Board fit size = `min(screenWidth − 32, availableHeight)`; `cellSize = floor(fitSize / gridSize)` for a crisp dot grid at scale 1.
- Hearts are visible from level 1.

### 5.5 Board zoom and pan

A core interaction, specified in full because it touches hit-testing, rendering and hints.

**Gestures**
| Gesture | Behaviour |
|---|---|
| Pinch (2 fingers) | Scale about the pinch focal point |
| Drag (1 finger, scale > 1) | Pan |
| Drag (1 finger, scale = 1) | No-op — board is fully visible |
| Double-tap | Toggle between fit (1.0) and 2.0×, centred on the tap point, 250ms spring |
| Single tap | Arrow selection (§2.2) |
| Fit button | Springs back to 1.0 and re-centres; visible only when `scale > 1.01` |

**Rules**
- `minScale = 1.0` (fit — never zoom out past the whole board), `maxScale = 3.5`.
- Default scale on level entry is always 1.0. Zoom state resets on every level change and is not persisted.
- Pan is clamped so board edges never travel inside the viewport, with a rubber-band overshoot of 40dp and a spring-back on release.
- **Tap/pan disambiguation:** a touch counts as a tap if it lifts within 250ms and moves less than 10dp. Anything else is a pan. Implemented with `Gesture.Exclusive(doubleTap, tap)` composed `Simultaneously` with pinch and pan via `react-native-gesture-handler`.
- Zoom is **disabled** during the win sequence and while the Pause or Hint modal is open. It stays enabled during individual arrow escape animations.
- Zoom never affects gameplay, scoring, par time or star rating. It is purely a viewport.

**Rendering under zoom** — the important detail:
- During the gesture, transform the **container view** (Reanimated shared values on a wrapping `Animated.View`), not the SVG. No SVG re-render occurs mid-gesture, so 60fps is achievable even at 90 arrows.
- On Android this magnifies the rasterised layer and looks soft above roughly 1.5×. So: **120ms after the gesture settles, if `scale > 1.5`, re-render the SVG once with an adjusted `viewBox` and stroke widths** to restore crispness. One re-render, debounced, never during motion.
- The board SVG is rendered at 1.5× base resolution and displayed at 1.0 to keep moderate zoom sharp without a re-render.

**Hint interaction:** on boards of 40+ arrows, using a hint animates the viewport so the target arrow is centred and at least 1.8× before pulsing (§3.4).

### 5.6 Hint modal

Per storyboard screen 5. Centred panel over the dimmed game screen: `HINT` in yellow, `✕` close, a desaturated preview of the board, caption `Reveal a helpful hint?`, a yellow `💡 USE HINT (3)` primary and a `CANCEL` secondary. The preview does **not** reveal the answer before confirmation.

### 5.7 Level Complete

Purple ribbon `LEVEL COMPLETE!`, three gold stars animating in, praise word in cyan (`AMAZING!` / `GREAT!` / `NICE!`), a bordered `SCORE` box with the level total in yellow, `NEW HIGH SCORE!` in green when applicable, confetti, green `NEXT LEVEL` button, secondary `HOME` link.

### 5.8 Score Summary

Kept as its own screen per the storyboard, shown **selectively** so it never taxes fast play: on milestone levels (every 25th), on a new high score, or when the player taps the `SCORE` box. Otherwise `NEXT LEVEL` goes straight through.

```
        SCORE SUMMARY
  LEVEL SCORE            +100
  MOVES BONUS            +450
  PERFECT BONUS          +300
  SPEED BONUS            +400
  ────────────────────────────
  TOTAL                 1,250
  ┌────────────────────────┐
  │  BEST SCORE   24,850   │
  └────────────────────────┘
        [  CONTINUE  ]
```

### 5.9 Settings

Back arrow, `SETTINGS` title. Three icon rows with green toggles: `SOUND`, `MUSIC`, `VIBRATION`. Second group with chevrons: `★ RATE US`, `🛡 PRIVACY POLICY`, `ⓘ ABOUT`, plus `HOW TO PLAY`. Nothing else.

### 5.10 Out of Lives

Three dark hearts, `OUT OF LIVES!` in red, sad-face emblem, `Don't give up!`, blue `▶ WATCH VIDEO +1 LIFE` primary, dark `RETRY LEVEL` secondary. Governed by §3.2 — a pause, not a punishment.

### 5.11 Pause

Translucent dark overlay, board visible behind. Hearts + `LEVEL 13` + gear remain in the header. `PAUSED` in yellow, then `▶ RESUME` (blue), `↻ RESTART` (dark), `⌂ QUIT LEVEL` (dark). HINT and SOUND pills at the bottom. Game clock stops; zoom locked.

---

## 6. Onboarding

Short inline tips above the board: tap the blue free arrow on level 1, explain
blocking after a failed move on level 2, zoom on level 3, hints on level 4. An
original tap-target icon replaces the cartoon hand. The puzzle stays fully visible
and touchable. Tips can be dismissed; skipping tips does not skip levels. The
How To Play cards remain reachable from Home and Settings.

## 7. Difficulty model

### 7.1 Signals

| Signal | Meaning |
|---|---|
| `n` | arrow count |
| `depth` | longest forced dependency chain in the blocking DAG |
| `freeMinCount` | fewest free arrows at any state (**absolute count**) |
| `freeAvgCount` | mean free arrows across the canonical solve (**absolute count**) |
| `blockedStart` | fraction of arrows blocked at the initial state |
| `turns` | mean 90° turns per path |
| `occupancy` | occupied cells / total cells |
| `spanAvg` | mean grid distance from a blocked arrow's head to its blocker |

### 7.2 Formula (recalibrated for high arrow counts)

v2 measured freedom as a fraction of arrows remaining. At `n = 90`, 15 free moves is a fraction of 0.17 and would have scored as near-maximum difficulty — while a player with 15 choices in front of them feels completely unpressured. Human perception of "I have options" saturates at roughly 6. So freedom is now absolute and saturating:

```ts
const raw =
    1.7 * Math.min(1, depth / 8)                    // forced sequencing
  + 2.4 * (1 - Math.min(1, freeAvgCount / 6))       // typical number of options
  + 1.6 * (1 - Math.min(1, freeMinCount / 3))       // the tightest moment
  + 1.5 * blockedStart                              // crowding at first glance
  + 0.9 * Math.min(1, turns / 3)                    // path readability
  + 0.8 * occupancy
  + 0.7 * Math.min(1, spanAvg / 5)                  // long-range dependencies
  + 0.5 * Math.min(1, n / 90);                      // sheer length — low weight

const D = clamp(1, 10, 1 + 9 * (raw / 10.1));
```

Weights are an initial calibration. After the first playtest, refit against median human solve times (target correlation > 0.7) and freeze before generating release packs.

### 7.3 Par time

`parTime = 8 + 1.7 * n + 3.5 * D` seconds, clamped `[20, 240]`. A 90-arrow level at `D = 5.5` gives ~181s. Feeds the speed bonus and struggle detection only; never displayed as a countdown.

---

## 8. Level pipeline

`tools/designFirst20.ts` is the only generator. Place long arrows in reverse solve
order, extend existing paths to fill empty lanes, then refine orientations while
retaining solvability. Never split paths into short pieces. Validate with the
runtime engine and fail if any design gate is missed. The generator is deterministic.

`tools/validateFirst20.ts` checks all 20 boards, no duplicates, runtime solvability,
long-path and density gates, dependency constraints and 600 random playthroughs.
The pack contains exactly the same cells and directions as the review JSON files.

Review exact-geometry PNG/SVG boards and the playable preview before designing more.
A single partial 25-slot pack currently contains levels 1–20.

## 9. Animation & feedback

All animation runs on the UI thread via Reanimated worklets. The JS thread stays free during play.

### 9.1 Idle
Arrow glow breathes at 0.15Hz, ±6% opacity, phase-offset per arrow. **Disabled above 40 arrows** (§13) — at 90 arrows it is both a performance cost and visual noise.

### 9.2 Escape (350–600ms, scaled by exit distance)
- Path translates along `direction` past the edge, `Easing.in(Easing.cubic)`.
- Glow 1.0 → 1.6 over the first 40%.
- Particle trail from the head: 12–18 sprites at ≤ 40 arrows, 6–10 above (§13). 400ms life, additive blend.
- Opacity 1.0 → 0 over the last 30%. Board clipped so paths slip under the frame — and under the *viewport* edge when zoomed.
- Sound `arrow_move`, pitch varied ±2 semitones by path length. Haptic `impactLight`.

### 9.3 Blocked (180ms)
- Three-cycle shake, ±4dp perpendicular to `direction`.
- Soft glow pulse; no colour change, no red.
- Blocker outlined at 25% for 300ms. If the blocker is off-screen while zoomed, show a small directional chevron at the viewport edge pointing toward it.
- `arrow_blocked` at −8dB relative to move; haptic `selection`.
- **No screen shake, no flash.** Blocked reads as information, not a buzzer.

### 9.4 Level complete (≈1.6s before input accepted)

```
t=0.00  final arrow exits; viewport springs back to fit if zoomed
t=0.15  board glows; dot grid pulses outward from centre
t=0.30  radial particle burst (≤60 sprites)
t=0.45  confetti begins, 3.5s life, fades
t=0.60  ribbon banner drops in: LEVEL COMPLETE!
t=0.85  stars pop in one at a time, 130ms apart, rising pitch
t=1.10  praise word fades in
t=1.20  score counts up in the SCORE box, ~700ms ease-out
t=1.60  NEW HIGH SCORE! badge if applicable; NEXT LEVEL interactive
```

Buttons render disabled-but-visible from the start. Tapping anywhere fast-forwards to `t=1.60`.

---

## 10. Visual design (from the storyboard)

### 10.1 Tokens

```ts
export const theme = {
  bg: {
    base:'#050A16', panel:'#0C1322', panelAlt:'#111A2E',
    border:'rgba(255,255,255,0.08)', vignette:'rgba(0,0,0,0.55)',
  },
  grid: { dot:'rgba(255,255,255,0.10)', dotActive:'rgba(255,255,255,0.18)' },
  text: { primary:'#EAF1FF', secondary:'rgba(234,241,255,0.62)', dim:'rgba(234,241,255,0.38)' },

  brand: {
    arrowWord:  ['#FFD34A','#FF9A3C'],
    escapeWord: ['#35E7F0','#B06BFF','#FF5FA2'],
    tagline:    '#35E7F0',
  },

  arrow: {
    cyan:'#22E0E8', green:'#38E08B', orange:'#FF9A3C', pink:'#FF5FA2',
    purple:'#A46BFF', yellow:'#FFD54A', blue:'#3D8BFF', white:'#F2F6FF',
  },

  button: {
    play:['#3B8CFF','#1F5FD0'], levels:['#8B5CFF','#5B2FD6'],
    settings:['#3ACB63','#22A046'], primary:['#3ACB63','#22A046'],
    hint:['#FFD34A','#F5A623'], neutral:'#16203A',
  },

  state: {
    heart:'#FF3B4E', heartEmpty:'#3A1520', star:'#FFC53D',
    badge:'#3ACB63', danger:'#FF4D5E', success:'#3ACB63',
    currentLevel:'#FFD34A',
  },

  radius: { sm:10, md:16, lg:22, panel:26, pill:999 },
  space:  { xs:4, sm:8, md:16, lg:24, xl:32 },
  glow:   { soft:6, medium:12, strong:20 },
  font:   { display:'Poppins-Bold', ui:'Poppins-SemiBold', body:'Inter-Regular' },
};
```

### 10.2 Rules

- The board uses a white surface and crisp navy arrow paths.
- Arrow geometry and stroke/head proportions are shared by app and preview renderer.
- No translucent decorative layer, arrow halo or tutorial veil is drawn.
- A solid blue path identifies a hint, departing arrow or first tutorial target.
- Original tap-target icon and short inline text sit above the board.
- Dense boards retain pinch-to-zoom and precise path hit testing.
- Headers, controls and other screens use the existing application theme.

---

## 11. Scoring & stars

Matched to the storyboard's 1,250 ceiling, with mistake tolerances scaled to arrow count.

```
n            = level arrow count
levelScore   = 100
movesBonus   = round(450 * clamp(0, 1, 1 - blockedTaps / max(4, n * 0.5)))
perfectBonus = (blockedTaps === 0 && hintsUsed === 0) ? 300 : 0
speedBonus   = round(400 * clamp(0, 1, (parTime * 1.6 - elapsed) / parTime))
total        = levelScore + movesBonus + perfectBonus + speedBonus   // 100..1250
```

`bestScore` is the lifetime cumulative total (`24,850` in the storyboard). `levelScores[id]` keeps the best per level and only increases on replay.

**Stars — scaled to board size, independent of time:**

| Stars | Condition |
|---|---|
| ★ | Level completed |
| ★★ | `blockedTaps ≤ max(6, round(n * 0.15))` |
| ★★★ | `blockedTaps ≤ max(2, round(n * 0.05))` **and** `hintsUsed === 0` |

On a 12-arrow level that is 2 and 6 mistakes; on a 90-arrow level, 5 and 14. A flat "≤2 mistakes" rule would make three stars effectively unreachable in the back half of the game.

Praise word: 3★ `AMAZING!`, 2★ `GREAT!`, 1★ `NICE!`. Time only ever *adds* points and can never remove a star.

---

## 12. Data model

```ts
export type Direction = 'U' | 'D' | 'L' | 'R';
export type ArrowColor = 'cyan'|'green'|'orange'|'pink'|'purple'|'yellow'|'blue'|'white';
export type ArrowState = 'active' | 'escaping' | 'escaped';

export interface GridPoint { x: number; y: number }

export interface ArrowPath {
  id: string;
  color: ArrowColor;
  cells: GridPoint[];        // shipped paths: 8..64 cells, tail → head
  direction: Direction;      // validated against the final segment
}

export interface Level {
  id: number;
  gridSize: number;          // current batch: 16..40
  theme: string;
  band: Band;
  difficulty: number;        // computed signal, 1..10
  parTime: number;
  arrows: ArrowPath[];       // no more than 254 (occupancy capacity)
  decor?: DecorPath[];       // legacy wire format only; not rendered
}

export interface RuntimeState {          // never in React state
  occupancy: Uint8Array;                 // gridSize² → arrow index + 1
  active: Set<string>;
  free: Set<string>;
  blockedTaps: number;
  hintsUsed: number;
  hearts: number;
  startedAt: number;
}

export interface ViewportState {         // Reanimated shared values, UI thread
  scale: number;                         // 1.0 .. 3.5
  translateX: number;
  translateY: number;
}
```

Game state lives in a plain `GameEngine` class held in a ref. Viewport state lives entirely in shared values and never enters React state.

---

## 13. Rendering & performance

**Budget: 60fps sustained; JS thread ≥ 55fps during escapes; cold start to Home < 1.8s on a 2019-era mid-range Android. The binding constraint is a 14×14 board with 90 arrows.**

A naive 90-arrow board is ~360 SVG nodes (glow + body + highlight + head per arrow). That will not hold frame. Rendering is therefore **tiered by arrow count**:

| Arrows | Layers per arrow | Idle breathing | Escape particles | Notes |
|---|---|---|---|---|
| ≤ 25 | 3 (glow, body, highlight) | On | 12–18 | Full quality |
| 26–40 | 3 | On | 12–18 | Full quality |
| 41–60 | 2 (glow, body) | **Off** | 8–12 | Glow opacity ×0.6 |
| 61–90 | 2 | **Off** | 6–10 | Glow opacity ×0.6; static glow baked into a single underlay `<G>` |

Additional rules:

- **One `<Svg>` root** for the board. The dot grid is a single `<Path>` or SVG pattern — never one `<Circle>` per dot. A 14×14 board is 196 dots; as individual nodes that alone blows the budget.
- One memoised `<G>` per arrow, `React.memo` on `(id, state, colorKey)`. An arrow re-renders only when its own state changes.
- **Zoom and pan transform the container view, never the SVG** (§5.5). No SVG work happens during a gesture. The single crispness re-render is debounced 120ms after the gesture settles and only above 1.5×.
- Board SVG renders at 1.5× base resolution, displayed at 1.0.
- Escape transforms are Reanimated shared values on the UI thread; the React tree does not re-render mid-animation. The arrow unmounts once, on completion.
- Particles: one pooled layer, max 80 sprites, recycled, one `useFrameCallback` worklet. Never mount/unmount per particle.
- Occupancy is a flat `Uint8Array`. Freedom recomputation is `O(n × gridSize)` — at `n = 90`, `gridSize = 14`, about 1,260 steps per tap. Trivial.
- Proximity hit-testing walks a precomputed per-arrow segment list: ~200 segments at 90 arrows, negligible per tap.
- Level Selection mounts only the visible page plus neighbours.
- Hermes on, ProGuard on for release, ABI splits enabled.
- **Required benchmark before Phase 15 closes:** a synthetic 14×14 / 90-arrow level must sustain 60fps while idle, while pinch-zooming, and during an escape animation, on the designated low-end reference device. If it does not, the tier table above is adjusted before level generation, not after.

---

## 14. Audio & haptics

**React Native CLI compatible only. No Expo AV, no Expo Haptics, no `expo-*` package of any kind.** Recommended: a maintained CLI-compatible audio library (e.g. `react-native-sound` or equivalent) plus `react-native-haptic-feedback`. Pin exact versions at install and verify Android autolinking before Phase 11.

| Event | Sound | Haptic |
|---|---|---|
| Button tap | `ui_tap` | selection |
| Arrow moves | `arrow_move` (pitch-varied) | impactLight |
| Arrow blocked | `arrow_blocked` (soft, low) | selection |
| Hint used | `hint` | selection |
| Star lands | `star_1/2/3` (rising) | impactLight |
| Score tick | `score_tick` | none |
| Level complete | `level_complete` | impactMedium |
| Life lost | `life_lost` | impactMedium |
| Out of lives | `game_over` | impactMedium |

- On dense boards a fast clear-out fires many `arrow_move` sounds in sequence. Cap at 4 concurrent voices, steal oldest, and apply a 45ms minimum retrigger interval so rapid tapping doesn't turn into a buzz.
- All audio original or licensed for commercial redistribution; licences in `assets/audio/LICENSES.md`.
- Payload < 1.5MB, mono, 44.1kHz `.m4a`, preloaded during Splash.
- Music: single ambient loop at −18dB, ducked 6dB during the completion sequence.
- SOUND / MUSIC / VIBRATION toggles take effect immediately and are respected globally; haptics check the setting at the call site, not only at init.

---

## 15. Storage

`@react-native-async-storage/async-storage` (or MMKV if the sync API is preferred — decide before Phase 9). One namespaced key holding a versioned blob plus a migration function.

```ts
interface SaveData {
  schemaVersion: 1;
  currentLevel: number;
  completedLevels: number[];
  levelStars: Record<number, 1|2|3>;
  levelScores: Record<number, number>;
  bestScore: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  tutorialCompleted: boolean;
  tutorialStepsSeen: number[];
}
```

- Writes debounced 400ms; always flushed on level complete and on `AppState → background`.
- Read once at Splash, then held in memory.
- Corrupt data falls back to defaults without crashing and never discards a recoverable `bestScore`.
- **No account, no login, no backend, no analytics endpoint.** Fully functional in airplane mode from first launch.

---

## 16. Monetisation architecture (deferred — nothing ships in v1)

- `AdService` interface with `NoopAdService` as the only binding.
- Seams for: interstitial between levels (never more often than every 5 levels, never on levels 1–15), rewarded `+1 life`, rewarded extra hint.
- **Never** during gameplay, during an arrow animation, or during the completion sequence.
- **No permanent screen space reserved for ads anywhere.**

---

## 17. Project structure

```
src/
  app/                 App.tsx, providers, featureFlags.ts
  navigation/          RootNavigator.tsx, types.ts
  screens/
    SplashScreen.tsx  HomeScreen.tsx  LevelSelectionScreen.tsx
    GameScreen.tsx    SettingsScreen.tsx  HowToPlayScreen.tsx
  components/
    Button.tsx  Panel.tsx  StarRow.tsx  Hearts.tsx  HintPill.tsx
    CoachMark.tsx  Confetti.tsx  Ribbon.tsx  Toggle.tsx  FitButton.tsx
  game/
    engine/     GameEngine.ts  CollisionDetector.ts  LevelValidator.ts
                ScoreManager.ts  HintService.ts  HitTester.ts
    models/     Arrow.ts  Level.ts  Grid.ts  types.ts
    renderer/   Board.tsx  BoardViewport.tsx  ArrowRenderer.tsx
                DotGrid.tsx  DecorLayer.tsx  ParticleSystem.tsx
    tutorial/   TutorialController.ts  steps.ts
    levels/     packs/pack_001_025.json … index.ts (lazy loader)
  storage/      SaveStore.ts  migrations.ts
  audio/        AudioService.ts
  haptics/      HapticService.ts
  theme/        theme.ts  typography.ts
  utils/        math.ts  layout.ts  rng.ts
tools/          generateLevels.ts  validateLevels.ts  curveReport.ts
                renderContactSheet.ts  shapes/
__tests__/      engine.test.ts  validator.test.ts  score.test.ts
                hitTest.test.ts  levels.test.ts
```

---

## 18. Technical constraints

- **React Native CLI only.** Never run `create-expo-app`. Never add `expo`, `expo-modules-core`, `expo-router` or any `expo-*` package, including transitively.
- TypeScript `strict: true`. No `any` in `src/game/`.
- Android-first, portrait-locked. `minSdkVersion` 24; target the current Play requirement.
- Libraries: `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler` (required for pinch/pan composition), `@react-navigation/native` + `native-stack`, `react-native-screens`, `react-native-safe-area-context`, `react-native-linear-gradient`, async storage, audio, haptics. All CLI-autolinkable; pin versions and verify against the chosen RN version before Phase 2 closes.
- No backend. The app runs without using the `INTERNET` permission.
- Safe areas on all screens. Support 16:9 through 21:9, widths 320dp–480dp.

---

## 19. Current delivery scope

Replace the first 20 levels, remove obsolete pattern rules and tooling, refresh the
tutorial, validate the source and produce review images. Native packaging and
publishing are separate requests. Player approval is required before later levels.

## 20. Acceptance criteria

- Exactly 20 new levels; every board solvable and unique.
- No shipped arrow shorter than 4 cells or longer than 64.
- Levels 2–20 meet the short, medium and long arrow proportions in §4.2.
- No head points into its own body along its forward exit lane.
- Levels 2–20 have at least 94% coverage and at least 12 cells per arrow on average.
- Current dependency and blocked-start gates pass for every board.
- 30 random legal playthroughs per board finish without deadlocks.
- Preview JSON and shipped pack agree exactly.
- First level presents four separate straight arrows and a guide for each tap.
- Tutorial icon and text sit above the board; no veil, hand or translucent underlay.
- Existing saves start the new campaign at level 1 without losing settings or lifetime score.
- New campaign progress survives reloads; dismissing tips never skips a puzzle.
- Pinch, pan, fit and head/body taps remain accurate; check on a phone before release.
- Source checks and JavaScript bundling pass. Native build and deployment require a request.
- No copied competitor assets or level geometry.

## 21. Non-goals

Store, coins, currency, inventory, spin wheel, XP, energy, lives purchase, daily rewards, leaderboards, accounts, cloud save, multiplayer, iOS (v1), landscape, undo, bottom navigation, banner ads, analytics, push notifications, in-gameplay score display.

---

## 22. Open decisions

1. **Storage library** — AsyncStorage vs MMKV. Decide before Phase 10.
2. **Audio library** — confirm the CLI-compatible package and pin its version in Phase 1.
3. **Render tier thresholds** (§13) — provisional until the Phase 7 benchmark on the reference device.
4. **Score Summary frequency** — currently milestones, high scores, and on demand. Widen or narrow after playtest.
5. **maxScale** — 3.5× is a starting value; confirm against a 14×14 board on a 320dp device during Phase 4.
