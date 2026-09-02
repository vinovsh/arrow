import {SaveStore} from '../../storage/SaveStore';
import type {GameEngine} from '../engine/GameEngine';
import {SKIP_FROM_LEVEL, UNSKIPPABLE_LEVELS, stepFor} from './steps';
import type {TutorialStep} from './steps';

export interface ActiveCoachMark {
  step: TutorialStep;
  /** Arrow index the spotlight sits over, or -1 for a board-wide mark. */
  arrowIndex: number;
}

/**
 * §6 — decides which coach mark is showing, and when.
 *
 * Every mark fires at most once per install: `tutorialStepsSeen` is keyed by level, so
 * a replay of level 3 does not re-explain blocking. Skipping sets tutorialCompleted and
 * jumps to level 11, but the zoom and hearts marks still fire, because pinch-to-zoom
 * and the heart economy are the two things a player cannot infer from the board.
 */
export class TutorialController {
  private readonly engine: GameEngine;
  private active: ActiveCoachMark | null = null;
  private dismissed = new Set<number>();

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  get current(): ActiveCoachMark | null {
    return this.active;
  }

  get canSkip(): boolean {
    return (
      this.engine.level.id >= SKIP_FROM_LEVEL &&
      this.engine.level.id <= 10 &&
      !SaveStore.data.tutorialCompleted
    );
  }

  private eligible(step: TutorialStep): boolean {
    if (this.dismissed.has(step.level)) {
      return false;
    }
    if (SaveStore.data.tutorialStepsSeen.includes(step.level)) {
      return false;
    }
    if (
      SaveStore.data.tutorialCompleted &&
      !UNSKIPPABLE_LEVELS.includes(step.level)
    ) {
      return false;
    }
    return true;
  }

  /** Called on level entry. Returns the mark to show, if any. */
  onLevelStart(): ActiveCoachMark | null {
    const step = stepFor(this.engine.level.id);
    if (!step || step.trigger !== 'level-start' || !this.eligible(step)) {
      return null;
    }
    this.active = {step, arrowIndex: this.resolveTarget(step)};
    return this.active;
  }

  /** Called after the first blocked tap of the attempt — level 3's beat. */
  onFirstBlocked(blockerIndex: number): ActiveCoachMark | null {
    const step = stepFor(this.engine.level.id);
    if (
      !step ||
      step.trigger !== 'after-first-blocked' ||
      !this.eligible(step)
    ) {
      return null;
    }
    this.active = {step, arrowIndex: blockerIndex};
    return this.active;
  }

  /** Called on the win sequence — levels 6 and 8 explain themselves after the fact. */
  onWin(): ActiveCoachMark | null {
    const step = stepFor(this.engine.level.id);
    if (!step || step.trigger !== 'on-win' || !this.eligible(step)) {
      return null;
    }
    this.active = {step, arrowIndex: -1};
    return this.active;
  }

  /** §6 — every coach mark is dismissible by tapping anywhere. */
  dismiss(): void {
    if (!this.active) {
      return;
    }
    this.dismissed.add(this.active.step.level);
    SaveStore.markTutorialStep(this.active.step.level);
    this.active = null;
  }

  skip(): void {
    this.active = null;
    SaveStore.skipTutorial();
  }

  /** §3.3 — level 5 tightens the silent assist so the chain teaches itself. */
  assistAfterSeconds(): number {
    return stepFor(this.engine.level.id)?.assistAfterSeconds ?? 25;
  }

  private resolveTarget(step: TutorialStep): number {
    if (step.target.kind !== 'arrow') {
      return -1;
    }
    const active = this.engine.detector.activeIndices();
    switch (step.target.pick) {
      case 'first-free':
        return this.engine.detector.freeIndices()[0] ?? -1;
      case 'first-blocked':
        return (
          active.find(i => this.engine.detector.firstBlocker(i) >= 0) ?? -1
        );
      case 'longest': {
        // Level 4 teaches that the head sets direction, so it points at the path with
        // the most turns — the one where body and head disagree most obviously.
        let best = -1;
        let bestLength = 0;
        for (const index of active) {
          const length = this.engine.level.arrows[index].cells.length;
          if (length > bestLength) {
            bestLength = length;
            best = index;
          }
        }
        return best;
      }
    }
  }
}
