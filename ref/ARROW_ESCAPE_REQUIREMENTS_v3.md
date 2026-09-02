# Arrow Escape — Product & Technical Requirements

**Version:** 3.0 (supersedes v2.0)
**Platform:** Android, portrait — React Native CLI + TypeScript. **Not Expo.**
**Inputs:** written brief, 10-screen storyboard, confirmed difficulty/grid/arrow table
**Status:** Ready for Phase 1

---

## 0. What changed in v3

| Area | v3 decision |
|---|---|
| Arrow counts | **Your table adopted exactly**, 3–4 arrows at level 1 up to 70–90 at level 500 (§4.1). |
| Path lengths | Minimum path length drops to **1 cell**. Per-band length distributions specified so density is deliberate (§4.2). |
| Board interaction | **Pinch-to-zoom, pan and double-tap added** (§5.5). This is now a core interaction, not a nicety. |
| Touch targets | v2's device grid caps **removed** — zoom plus proximity hit-testing solves it (§4.4). |
| Difficulty formula | **Recalibrated.** v2 measured freedom as a *fraction*, which mislabels a 90-arrow board with 15 free moves as brutal. Now uses absolute counts with saturation (§7.2). |
| Stars | **Scale with arrow count.** "≤2 mistakes" is fair on a 9-arrow board and absurd on a 90-arrow one (§11). |
| Lives | Life-loss threshold now scales with arrow count (§3.2). |
| Rendering | **Tiered by arrow count** (§13). 90 arrows × 3 layers is ~360 SVG nodes; the naive approach will not hold 60fps. |

---

## 1. Product definition

**Arrow Escape** is an offline, single-player, score-based tap puzzle. Coloured arrow paths are packed onto a dotted grid so they collectively form a recognisable picture — a cat, an apple, a rocket. Tapping an arrow slides its entire path off the board in the direction its head points, but only if nothing blocks the way. Clear the board to finish the level.

**Pillars, in priority order:**
1. **Understood in one second.** No reading required.
2. **Never punishing.** No timers, no dead ends, no real fail state, no paywalls.
3. **Physically satisfying.** Every successful tap pays out in motion, glow, sound, haptics.
4. **Beautiful boards.** The picture is the reason to open level 340.

**Session shape:** 30 seconds (level 4) to 3 minutes (level 480) per level, 3–8 levels per sitting.

---

## 2. Core mechanic

### 2.1 Definitions

- **Grid** — `gridSize × gridSize` cells, drawn as faint dots at cell centres.
- **Arrow** — an ordered list of 1–8 orthogonally adjacent cells. `cells[0]` = tail, `cells[n-1]` = head.
  - For paths of 2+ cells, direction = vector from `cells[n-2]` to `cells[n-1]`.
  - For **1-cell arrows**, direction is stored explicitly on the arrow. These render as a single arrowhead in a cell and are common from level 11 onward.
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

### 3.1 Difficulty ceiling and rhythm

Difficulty is a solver-computed score `D ∈ [1,10]` (§7.2), measured independently of board size.

- **Hard ceiling `D ≤ 7.0` for every level, including level 500.**
- Within every block of 10: at least 3 levels at `blockAvg − 1.5` or lower; at most 2 at `blockAvg + 1.0`; **never two consecutive levels above `blockAvg + 1.0`**.
- Every 10th level is a **showcase** — a large, beautiful, deliberately easy board that reads as a reward.
- Every 25th level is a **milestone** — `blockAvg + 1.0`, distinct frame, bigger completion flourish.

The average rises from 2.2 to 5.5 across 500 levels. The *floor* never rises. There are level-30-difficulty puzzles sitting at level 470 on purpose.

Note that arrow count and difficulty are separate axes here. A 90-arrow board is *long*, not necessarily *hard* — with 20 free moves available at any moment it is a pleasant, low-stress clear-out. That separation is what lets your count curve and the anti-frustration goal coexist.

### 3.2 Lives are soft, and scale with board size

- Hearts (3, red, top-left) deplete every `max(4, round(n * 0.12))` blocked taps, where `n` is the level's arrow count. A 9-arrow level loses a heart every 4 mistakes; a 90-arrow level every 11.
- Lives are **disabled entirely for levels 1–25**. `FEATURES.livesFromLevel = 26`.
- Zero hearts shows the Out of Lives screen. It costs nothing: `RETRY LEVEL` is instant, restores all hearts, loses no progress, no stars, no score.
- `WATCH VIDEO +1 LIFE` calls `AdService`. With no ad SDK in v1 it grants the life immediately and reads `CONTINUE +1 LIFE`.
- No wait timer, no regeneration clock, no life purchase.

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

