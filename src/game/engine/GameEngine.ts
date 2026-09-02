import type {ArrowState, Level} from '../models/types';
import {CollisionDetector} from './CollisionDetector';
import {HitTester, HIT_RADIUS_DP} from './HitTester';
import {blockedTapsPerHeart} from './ScoreManager';
import {FEATURES} from '../../app/featureFlags';

export type TapOutcome =
  | {kind: 'ignored'}
  | {
      kind: 'escaped';
      arrowIndex: number;
      exitDistance: number;
      boardCleared: boolean;
    }
  | {
      kind: 'blocked';
      arrowIndex: number;
      blockerIndex: number;
      heartLost: boolean;
    };

export interface EngineSnapshot {
  activeCount: number;
  blockedTaps: number;
  hintsUsed: number;
  hearts: number;
  elapsedSeconds: number;
}

export const MAX_HEARTS = 3;

/**
 * Authoritative game state (§12). Lives in a ref, never in React state — the board
 * re-renders per arrow, driven by explicit subscriptions rather than by state churn.
 */
export class GameEngine {
  readonly level: Level;
  readonly detector: CollisionDetector;
  readonly hitTester: HitTester;
  readonly livesEnabled: boolean;

  private states: ArrowState[];
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private lastMoveAt = 0;
  private consecutiveBlocked = 0;

  blockedTaps = 0;
  hintsUsed = 0;
  hearts = MAX_HEARTS;

  constructor(level: Level) {
    this.level = level;
    this.detector = new CollisionDetector(level.gridSize, level.arrows);
    this.hitTester = new HitTester(level.arrows);
    this.livesEnabled = level.id >= FEATURES.livesFromLevel;
    this.states = level.arrows.map(() => 'active' as ArrowState);
    this.start();
  }

  start(): void {
    this.startedAt = Date.now();
    this.lastMoveAt = this.startedAt;
    this.pausedAt = null;
    this.pausedTotal = 0;
  }

  /** §5.11 — the game clock stops while paused; time only feeds the speed bonus. */
  pause(): void {
    if (this.pausedAt === null) {
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this.pausedAt !== null) {
      this.pausedTotal += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  restart(): void {
    this.detector.reset();
    this.states = this.level.arrows.map(() => 'active' as ArrowState);
    this.blockedTaps = 0;
    this.hintsUsed = 0;
    this.hearts = MAX_HEARTS;
    this.consecutiveBlocked = 0;
    this.start();
  }

  /** Restores hearts without touching progress, stars or score (§3.2). */
  refillHearts(count = MAX_HEARTS): void {
    this.hearts = Math.min(MAX_HEARTS, count);
  }

  grantExtraLife(): void {
    this.hearts = Math.max(this.hearts, 1);
  }

  stateOf(index: number): ArrowState {
    return this.states[index];
  }

  get activeCount(): number {
    return this.detector.activeCount;
  }

  get elapsedSeconds(): number {
    const now = this.pausedAt ?? Date.now();
    return (now - this.startedAt - this.pausedTotal) / 1000;
  }

  get secondsSinceLastMove(): number {
    return (Date.now() - this.lastMoveAt) / 1000;
  }

  get consecutiveBlockedTaps(): number {
    return this.consecutiveBlocked;
  }

  snapshot(): EngineSnapshot {
    return {
      activeCount: this.detector.activeCount,
      blockedTaps: this.blockedTaps,
      hintsUsed: this.hintsUsed,
      hearts: this.hearts,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  /**
   * Board-space hit test. `cellSize` is the dp size of a cell at scale 1 and `scale`
   * the live zoom, so the slop shrinks as the player magnifies the board (§4.4).
   */
  hitTest(
    boardX: number,
    boardY: number,
    cellSize: number,
    scale: number,
  ): number {
    const radiusCells = HIT_RADIUS_DP / Math.max(1, cellSize * scale);
    return this.hitTester.hitTest(boardX, boardY, radiusCells, i =>
      this.detector.isActive(i),
    );
  }

  /** §2.2 — tap resolution. The caller owns animation, sound and haptics. */
  resolveTap(arrowIndex: number): TapOutcome {
    if (arrowIndex < 0 || this.states[arrowIndex] !== 'active') {
      return {kind: 'ignored'};
    }

    const blocker = this.detector.firstBlocker(arrowIndex);
    if (blocker === -1) {
      this.states[arrowIndex] = 'escaping';
      const exitDistance = this.detector.exitDistance(arrowIndex);
      this.detector.remove(arrowIndex);
      this.states[arrowIndex] = 'escaped';
      this.consecutiveBlocked = 0;
      this.lastMoveAt = Date.now();
      return {
        kind: 'escaped',
        arrowIndex,
        exitDistance,
        boardCleared: this.detector.activeCount === 0,
      };
    }

    this.blockedTaps++;
    this.consecutiveBlocked++;
    let heartLost = false;
    if (this.livesEnabled) {
      const per = blockedTapsPerHeart(this.level.arrows.length);
      if (this.blockedTaps % per === 0 && this.hearts > 0) {
        this.hearts--;
        heartLost = true;
      }
    }
    return {kind: 'blocked', arrowIndex, blockerIndex: blocker, heartLost};
  }

  /**
   * §3.3 — silent assist. Fires at most once per attempt per trigger; the caller
   * pulses one valid arrow with no modal, no text and no score penalty.
   */
  shouldOfferSilentAssist(): boolean {
    return (
      this.consecutiveBlocked >= 4 ||
      this.secondsSinceLastMove >= 25 ||
      this.elapsedSeconds > 2.5 * this.level.parTime
    );
  }
}
