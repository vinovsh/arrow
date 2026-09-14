# Audio licences

§14 requires every sound shipped in Arrow Escape to be original or licensed for
commercial redistribution, and requires that licence to be recorded here. This file is
the record; a build that ships a sound not listed below is not clearable for release.

## Status

**Three of eleven effects ship.** The rest are still absent, and `AudioService`
degrades silently when a file is missing — every `play()` call for an unshipped
sound is a no-op — so the game stays fully playable while the remainder is produced.

| Shipped | Still absent |
|---|---|
| `ui_tap` `arrow_move` `arrow_blocked` | `hint` `star_1` `star_2` `star_3` `score_tick` `level_complete` `life_lost` `game_over` `ambient_loop` |

### Licence of the shipped three

**Synthesised from first principles for this project; no third-party material.** Each
is a closed-form waveform rendered by ffmpeg from the expression recorded below — sums
of sine partials under an exponential envelope, and for `arrow_move` a uniform noise
source under a difference-of-exponentials envelope. There is no sample, recording,
library or pack anywhere in their provenance, so there is nothing to license and
nothing to attribute. They are original work owned outright, which is what §14 asks
for.

Reproducible verbatim — the expressions *are* the masters, so the files can be
regenerated or retuned at any time without re-clearing anything:

```
ui_tap        aevalsrc='(0.62*sin(2*PI*1500*t)+0.28*sin(2*PI*2700*t))*exp(-t*150)':d=0.045
arrow_move    aevalsrc='0.55*(random(0)*2-1)*(exp(-t*9)-exp(-t*34))':d=0.24
              -af highpass=f=220,lowpass=f=2400,volume=2.6
arrow_blocked aevalsrc='(0.66*sin(2*PI*175*t)+0.22*sin(2*PI*262*t))*exp(-t*17)':d=0.22
              -af lowpass=f=900
```

All three: `-c:a aac -b:a 96k -ar 44100 -ac 1`, ~10KB the three together.

These are deliberately plain. They exist so the game is audible and the timing of the
tap can be felt, and they are meant to be replaced by produced audio rather than to be
the final voice of the game.

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