## 4. Progression: 500 levels

### 4.1 Level table — confirmed as specified

| Levels | Grid | Arrows | Band | Target avg D |
|---|---|---|---|---|
| 1 | 5×5 | 3–4 | Tutorial | 1.0 |
| 2 | 5×5 | 4–5 | Tutorial | 1.0 |
| 3 | 6×6 | 5–7 | Tutorial | 1.2 |
| 4–10 | 7×7 | 8–12 | Easy | 1.8 |
| 11–25 | 8×8 | 16–22 | Easy | 2.3 |
| 26–50 | 9×9 | 20–28 | Medium | 2.9 |
| 51–100 | 10×10 | 26–36 | Medium+ | 3.4 |
| 101–150 | 11×11 | 32–42 | Hard | 3.9 |
| 151–200 | 11×11 | 36–48 | Hard+ | 4.2 |
| 201–250 | 12×12 | 42–54 | Very Hard | 4.5 |
| 251–300 | 12×12 | 46–60 | Expert | 4.8 |
| 301–350 | 13×13 | 52–66 | Expert+ | 5.0 |
| 351–400 | 13×13 | 58–72 | Master | 5.2 |
| 401–450 | 14×14 | 64–80 | Extreme | 5.4 |
| 451–500 | 14×14 | 70–90 | Insane | 5.5 |

Band names describe **board scale and visual ambition**. Solver difficulty is governed separately by §3.1 and never exceeds 7.0.

### 4.2 Path length distribution (derived from §4.1)

Arrow counts against mask size give the required average path length per band:

| Levels | Grid | Arrows | Mask cells | Required avg path |
|---|---|---|---|---|
| 1–3 | 5×5–6×6 | 3–7 | 15–22 | 3.0 – 5.0 |
| 4–10 | 7×7 | 8–12 | 30 | 2.5 – 3.8 |
| 11–25 | 8×8 | 16–22 | 40 | 1.8 – 2.5 |
| 26–100 | 9×9–10×10 | 20–36 | 53–70 | 1.9 – 2.7 |
| 101–200 | 11×11 | 32–48 | 87–91 | 1.9 – 2.7 |
| 201–300 | 12×12 | 42–60 | 109–115 | 1.9 – 2.6 |
| 301–400 | 13×13 | 52–72 | 135–139 | 1.9 – 2.6 |
| 401–500 | 14×14 | 64–90 | 161–167 | 1.9 – 2.5 |

So from level 11 onward the game is built from **short arrows**: mostly 1, 2 and 3 cells, with longer snaking paths as accents. The generator targets these mixes:

| Band | len 1 | len 2 | len 3 | len 4 | len 5–8 | mean |
|---|---|---|---|---|---|---|
| Tutorial (1–3) | 0% | 10% | 35% | 35% | 20% | 3.7 |
| Easy (4–10) | 5% | 25% | 35% | 25% | 10% | 3.1 |
| 11–100 | 28% | 36% | 22% | 10% | 4% | 2.3 |
| 101–300 | 30% | 36% | 22% | 9% | 3% | 2.2 |
| 301–500 | 32% | 37% | 21% | 8% | 2% | 2.1 |

**Visual consequence, stated deliberately:** early levels are *outline drawings* (the cat in the storyboard), late levels are *dense filled silhouettes* built from short stubs. This is a real style shift across the game. To keep it feeling intentional rather than degraded:

- Every band must retain at least 3 arrows of length ≥ 4 with at least one turn — these are "feature paths" and should be placed along the silhouette's most characteristic contour (a tail, a stem, a wing).
- The **decor layer** (face, details) becomes more important at high density and should be used on every shape from level 100 onward, since the silhouette alone carries less character when solid.
- Colour distribution must be balanced across the board (no more than 25% of arrows sharing one colour on boards of 40+) so the picture doesn't read as noise.
- Human review of one render per shape per grid size remains mandatory (§8.6).

### 4.3 Difficulty is not driven by arrow count

