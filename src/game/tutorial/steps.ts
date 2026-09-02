/**
 * §6 — the scripted onboarding.
 *
 * The rules the table below encodes: one idea per level, no timer, no stars shown, no
 * failure possible, no caption longer than six words, and every coach mark dismissible
 * by tapping anywhere. Levels 9, 10 and 12-25 run clean on purpose — the touch gets
 * lighter rather than stopping dead.
 */

export type CoachTarget =
  | {kind: 'arrow'; pick: 'first-free' | 'first-blocked' | 'longest'}
  | {kind: 'hint-pill'}
  | {kind: 'board'}
  | {kind: 'hearts'};

export interface TutorialStep {
  level: number;
  /** Empty string means the beat has no caption — level 5 teaches by silence. */
  caption: string;
  target: CoachTarget;
  /** A looping ghost hand demonstrates the gesture. */
  gesture: 'tap' | 'pinch' | 'none';
  /** Some marks only make sense after something has happened. */
  trigger: 'level-start' | 'after-first-blocked' | 'on-win';
  /** §3.3 — level 5 tunes the silent assist tighter than the global 25s. */
  assistAfterSeconds?: number;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    level: 1,
    caption: 'Tap to send it out',
    target: {kind: 'arrow', pick: 'first-free'},
    gesture: 'tap',
    trigger: 'level-start',
  },
  {
    level: 2,
    caption: 'Any order works',
    target: {kind: 'board'},
    gesture: 'none',
    trigger: 'level-start',
  },
  {
    level: 3,
    // Appears only *after* the shake, so the rule is explained by the thing that
    // just happened rather than pre-empting it.
    caption: 'Clear its path first',
    target: {kind: 'arrow', pick: 'first-blocked'},
    gesture: 'none',
    trigger: 'after-first-blocked',
  },
  {
    level: 4,
    caption: 'It follows the arrowhead',
    target: {kind: 'arrow', pick: 'longest'},
    gesture: 'none',
    trigger: 'level-start',
  },
  {
    level: 5,
    caption: '',
    target: {kind: 'board'},
    gesture: 'none',
    trigger: 'level-start',
    assistAfterSeconds: 12,
  },
  {
    level: 6,
    caption: 'Nice — it was a heart!',
    target: {kind: 'board'},
    gesture: 'none',
    trigger: 'on-win',
  },
  {
    level: 7,
    caption: 'Stuck? Use a hint',
    target: {kind: 'hint-pill'},
    gesture: 'none',
    trigger: 'level-start',
  },
  {
    level: 8,
    caption: 'Fewer mistakes, more stars',
    target: {kind: 'board'},
    gesture: 'none',
    trigger: 'on-win',
  },
  {
    // §6 — fires on the first 8x8 board, and still fires for a player who skipped,
    // because zoom is a mechanic nobody can infer.
    level: 11,
    caption: 'Pinch to zoom in',
    target: {kind: 'board'},
    gesture: 'pinch',
    trigger: 'level-start',
  },
  {
    // Likewise hearts: the first time a mistake can cost something, say so.
    level: 26,
    caption: 'Careful — mistakes cost hearts',
    target: {kind: 'hearts'},
    gesture: 'none',
    trigger: 'level-start',
  },
];

/** §6 — SKIP appears from level 2 onward. */
export const SKIP_FROM_LEVEL = 2;

/** The two marks that survive a skip, because they teach mechanics, not just rules. */
export const UNSKIPPABLE_LEVELS = [11, 26];

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
  {title: 'Blocked?', body: 'It shakes. Clear whatever is in the way first.'},
  {title: 'Busy board?', body: 'Pinch to zoom in and tap precisely.'},
  {
    title: 'Clear it all',
    body: 'Empty the board to finish. Fewer mistakes, more stars.',
  },
];
