import {SaveStore} from '../src/storage/SaveStore';
import {defaultSave, migrate} from '../src/storage/migrations';

describe('save migration (§15)', () => {
  it('falls back to defaults on anything unreadable, without throwing', () => {
    for (const junk of [null, undefined, 42, 'nope', [], true]) {
      expect(migrate(junk)).toEqual(defaultSave());
    }
  });

  it('keeps good fields when neighbouring ones are corrupt', () => {
    const result = migrate({
      schemaVersion: 1,
      currentLevel: 41,
      completedLevels: [1, 2, 'three', null, 4],
      levelStars: {1: 3, 2: 'gold', 3: 9},
      levelScores: {1: 900},
      bestScore: 24850,
      soundEnabled: 'yes',
      musicEnabled: false,
      tutorialCompleted: true,
    });
    expect(result.currentLevel).toBe(41);
    // Non-numeric entries are dropped rather than poisoning the whole array.
    expect(result.completedLevels).toEqual([1, 2, 4]);
    // A star value outside 1..3 is not a star.
    expect(result.levelStars).toEqual({1: 3});
    expect(result.bestScore).toBe(24850);
    // A non-boolean toggle falls back to its own default, not to the whole save's.
    expect(result.soundEnabled).toBe(true);
    expect(result.musicEnabled).toBe(false);
    expect(result.tutorialCompleted).toBe(true);
  });

  it('never discards a recoverable bestScore (§15)', () => {
    // bestScore itself is unusable, but the per-level totals can rebuild it.
    const result = migrate({
      bestScore: 'corrupt',
      levelScores: {1: 1200, 2: 900, 3: 750},
    });
    expect(result.bestScore).toBe(2850);
  });

  it('prefers the stored bestScore when it exceeds the derived one', () => {
    const result = migrate({bestScore: 99999, levelScores: {1: 100}});
    expect(result.bestScore).toBe(99999);
  });
});

describe('SaveStore progress rules', () => {
  beforeEach(() => {
    SaveStore.resetForTests();
  });

  it('unlocks by completion alone — no star gates, no coins (§3.5)', () => {
    expect(SaveStore.isUnlocked(1)).toBe(true);
    expect(SaveStore.isUnlocked(2)).toBe(false);
    SaveStore.recordCompletion(1, 1, 300);
    expect(SaveStore.isUnlocked(2)).toBe(true);
  });

  it('does not lock the next level behind a perfect run (§3.5)', () => {
    SaveStore.recordCompletion(1, 1, 100);
    expect(SaveStore.isUnlocked(2)).toBe(true);
    expect(SaveStore.data.currentLevel).toBe(2);
  });

  it('only ever improves stars and per-level score on a replay (§11)', () => {
    SaveStore.recordCompletion(7, 3, 1250);
    SaveStore.recordCompletion(7, 1, 300);
    expect(SaveStore.starsFor(7)).toBe(3);
    expect(SaveStore.scoreFor(7)).toBe(1250);
  });

  it('accumulates bestScore by the gain, so a replay cannot double-count', () => {
    SaveStore.recordCompletion(1, 2, 800);
    expect(SaveStore.data.bestScore).toBe(800);
    SaveStore.recordCompletion(1, 3, 1000);
    // The player gained 200 on this level, not another 1000.
    expect(SaveStore.data.bestScore).toBe(1000);
    SaveStore.recordCompletion(2, 1, 500);
    expect(SaveStore.data.bestScore).toBe(1500);
  });

  it('does not rewind currentLevel when an earlier level is replayed', () => {
    SaveStore.recordCompletion(30, 3, 1000);
    expect(SaveStore.data.currentLevel).toBe(31);
    SaveStore.recordCompletion(4, 3, 1000);
    expect(SaveStore.data.currentLevel).toBe(31);
  });

  it('flags a new high score only when the run beats the stored one', () => {
    SaveStore.recordCompletion(5, 2, 700);
    expect(SaveStore.isNewHighScore(5, 900)).toBe(true);
    expect(SaveStore.isNewHighScore(5, 700)).toBe(false);
  });

  it('skipping the tutorial jumps to level 11 (§6)', () => {
    SaveStore.skipTutorial();
    expect(SaveStore.data.tutorialCompleted).toBe(true);
    expect(SaveStore.data.currentLevel).toBe(11);
  });

  it('records each tutorial step at most once', () => {
    SaveStore.markTutorialStep(3);
    SaveStore.markTutorialStep(3);
    expect(SaveStore.data.tutorialStepsSeen).toEqual([3]);
  });

  it('notifies subscribers on every update', () => {
    const seen: number[] = [];
    const stop = SaveStore.subscribe(data => seen.push(data.currentLevel));
    SaveStore.update({currentLevel: 12});
    SaveStore.update({currentLevel: 13});
    stop();
    SaveStore.update({currentLevel: 14});
    expect(seen).toEqual([12, 13]);
  });
});