In the §7.2 formula, `n` carries a weight of 0.5 out of 10.1. A 90-arrow board with 20 free moves at every step scores around `D = 4.5`. That is intended: it is a long, relaxing, satisfying clear-out, not a brain-teaser. Difficulty is carried by dependency depth and by how few options exist at the tightest moment.

### 4.4 Touch targets, hit-testing and zoom

Cell sizes at fit-to-screen:

| Screen width | 10×10 | 12×12 | 13×13 | 14×14 |
|---|---|---|---|---|
| 320dp | 28.8dp | 24.0dp | 22.2dp | 20.6dp |
| 360dp | 32.8dp | 27.3dp | 25.2dp | 23.4dp |
| 412dp | 38.0dp | 31.7dp | 29.2dp | 27.1dp |

All below the 44dp guideline, so two mechanisms are **mandatory**, not optional:

1. **Pinch-to-zoom** (§5.5). The player can magnify any region to comfortable size. This is why the v2 device grid caps are removed.
2. **Proximity hit-testing.** On tap, select the nearest arrow whose path passes within `22dp / currentScale` of the touch point in board space. Arrows never overlap, so this is unambiguous. Zooming in therefore tightens precision automatically, which is exactly the behaviour a player expects.

Additionally: arrow stroke width `0.46 × cellSize`, minimum 8dp. On 1-cell arrows the arrowhead is drawn at `0.7 × cellSize` so single-cell arrows stay clearly visible and clearly directional.

### 4.5 Shape library

Minimum 140 original silhouettes across fruits, animals, objects, nature, symbols, food, vehicles, weather. Each authored at 3–4 grid sizes with 2–4 decompositions → well over 500 unique boards. **All geometry original.** No character IP, no logos, no traced third-party artwork, no other game's level designs.

---

## 5. Screens

Ten screens, matched to the storyboard. No store, no coins, no bottom navigation, no banner ads, no score during gameplay.

### 5.1 Splash

Dark panel, `ARROW / ESCAPE` gradient wordmark, cyan `UNLOCK YOUR WAY OUT`, coloured neon arrows drifting in the background, faint dotted cat and apple silhouettes at the base, `TAP TO START »`.

**Conflict resolved:** the brief says auto-advance in 1.5–2s; the storyboard shows `TAP TO START`. Both ship — auto-advance at 1.8s, tap skips immediately, the label pulses gently. Level packs, save data and audio preload during the animation.

### 5.2 Home

Settings gear top-left. Wordmark centred. Three 56dp buttons, full width minus 32dp, 14dp gap: `▶ PLAY` (blue), `▦ LEVELS` (purple), `⚙ SETTINGS` (green). Faint dotted silhouettes below as decoration. Small `LEVEL 27` progress line and best score under the wordmark, plus a `HOW TO PLAY` link. Nothing else.

### 5.3 Level Selection

Back arrow, `LEVELS` title. Paginated pager, **25 levels per page in a 5×5 grid**, page dots at the bottom, per the storyboard. 500 levels = 20 pages.

- Completed: number + 1–3 gold stars beneath.
- Current: bright yellow neon outline with a slow pulse.
- Locked: dimmed card with a padlock, no number.
- Band name shown as a subtitle under the title, updating per page.
- Dot indicator shows a 5-dot window plus a `3 / 20` label.
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
- Hearts fade in only after the first blocked tap on levels 1–25.

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

## 6. Onboarding — how to play

Your table reserves levels 1–3 for Tutorial. That covers the core rule but not direction, ordering or zoom, so the scripted layer runs to level 10 with a progressively lighter touch. Rules: **one idea per level, no timer, no stars shown, no failure possible, no caption longer than 6 words, every coach mark dismissible by tapping anywhere.**

| Lvl | Grid | Arrows | Teaches | Coach mark |
|---|---|---|---|---|
| 1 | 5×5 | 3–4, all free | Tap an arrow → it flies out | Ghost hand taps it. **"Tap to send it out"** |
| 2 | 5×5 | 4–5, all free | You choose the order | **"Any order works"** |
| 3 | 6×6 | 5–7, one blocked | Blocked = something's in the way | Caption appears only *after* the shake: **"Clear its path first"** |
| 4 | 7×7 | 8, includes an L-path | The **head** sets direction, not the body | Arrowhead pulses once. **"It follows the arrowhead"** |
| 5 | 7×7 | 9, one 3-deep chain | Order matters in sequence | No caption; struggle assist tuned to 12s |
| 6 | 7×7 | 10, first real silhouette | The board is a picture | On win the shape redraws in outline. **"Nice — it was a heart!"** |
| 7 | 7×7 | 11 | HINT exists | HINT pill pulses at start. **"Stuck? Use a hint"** |
| 8 | 7×7 | 12, first star rating | Stars and score | Level Complete explains stars once |
| 11 | 8×8 | 16+ | **Pinch to zoom** — fires on the first 8×8 board | Two-finger ghost gesture. **"Pinch to zoom in"** |
| 26 | 9×9 | 20+ | Hearts appear for the first time | **"Careful — mistakes cost hearts"** |

