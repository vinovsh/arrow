# Audio licences

§14 requires every sound shipped in Arrow Escape to be original or licensed for
commercial redistribution, and requires that licence to be recorded here. This file is
the record; a build that ships a sound not listed below is not clearable for release.

## Status

**No audio files ship yet.** `AudioService` is wired to the full §14 event table,
loads from `android/app/src/main/res/raw/`, and degrades silently when a file is
absent — every `play()` call becomes a no-op, so the game is fully playable without
sound while the audio is being produced or sourced.

## Required files

Mono, 44.1kHz `.m4a`, whole payload under 1.5MB, preloaded during Splash (§14).
File names are fixed by `FILES` in `src/audio/AudioService.ts`.

| File | Event | Notes |
|---|---|---|
| `ui_tap.m4a` | Button tap | Short, dry, no tail |
| `arrow_move.m4a` | Arrow escapes | Pitch-varied ±2 semitones by path length; must survive a 45ms retrigger and four-voice overlap without turning into a buzz |
| `arrow_blocked.m4a` | Arrow blocked | Soft and low, played at −8dB relative to a move. Information, not a buzzer — no harshness, no alarm colour |
| `hint.m4a` | Hint used | |
| `star_1.m4a` `star_2.m4a` `star_3.m4a` | Stars land | Rising pitch across the three |
| `score_tick.m4a` | Score counts up | Very short; fires repeatedly |
| `level_complete.m4a` | Completion sequence | |
| `life_lost.m4a` | Heart spent | Deflating, not punishing (§3.2) |
| `game_over.m4a` | Out of lives | |
| `ambient_loop.m4a` | Background music | Seamless loop, played at −18dB and ducked a further 6dB during the win sequence |

## Licence record

| File | Source | Licence | Acquired |
|---|---|---|---|
| _(none yet)_ | | | |

For each file added, record where it came from, the exact licence granting commercial
redistribution, and the date. Original recordings are marked `Original — <author>`.

## Installing the files

Android resource names cannot contain uppercase or hyphens, and `react-native-sound`
loads from the raw resource directory:

```
android/app/src/main/res/raw/ui_tap.m4a
```

Copy each file there. Nothing in `src/` changes.
