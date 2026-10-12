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
  new GameEngine({
    ...(getLevel(levelId > 20 ? 1 : levelId) as Level),
    id: levelId,
  });

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

  it('keeps the campaign to four short lessons', () => {
    expect(TUTORIAL_STEPS.map(s => s.level)).toEqual([1, 2, 3, 4]);
    expect(stepFor(2)?.trigger).toBe('after-first-blocked');
    expect(stepFor(3)?.gesture).toBe('pinch');
    expect(stepFor(5)).toBeNull();
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

  it('skips tips without skipping puzzles and retains the zoom lesson', () => {
    expect(SKIP_FROM_LEVEL).toBe(1);
    SaveStore.skipTutorial();
    expect(SaveStore.data.currentLevel).toBe(1);
    expect(UNSKIPPABLE_LEVELS).toEqual([3]);
    expect(new TutorialController(engineFor(1)).onLevelStart()).toBeNull();
    expect(new TutorialController(engineFor(3)).onLevelStart()).not.toBeNull();
  });

  it('explains a blocked move once on level two', () => {
    const engine = engineFor(2),
      controller = new TutorialController(engine);
    const index = engine.detector
      .activeIndices()
      .find(i => !engine.detector.isFree(i))!;
    expect(controller.onLevelStart()).toBeNull();
    expect(controller.onFirstBlocked(index)?.arrowIndex).toBe(index);
    controller.dismiss();
    expect(controller.onFirstBlocked(index)).toBeNull();
  });

  it('ships five How To Play cards, reachable from Home and Settings', () => {
    expect(HOW_TO_PLAY_CARDS).toHaveLength(5);
    for (const card of HOW_TO_PLAY_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.body.length).toBeGreaterThan(0);
    }
  });
});

describe('challenging early boards', () => {
  it('requires unlocking other arrows even in levels one and two', () => {
    for (const id of [1, 2]) {
      const engine = engineFor(id);
      const free = engine.detector.freeIndices().length;
      expect(free).toBeGreaterThan(0);
      expect(free).toBeLessThan(engine.level.arrows.length / 2);
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

  it('uses the same heart rules throughout the scripted run', () => {
    for (let id = 1; id <= 20; id++) {
      expect(engineFor(id).livesEnabled).toBe(true);
    }
  });
});