Levels 9, 10 and 12–25 run clean. Lives stay off until level 26 regardless.

**Presentation.** 55% dim with a soft radial spotlight over the target. Ghost-hand loop at 900ms, fading after 3 loops. Caption in a rounded pill, 18sp semibold, on the opposite half of the board from the target. The overlay never blocks the target's touch area. A small `SKIP` appears from level 2; skipping sets `tutorialCompleted = true` and jumps to level 11 (the zoom and hearts marks still fire, since they teach mechanics the player cannot infer).

**First launch:** `Splash → Home → Level 1 auto-opens if tutorialCompleted === false`.

**How to Play** (Home and Settings) — a 5-card pager, each with a small looping animated board:
1. Tap an arrow to send it out of the board.
2. It follows the arrowhead, even around corners.
3. If something blocks it, it shakes — clear the blocker first.
4. Pinch to zoom in on busy boards.
5. Empty the board to finish. Fewer mistakes = more stars.

Under 25 seconds to read.

---

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

## 8. Level pipeline (build-time Node + TypeScript)

Levels are generated and validated offline, then committed as data. The app never generates levels at runtime.

### 8.1 Stage 1 — Shape mask

Hand-authored binary masks per shape per grid size, stored as reviewable strings:

```ts
export const cat: ShapeMask = {
  name: 'cat', category: 'animal',
  grids: {
    11: [
      '.#.......#.', '##.......##', '###########',
      '#.#.....#.#', '###########', '.#########.',
      '.#########.', '.###.....##', '.###......#',
      '.#####...##', '..#####.##.',
    ],
  },
};
```

Mask cell count must land within ±8% of `targetArrows × targetMeanPathLength` for the band (§4.2), or the generator rejects the mask for that grid size.

### 8.2 Stage 2 — Path decomposition

Seeded randomised DFS with backtracking carves the mask into simple paths:
- Length 1–8 cells, drawn to match the band's target distribution (§4.2) within ±3 percentage points per bucket.
- No path self-touches or revisits; ≤ 3 turns.
- Every mask cell consumed; orphan cells force a backtrack.
- At least 3 paths of length ≥ 4 with ≥ 1 turn ("feature paths"), placed on the silhouette's most characteristic contour.
- Colour assignment balanced: no colour on more than 25% of arrows for `n ≥ 40`, and no two adjacent arrows share a colour.
- Reproducible from `(shape, gridSize, seed)`.

### 8.3 Stage 3 — Orientation search

A 1-cell arrow has 4 possible directions; a longer path has 2. Search space is therefore up to `4^k · 2^(n−k)` — too large for brute force at `n = 90`, so use simulated annealing over orientation assignments with the objective:

1. **Solvable** (§8.4) — hard requirement.
2. `D` within ±0.4 of the slot's target.
3. `freeMinCount ≥ 3` for any level with `D < 5`. Chains with fewer than 3 free options allowed only at `D ≥ 5`, and only for up to 3 consecutive moves.
4. **More than one valid solve order** for all non-milestone levels; near-unique reserved for every-25th milestones.

Failure after `N` restarts → re-run stage 2 with a new seed.

### 8.4 Stage 4 — Validation (exact, from §2.3)

```ts
function validate(level: Level): Validation {
  let active = [...level.arrows];
  const order: string[] = [];
  const freeCounts: number[] = [];
  while (active.length) {
    const free = active.filter(a => isFree(a, active));
    if (free.length === 0) return { solvable: false };      // reject
    freeCounts.push(free.length);
    const pick = canonicalPick(free);                        // deterministic
    order.push(pick.id);
    active = active.filter(a => a.id !== pick.id);
  }
  return { solvable: true, order, freeCounts, depth: dependencyDepth(level) };
}
```

