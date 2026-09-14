import Sound from 'react-native-sound';
import {SaveStore} from '../storage/SaveStore';

/**
 * §14 — audio. react-native-sound, not Expo AV: nothing `expo-*` may enter the
 * dependency graph (§18).
 *
 * The interesting constraint is polyphony. A fast clear-out on a 90-arrow board fires
 * `arrow_move` dozens of times in a couple of seconds, and unthrottled that reads as
 * a buzz rather than as a run of satisfying taps. So voices are capped at four with
 * oldest-stolen, and any one effect refuses to retrigger inside 45ms.
 */
export type SoundName =
  | 'ui_tap'
  | 'arrow_move'
  | 'arrow_blocked'
  | 'hint'
  | 'star_1'
  | 'star_2'
  | 'star_3'
  | 'score_tick'
  | 'level_complete'
  | 'life_lost'
  | 'game_over';

const FILES: Record<SoundName, string> = {
  ui_tap: 'ui_tap.m4a',
  arrow_move: 'arrow_move.m4a',
  arrow_blocked: 'arrow_blocked.m4a',
  hint: 'hint.m4a',
  star_1: 'star_1.m4a',
  star_2: 'star_2.m4a',
  star_3: 'star_3.m4a',
  score_tick: 'score_tick.m4a',
  level_complete: 'level_complete.m4a',
  life_lost: 'life_lost.m4a',
  game_over: 'game_over.m4a',
};

const MUSIC_FILE = 'ambient_loop.m4a';

export const MAX_VOICES = 4;
export const MIN_RETRIGGER_MS = 45;
/** §14 — music sits at −18dB and ducks a further 6dB during the win sequence. */
const MUSIC_VOLUME = 0.13;
const MUSIC_DUCKED_VOLUME = 0.065;
/** −8dB relative to a move, so blocked reads as information rather than a buzzer. */
const BLOCKED_VOLUME = 0.4;
/**
 * §14 — the tick sits under the move it accompanies rather than alongside it. Both
 * fire on the same tap, and at equal weight the click and the whoosh smear into one
 * muddy noise; half volume keeps the tick as the leading edge of the move instead of
 * a second sound competing with it.
 */
const TAP_TICK_VOLUME = 0.5;

interface Voice {
  sound: Sound;
  startedAt: number;
}

class AudioServiceImpl {
  private pool = new Map<SoundName, Sound[]>();
  private playing: Voice[] = [];
  private lastPlayedAt = new Map<SoundName, number>();
  private music: Sound | null = null;
  private ready = false;

  /** §5.1 — preloaded during the splash animation, alongside packs and save data. */
  async preload(): Promise<void> {
    if (this.ready) {
      return;
    }
    Sound.setCategory('Ambient', true);
    const names = Object.keys(FILES) as SoundName[];
    await Promise.all(names.map(name => this.loadOne(name)));
    await this.loadMusic();
    this.ready = true;
  }

  private loadOne(name: SoundName): Promise<void> {
    return new Promise(resolve => {
      // Two instances per effect is enough to overlap without paying for eleven
      // decoders; the voice cap is what actually bounds concurrency.
      const copies: Sound[] = [];
      let pending = 2;
      const done = (): void => {
        if (--pending === 0) {
          this.pool.set(name, copies);
          resolve();
        }
      };
      for (let i = 0; i < 2; i++) {
        const sound: Sound = new Sound(
          FILES[name],
          Sound.MAIN_BUNDLE,
          error => {
            if (!error) {
              copies.push(sound);
            }
            done();
          },
        );
      }
    });
  }

  private loadMusic(): Promise<void> {
    return new Promise(resolve => {
      const music: Sound = new Sound(MUSIC_FILE, Sound.MAIN_BUNDLE, error => {
        if (!error) {
          music.setNumberOfLoops(-1);
          music.setVolume(MUSIC_VOLUME);
          this.music = music;
        }
        resolve();
      });
    });
  }

  private reap(now: number): void {
    this.playing = this.playing.filter(voice => voice.sound.isPlaying());
    while (this.playing.length >= MAX_VOICES) {
      const oldest = this.playing.shift();
      oldest?.sound.stop();
    }
    void now;
  }

  /**
   * @param rate playback rate, used to pitch-vary `arrow_move` by path length (§9.2).
   */
  play(name: SoundName, rate = 1, volume = 1): void {
    if (!SaveStore.data.soundEnabled) {
      return;
    }
    const now = Date.now();
    if (now - (this.lastPlayedAt.get(name) ?? 0) < MIN_RETRIGGER_MS) {
      return;
    }
    const copies = this.pool.get(name);
    if (!copies || copies.length === 0) {
      return;
    }

    this.reap(now);
    const sound = copies.find(s => !s.isPlaying()) ?? copies[0];
    this.lastPlayedAt.set(name, now);
    sound.stop(() => {
      sound.setVolume(volume);
      sound.setSpeed(rate);
      sound.play();
    });
    this.playing.push({sound, startedAt: now});
  }

  /** §9.2 — pitch varies ±2 semitones with path length so runs of taps stay musical. */
  playArrowMove(pathLength: number): void {
    const semitones = 2 - ((pathLength - 1) / 7) * 4;
    this.play('arrow_move', Math.pow(2, semitones / 12));
  }

  playBlocked(): void {
    this.play('arrow_blocked', 1, BLOCKED_VOLUME);
  }

  /**
   * The tick that answers the tap itself — played *with* the move, not instead of it.
   * The move sound is pitched by path length and reads as the arrow travelling; this
   * is the shorter, flatter click that confirms the finger landed on something.
   */
  playTap(): void {
    this.play('ui_tap', 1, TAP_TICK_VOLUME);
  }

  playStar(index: 0 | 1 | 2): void {
    this.play((['star_1', 'star_2', 'star_3'] as const)[index]);
  }

  startMusic(): void {
    if (!SaveStore.data.musicEnabled || !this.music || this.music.isPlaying()) {
      return;
    }
    this.music.setVolume(MUSIC_VOLUME);
    this.music.play();
  }

  stopMusic(): void {
    this.music?.stop();
  }

  /** §14 — ducked 6dB during the completion sequence. */
  duckMusic(ducked: boolean): void {
    this.music?.setVolume(ducked ? MUSIC_DUCKED_VOLUME : MUSIC_VOLUME);
  }

  /** Settings toggles take effect immediately, including on already-looping music. */
  applySettings(): void {
    if (SaveStore.data.musicEnabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  release(): void {
    for (const copies of this.pool.values()) {
      for (const sound of copies) {
        sound.release();
      }
    }
    this.pool.clear();
    this.music?.release();
    this.music = null;
    this.ready = false;
  }
}

export const Audio = new AudioServiceImpl();
