import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The launch screen's motivational line (ref/screens (2).png, panel 6). One is shown
 * per app open, in rotation, so two opens in a row never repeat.
 *
 * Kept out of the save blob on purpose: it is not progress, and losing it costs
 * nothing but a repeated quote.
 */
export interface Quote {
  title: string;
  body: string;
}

export const QUOTES: readonly Quote[] = [
  {title: 'Sharpen\nyour mind', body: 'Boost focus, logic,\nand problem solving.'},
  {title: 'Small steps,\nbig results', body: 'Every arrow you clear\nmoves you forward.'},
  {title: 'Plan your moves', body: 'Clear the path,\nreach your goal.'},
  {title: 'Simple rules.\nDeep strategy.', body: 'Think first,\nthen make it count.'},
  {title: "You're closer\nthan you think", body: 'Keep going —\nthe way out is there.'},
  {title: 'Every puzzle is\na new journey', body: 'Are you ready?'},
  {title: 'Patience\nis a superpower', body: 'The right order\nbeats the fast one.'},
  {title: 'Find the way out', body: 'Every knot\nhas a first thread.'},
  {title: 'Think.\nPlan. Clear.', body: 'One move at a time.'},
  {title: 'Progress,\nnot perfection', body: 'A mistake is just\na clue in disguise.'},
  {title: 'Stay curious', body: 'Look again —\nthe answer is on the board.'},
  {title: 'Clear mind,\nclear path', body: 'Breathe, look,\nthen tap.'},
  {title: 'Challenges are\njust puzzles', body: 'Solve. Grow. Repeat.'},
  {title: 'Trust the process', body: 'Start with the arrow\nthat is already free.'},
  {title: 'Hard today,\neasy tomorrow', body: 'Practice turns\ntangles into patterns.'},
  {title: 'Keep moving\nforward', body: 'Even the longest arrow\nleaves one cell at a time.'},
  {title: 'Focus wins', body: 'Quiet the noise,\nfollow the lines.'},
  {title: 'Believe\nin your moves', body: 'You have solved\nharder than this.'},
  {title: 'Good things\ntake time', body: 'No rush.\nThe board will wait.'},
  {title: 'Every level\nmakes you sharper', body: 'Train your brain,\none board at a time.'},
];

const QUOTE_KEY = 'arrow-escape/quote-index/v1';

/**
 * The quote for this launch, and advances the rotation for the next one. A fresh
 * install starts somewhere random so not every player opens on the same line.
 */
export async function nextQuote(): Promise<Quote> {
  let index: number;
  try {
    const raw = await AsyncStorage.getItem(QUOTE_KEY);
    const stored = raw === null ? NaN : Number(raw);
    index = Number.isInteger(stored)
      ? (stored + 1) % QUOTES.length
      : Math.floor(Math.random() * QUOTES.length);
  } catch {
    index = Math.floor(Math.random() * QUOTES.length);
  }
  AsyncStorage.setItem(QUOTE_KEY, String(index)).catch(() => {});
  return QUOTES[index];
}

/** The line on the level-complete card (ref/reward model.png, frame 4). */
export const COMPLETE_QUOTES: readonly string[] = [
  'Every puzzle solved is a step closer to your goal.',
  'Progress is built one puzzle at a time.',
  'Small steps lead to big results.',
  'The best progress comes from consistent effort.',
  'A sharp mind is a trained mind. Keep going!',
  'You found the way out. The next one is waiting.',
  'Patience untangles everything.',
  'Every level makes you a little sharper.',
  'Great minds think one move ahead.',
  'Keep the streak alive — you are on a roll.',
];

/** Stable per level, so a replay shows the same line but neighbours differ. */
export function completeQuoteFor(levelId: number): string {
  return COMPLETE_QUOTES[(levelId - 1) % COMPLETE_QUOTES.length];
}
