import {GameEngine} from '../src/game/engine/GameEngine';
import {TutorialController} from '../src/game/tutorial/TutorialController';
import {
  HOW_TO_PLAY_CARDS,
  SKIP_FROM_LEVEL,
  TUTORIAL_STEPS,
  UNSKIPPABLE_LEVELS,
  stepFor,
} from '../src/game/tutorial/steps';
import {SaveStore} from '../src/storage/SaveStore';
import {getLevel} from '../src/game/levels';
import type {Level} from '../src/game/models/types';

const engineFor = (levelId: number): GameEngine =>
  new GameEngine(getLevel(levelId) as Level);

describe('onboarding script (§6)', () => {
  beforeEach(() => {
    SaveStore.resetForTests();
  });

  it('keeps every caption to six words or fewer', () => {
    for (const step of TUTORIAL_STEPS) {
      const words =
        step.caption.trim() === ''
          ? 0
          : step.caption.trim().split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(6);
    }
  });

  it('teaches one idea per level, with no level scripted twice', () => {
    const levels = TUTORIAL_STEPS.map(s => s.level);
    expect(new Set(levels).size).toBe(levels.length);
  });

  it('covers the beats the spec names, in order', () => {
    expect(TUTORIAL_STEPS.map(s => s.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 11, 26,
    ]);
  });

  it('shows level 3 only after the shake, never before it', () => {
    expect(stepFor(3)?.trigger).toBe('after-first-blocked');
  });

  it('tunes level 5 to a tighter silent assist than the 25s default (§3.3)', () => {
    const engine = engineFor(5);
    const controller = new TutorialController(engine);
    expect(controller.assistAfterSeconds()).toBe(12);
    expect(new TutorialController(engineFor(9)).assistAfterSeconds()).toBe(25);
  });

  it('fires a level-start mark once, then never again on this install', () => {
    const controller = new TutorialController(engineFor(1));
    expect(controller.onLevelStart()).not.toBeNull();
    controller.dismiss();

    // A replay of level 1 must not re-explain the rule.
    const replay = new TutorialController(engineFor(1));
    expect(replay.onLevelStart()).toBeNull();
  });

  it('points level 1 at an arrow that is actually free', () => {
    const engine = engineFor(1);
    const mark = new TutorialController(engine).onLevelStart();
    expect(mark).not.toBeNull();
    expect(mark?.arrowIndex).toBeGreaterThanOrEqual(0);
    expect(engine.detector.isFree(mark?.arrowIndex ?? -1)).toBe(true);
  });

  it('offers SKIP from level 2 onward, but not on level 1 (§6)', () => {
    expect(SKIP_FROM_LEVEL).toBe(2);
    expect(new TutorialController(engineFor(1)).canSkip).toBe(false);
    expect(new TutorialController(engineFor(2)).canSkip).toBe(true);
  });

  it('still fires the zoom and hearts marks after a skip (§6)', () => {
    SaveStore.skipTutorial();
    expect(UNSKIPPABLE_LEVELS).toEqual([11, 26]);

    // A scripted mark the skip covered stays silent...
    expect(new TutorialController(engineFor(4)).onLevelStart()).toBeNull();
    // ...but pinch-to-zoom and the heart economy cannot be inferred from the board.
    expect(new TutorialController(engineFor(11)).onLevelStart()).not.toBeNull();
    expect(new TutorialController(engineFor(26)).onLevelStart()).not.toBeNull();
  });

  it('fires the hearts mark exactly where lives switch on', () => {
    const step = stepFor(26);
    expect(step?.target.kind).toBe('hearts');
    expect(engineFor(26).livesEnabled).toBe(true);
    expect(engineFor(25).livesEnabled).toBe(false);
  });

  it('ships five How To Play cards, reachable from Home and Settings', () => {
    expect(HOW_TO_PLAY_CARDS).toHaveLength(5);
    for (const card of HOW_TO_PLAY_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.body.length).toBeGreaterThan(0);
    }
  });
});

describe('onboarding levels are as gentle as the script assumes (§6)', () => {
  it('gives levels 1 and 2 boards where every arrow is already free', () => {
    for (const id of [1, 2]) {
      const engine = engineFor(id);
      expect(engine.detector.freeIndices()).toHaveLength(
        engine.level.arrows.length,
      );
    }
  });

  it('gives level 3 something to be blocked by, so the shake has a subject', () => {
    const engine = engineFor(3);
    const blocked = engine.detector
      .activeIndices()
      .filter(i => engine.detector.firstBlocker(i) >= 0);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });

  it('gives level 4 a turning path, so the arrowhead lesson has an example', () => {
    const engine = engineFor(4);
    const turning = engine.level.arrows.filter(arrow => {
      for (let i = 2; i < arrow.cells.length; i++) {
        const [a, b, c] = [
          arrow.cells[i - 2],
          arrow.cells[i - 1],
          arrow.cells[i],
        ];
        if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
          return true;
        }
      }
      return false;
    });
    expect(turning.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps lives off for the whole scripted run (§3.2)', () => {
    for (let id = 1; id <= 25; id++) {
      expect(engineFor(id).livesEnabled).toBe(false);
    }
  });
});