Monotonicity makes this greedy pass a **proof**, not a heuristic. `canonicalPick` also produces the hint order.

CI runs `validateAll()` across all 500 levels and fails the build on: any unsolvable level, any `D` more than ±0.6 outside its slot window, any duplicate board, any arrow count outside its band, overlapping cells, a path-length distribution more than 3 points off target, or a colour-balance violation.

### 8.5 Stage 5 — Packing

Chunked JSON, 25 levels per pack (aligned to the level-select pager):

```json
{ "v":1, "from":26, "to":50, "levels":[
  { "id":26, "g":9, "t":"apple", "d":2.9, "p":112,
    "a":[ ["c","2,2 2,3 2,4 3,4","D"], ["p","5,1","R"], ["y","7,3 7,4","U"] ] }
]}
```

`a[i] = [colorKey, "cells", direction]`. Direction is stored explicitly — required for 1-cell arrows, redundant validation for the rest. At 90 arrows a level is roughly 3KB; 500 levels ≈ 1.4MB total. Current pack plus two neighbours held in memory; the rest lazily required.

### 8.6 Human review gate

Automated validation cannot judge whether a board still looks like a cat. Before a pack ships, one PNG render per shape per grid size is generated by `tools/renderContactSheet.ts` and reviewed by a human at 320dp scale. Rejections go back to stage 2 with a new seed or a revised mask.

### 8.7 Developer mode

Behind 7 taps on the version string in About, plus `__DEV__`. Level jump, reload, full solution reveal, re-validate, computed `D`, free-count trace, dependency-graph overlay, FPS meter, and a zoom-state readout. Never reachable by a normal user in release.

---

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

- **Background:** near-black navy, subtle vertical gradient, radial vignette. Panels are rounded cards (`radius.panel`) with a 1px 8%-white border and a soft outer shadow.
- **Dotted grid** at 10% opacity.
- **Arrows:** rounded caps and joins, stroke `0.46 × cellSize` (min 8dp). Arrowhead is a filled triangle aligned to `direction`; on 1-cell arrows it is drawn at `0.7 × cellSize`.
- **Decor layer** (the cat's eyes, nose, mouth) drawn in `text.primary` at 70% opacity as a non-interactive overlay, keyed per shape. Cosmetic only; occupies no grid cells. Required on every shape from level 100 onward (§4.2).
- **Glow is selective.** Board arrows, the wordmark and primary CTAs glow. Headers, list rows, toggles and level cards do not. On boards of 60+ arrows, per-arrow glow opacity drops to 60% of standard to prevent the board turning into a haze.
- **Buttons:** 56dp, `radius.lg`, gradient fill, left icon, scale to 0.96 on press over 90ms with a `selection` haptic.
- **Transitions:** 220ms fade-through; game entry adds a slight board scale-in.
- Colour is never the sole signal for state.

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
  cells: GridPoint[];        // 1..8 cells, tail → head
  direction: Direction;      // explicit; required for 1-cell arrows
}

