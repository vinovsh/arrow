/** Short, inline lessons for the new long-arrow campaign. */
export type CoachTarget =
  | {kind: 'arrow'; pick: 'first-free' | 'first-blocked' | 'longest'}
  | {kind: 'hint-pill'}
  | {kind: 'board'}
  | {kind: 'hearts'};
export interface TutorialStep {
  level: number;
  caption: string;
  target: CoachTarget;
  gesture: 'tap' | 'pinch' | 'none';
  trigger: 'level-start' | 'after-first-blocked' | 'on-win';
  assistAfterSeconds?: number;
}
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    level: 1,
    caption: 'Tap to remove',
    target: {kind: 'arrow', pick: 'first-free'},
    gesture: 'tap',
    trigger: 'level-start',
  },
  {
    level: 2,
    caption: 'Clear the arrow in its way',
    target: {kind: 'arrow', pick: 'first-blocked'},
    gesture: 'none',
    trigger: 'after-first-blocked',
  },
  {
    level: 3,
    caption: 'Pinch to zoom into the maze',
    target: {kind: 'board'},
    gesture: 'pinch',
    trigger: 'level-start',
  },
  {
    level: 4,
    caption: 'Need help? Tap Hint below',
    target: {kind: 'hint-pill'},
    gesture: 'none',
    trigger: 'level-start',
  },
];
export const SKIP_FROM_LEVEL = 1;
export const UNSKIPPABLE_LEVELS = [3];
export function stepFor(level: number): TutorialStep | null {
  return TUTORIAL_STEPS.find(step => step.level === level) ?? null;
}

/** §6 — the five How To Play cards, reachable from Home and Settings. */
export const HOW_TO_PLAY_CARDS: readonly {title: string; body: string}[] = [
  {title: 'Tap an arrow', body: 'It slides out of the board.'},
  {
    title: 'Follow the head',
    body: 'It goes where the arrowhead points, even around corners.',
  },
  {
    title: 'Blocked?',
    body: 'Each blocked tap costs one heart. Clear the arrow in its way first.',
  },
  {title: 'Busy board?', body: 'Pinch to zoom in and tap precisely.'},
  {
    title: 'Clear it all',
    body: 'Empty the board to finish. Fewer mistakes, more stars.',
  },
];
