import type {Level} from '../models/types';

export interface Reaction {
  kind: 'halfway' | 'complete';
  emoji: string;
  caption: string;
}

/** Attempt-local milestones: legal removals count, mistakes and hints do not. */
export class ReactionMilestones {
  private halfwayShown = false;
  reset(): void {
    this.halfwayShown = false;
  }
  reachedHalfway(removed: number, total: number): boolean {
    if (
      this.halfwayShown ||
      total < 2 ||
      removed < Math.ceil(total / 2) ||
      removed >= total
    ) {
      return false;
    }
    this.halfwayShown = true;
    return true;
  }
}

export function reactionFor(
  level: Pick<Level, 'id' | 'band'>,
  kind: Reaction['kind'],
  blockedTaps = 0,
  hintsUsed = 0,
): Reaction {
  if (kind === 'halfway') {
    const options = [
      {emoji: '😎', caption: 'Nice moves!'},
      {emoji: '🤩', caption: 'Halfway there!'},
      {emoji: '😁', caption: 'Keep it going!'},
    ];
    return {kind, ...options[(level.id - 1) % options.length]};
  }
  if (level.band === 'Tutorial') {
    return {kind, emoji: '😄', caption: 'You got it!'};
  }
  if (
    ['Hard', 'Very Hard'].includes(level.band) &&
    blockedTaps === 0 &&
    hintsUsed === 0
  ) {
    return {kind, emoji: '🤩', caption: 'Genius!'};
  }
  return {
    kind,
    emoji: '🥳',
    caption: level.band === 'Very Hard' ? 'Impressive!' : 'Great job!',
  };
}