export interface Level {
  id: number;
  gridSize: number;          // 5..14
  theme: string;
  band: Band;
  difficulty: number;        // computed D, 1..10, never > 7
  parTime: number;
  arrows: ArrowPath[];       // 3..90
  decor?: DecorPath[];       // cosmetic overlay
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

## 19. Build phases

| Phase | Deliverable | Exit criterion |
|---|---|---|
| 1 | RN CLI TS project, Android build green | `assembleDebug` succeeds, app launches |
| 2 | Navigation, all screen shells, theme tokens | Every storyboard screen reachable |
| 3 | Board renderer (dot grid, arrows incl. 1-cell, decor layer) | Renders at 5×5 and 14×14 on 3 screen sizes, 60fps idle |
| 4 | **Viewport: pinch, pan, double-tap, fit, clamping** | 60fps zoom on a synthetic 90-arrow board |
| 5 | Arrow model, occupancy, engine, proximity hit-test | `isFree` and hit-test unit tests pass, incl. under zoom |
| 6 | Tap resolution, blocked shake, blocker highlight + off-screen chevron | Hand-authored level fully playable |
| 7 | Escape animation, glow, particles, render tiers | JS thread ≥ 55fps at 90 arrows |
| 8 | Win detection, completion sequence, ribbon, stars | §9.4 timing verified |
| 9 | Scoring, stars, Score Summary | §11 formulas unit-tested at n=12 and n=90 |
| 10 | Persistence | Progress survives force-close and reboot |
| 11 | Hint modal, hint service, auto-pan-to-target, struggle assist | Hint always names a valid move and brings it on-screen |
| 12 | Audio, haptics, settings wiring, voice capping | All three toggles verified effective |
| 13 | Hearts, Out of Lives, Pause | Soft-fail per §3.2 verified |
| 14 | **Tutorial levels 1–8 + zoom/hearts marks + How to Play** | 3 of 3 new testers finish level 5 unprompted and discover zoom by level 12 |
| 15 | Level pipeline, contact-sheet review, first 100 levels | `validateAll()` green; curve report matches §4; shapes legible |
| 16 | Levels 101–500 | 500 levels validated; `D ≤ 7.0` across the set |
| 17 | Performance pass + release build | Release AAB, cold start < 1.8s, 60fps at 14×14 / 90 arrows |

Phase 4 sits early on purpose: zoom touches hit-testing, rendering and hints, and retrofitting it after the engine exists is expensive.

---

## 20. Acceptance criteria

**Build & runtime**
- [ ] Release AAB builds; launches clean with no crash
- [ ] Zero `expo-*` packages in `package.json` or lockfile
- [ ] Fully playable in airplane mode from first launch

**Gameplay**
- [ ] All 500 levels load and validate as solvable
- [ ] Arrow counts and grid sizes match the §4.1 table exactly
- [ ] Path-length distributions within 3 points of the §4.2 targets
- [ ] No level exceeds `D = 7.0`; every 10-block satisfies §3.1
- [ ] Free arrows always escape; blocked arrows always shake and never vanish
- [ ] Win fires exactly at `activeArrowCount === 0`
- [ ] Property test: 100 sampled levels, random play, no reachable state ever unsolvable

**Board interaction**
- [ ] Pinch, pan, double-tap and fit all work per §5.5
- [ ] Tap vs pan disambiguation correct — no accidental arrow taps while panning
- [ ] Pan clamped; board edges never enter the viewport
- [ ] Zoom resets to fit on level change
- [ ] Board is crisp at 3.5× after the settle re-render
- [ ] Hint brings its target on-screen on 40+ arrow boards
- [ ] Blocked-arrow chevron appears when the blocker is off-screen

**Legibility**
- [ ] Every shape reviewed and legible at 320dp fit scale
- [ ] 1-cell arrows clearly visible and clearly directional at 14×14

**Onboarding**
- [ ] Levels 1–8 fire coach marks once each on a fresh install
- [ ] Zoom mark fires at level 11; hearts mark at level 26
- [ ] Tutorial skippable from level 2
- [ ] How to Play reachable from Home and Settings

**Anti-frustration**
- [ ] No timer or countdown during gameplay
- [ ] Lives disabled below level 26; Out of Lives never costs progress
- [ ] Star thresholds scale with arrow count per §11
- [ ] Restart always available and instant

**Brief compliance**
- [ ] No score displayed during gameplay
- [ ] No store, coins, currency, shop, inventory, spin wheel, XP, energy, undo, bottom navigation, or banner ad anywhere
- [ ] Board occupies ≥ 62% of screen height on a 16:9 device

**Persistence & settings**
- [ ] Progress, stars, scores and settings survive force-close and reboot
- [ ] All three toggles take effect immediately

**Performance**
- [ ] 60fps idle, zooming, and during escapes on a 14×14 / 90-arrow board
- [ ] Cold start to Home < 1.8s

**Legal**
- [ ] All shapes, artwork and audio original or commercially licensed
- [ ] No third-party game names, logos, characters or level designs

---

## 21. Non-goals

Store, coins, currency, inventory, spin wheel, XP, energy, lives purchase, daily rewards, leaderboards, accounts, cloud save, multiplayer, iOS (v1), landscape, undo, bottom navigation, banner ads, analytics, push notifications, in-gameplay score display.

---

## 22. Open decisions

1. **Storage library** — AsyncStorage vs MMKV. Decide before Phase 10.
2. **Audio library** — confirm the CLI-compatible package and pin its version in Phase 1.
3. **Render tier thresholds** (§13) — provisional until the Phase 7 benchmark on the reference device.
4. **Score Summary frequency** — currently milestones, high scores, and on demand. Widen or narrow after playtest.
5. **maxScale** — 3.5× is a starting value; confirm against a 14×14 board on a 320dp device during Phase 4.
