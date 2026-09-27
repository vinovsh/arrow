# Audio licences

§14 requires every sound shipped in Arrow Escape to be original or licensed for
commercial redistribution, and requires that licence to be recorded here. This file is
the record; a build that ships a sound not listed below is not clearable for release.

## Status

**Seven of eleven effects ship.** The rest are still absent, and `AudioService`
degrades silently when a file is missing — every `play()` call for an unshipped
sound is a no-op — so the game stays fully playable while the remainder is produced.

| Shipped | Still absent |
|---|---|
| `ui_tap` `arrow_move` `arrow_blocked` `level_complete` `star_1` `star_2` `star_3` | `hint` `score_tick` `life_lost` `game_over` `ambient_loop` |

### Licence of the shipped effects

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

The reward chimes are built the same way. `N(o,f,k,a)` is one bell-like note starting
at `o` seconds: fundamental `f` plus octave (0.35), twelfth (0.1) and an inharmonic
2.76·f shimmer (0.12), under `exp(-(t-o)*k)` with a 2.5ms linear attack, scaled by `a`:

```
N(o,f,k,a) = a*gt(t,o)*min(1,(t-o)*400)*exp(-(t-o)*k)*(sin(2πf(t-o))
             + 0.35 sin(2π·2f(t-o)) + 0.1 sin(2π·3f(t-o))
             + 0.12 sin(2π·2.76f(t-o))*exp(-(t-o)*k))

level_complete d=1.1  C6→E6→G6 over a soft C5
               N(0,1046.5,7,.3)+N(.11,1318.5,7,.3)+N(.22,1568,3.8,.34)+N(.22,523.25,4.5,.14)
star_1         d=0.55 N(0,1318.5,9,.42)+N(.02,5274,30,.08)
star_2         d=0.55 N(0,1568,9,.42)+N(.02,6272,30,.08)
star_3         d=0.95 final reward: N(0,2093,4.5,.3)+N(0,1568,5,.18)+N(0,1046.5,5,.14)
                      + sparkle run N(.08,2637,18,.09)+N(.16,3136,18,.09)+N(.24,4186,16,.09)

all four: -af lowpass=f=9000,aecho=0.8:0.5:70|130:0.22|0.12,afade=t=out:st=<d-0.12>:d=0.12,
          volume=<2.4 level_complete | 2.6 star_1/2 | 2.3 star_3>
```

Peaks sit at −4 to −5.5dBFS, just under the tap and blocked sounds.

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
