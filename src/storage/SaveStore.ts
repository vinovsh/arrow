import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import type {AppStateStatus, NativeEventSubscription} from 'react-native';
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_KEY,
  defaultSave,
  migrate,
} from './migrations';
import type {SaveData} from './migrations';

/** §15 — writes are debounced, and always flushed on level complete and on background. */
const WRITE_DEBOUNCE_MS = 400;

type Listener = (data: SaveData) => void;

/**
 * The single source of truth for progress and settings (§15).
 *
 * Read once at Splash and then held in memory: every screen reads synchronously from
 * `data` and writes through `update`, so nothing on a hot path ever awaits storage.
 * Open decision 1 in §22 picked AsyncStorage; the surface here is deliberately
 * async-free apart from `load` and `flush` so swapping in MMKV touches only this file.
 */
class SaveStoreImpl {
  private state: SaveData = defaultSave();
  private loaded = false;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private appStateSubscription: NativeEventSubscription | null = null;

  get data(): SaveData {
    return this.state;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<SaveData> {
    if (this.loaded) {
      return this.state;
    }
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      this.state = raw ? migrate(JSON.parse(raw)) : defaultSave();
    } catch {
      // Unreadable or unparseable storage must never block a launch (§15).
      this.state = defaultSave();
    }
    this.loaded = true;
    this.watchAppState();
    this.emit();
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private watchAppState(): void {
    if (this.appStateSubscription) {
      return;
    }
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        if (status !== 'active') {
          void this.flush();
        }
      },
    );
  }

  /** Merges a patch, notifies subscribers, and schedules a debounced write. */
  update(patch: Partial<SaveData>): SaveData {
    this.state = {
      ...this.state,
      ...patch,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    this.dirty = true;
    this.emit();
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.flush();
    }, WRITE_DEBOUNCE_MS);
    return this.state;
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) {
      return;
    }
    this.dirty = false;
    try {
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      // A failed write is not worth crashing over; the next update retries.
      this.dirty = true;
    }
  }

  // ---------------------------------------------------------------- progress

  isUnlocked(levelId: number): boolean {
    // §3.5 — levels unlock by completion alone. No star gates, no coins.
    return levelId === 1 || this.state.completedLevels.includes(levelId - 1);
  }

  starsFor(levelId: number): 0 | 1 | 2 | 3 {
    return this.state.levelStars[levelId] ?? 0;
  }

  scoreFor(levelId: number): number {
    return this.state.levelScores[levelId] ?? 0;
  }

  /**
   * Records a finished level. Stars and per-level score only ever improve on a
   * replay, and bestScore is the lifetime cumulative total (§11), so it moves by the
   * *gain* rather than being recomputed.
   */
  recordCompletion(levelId: number, stars: 1 | 2 | 3, score: number): SaveData {
    const previousScore = this.scoreFor(levelId);
    const previousStars = this.starsFor(levelId);
    const gain = Math.max(0, score - previousScore);

    const completedLevels = this.state.completedLevels.includes(levelId)
      ? this.state.completedLevels
      : [...this.state.completedLevels, levelId];

    return this.update({
      completedLevels,
      currentLevel: Math.max(this.state.currentLevel, levelId + 1),
      levelStars: {
        ...this.state.levelStars,
        [levelId]: Math.max(previousStars, stars) as 1 | 2 | 3,
      },
      levelScores: {
        ...this.state.levelScores,
        [levelId]: Math.max(previousScore, score),
      },
      bestScore: this.state.bestScore + gain,
    });
  }

  /** True when this run beat the stored per-level best — drives NEW HIGH SCORE! */
  isNewHighScore(levelId: number, score: number): boolean {
    return score > this.scoreFor(levelId);
  }

  markTutorialStep(step: number): void {
    if (this.state.tutorialStepsSeen.includes(step)) {
      return;
    }
    this.update({tutorialStepsSeen: [...this.state.tutorialStepsSeen, step]});
  }

  /** §6 — skipping the tutorial jumps to level 11, where the zoom mark still fires. */
  skipTutorial(): void {
    this.update({
      tutorialCompleted: true,
      currentLevel: Math.max(this.state.currentLevel, 11),
    });
  }

  /** Test seam; production code only ever calls load(). */
  resetForTests(data: SaveData = defaultSave()): void {
    this.state = data;
    this.loaded = true;
    this.dirty = false;
  }
}

export const SaveStore = new SaveStoreImpl();
export type {SaveData};
