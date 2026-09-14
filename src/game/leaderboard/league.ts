/**
 * The weekly league — the part of the leaderboard that moves.
 *
 * The game is offline and always will be, so there are no other players. What there
 * is instead is a roster generated from a seed, and the seed is chosen so the board
 * behaves the way a real one would:
 *
 * **Nobody is generated relative to you.** A roster built around the player's current
 * score would slide up with them and they would never actually overtake anyone. These
 * rivals sit at fixed points inside a fixed band; the player climbs through them and
 * is promoted to the next band on the way out of the top. That is why finishing a
 * level always visibly moves you past somebody.
 *
 * **The roster reseeds weekly.** A season is a week, so the names and the field are
 * new each Monday and a player returning after a break finds a different board rather
 * than the one they left. Within a season each rival climbs steadily from their
 * opening score toward their target, which is what makes the board feel inhabited:
 * come back in the evening and the people around you have played too.
 *
 * All of it is a pure function of (lifetime score, clock). Nothing is stored, nothing
 * is fetched, and two calls with the same arguments always agree — which is what lets
 * the level-complete animation ask for the board twice, once with the old score and
 * once with the new, and know the only difference is the player.
 */
import {createRng, hashSeed} from '../../utils/rng';

/** Points that separate one league from the next. */
export const LEAGUE_SPAN = 20000;
/** How many generated players share a league with the user. */
export const RIVALS_PER_LEAGUE = 24;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Monday 2026-01-05 00:00 UTC — an arbitrary but fixed start for season counting. */
const SEASON_EPOCH = Date.UTC(2026, 0, 5);

/** Leagues are named after the band, not the player's badge tier. */
const LEAGUE_NAMES = [
  'COPPER',
  'IRON',
  'STEEL',
  'JADE',
  'AMBER',
  'CORAL',
  'COBALT',
  'ONYX',
  'QUARTZ',
  'TITAN',
  'AURORA',
  'ECLIPSE',
] as const;

/**
 * Display names. Deliberately handle-shaped rather than realistic full names — a
 * generated "Sarah Miller" invites the question of who she is, where "puzzlecat" is
 * plainly a username and nobody wonders.
 */
const NAME_PARTS_A = [
  'pixel',
  'turbo',
  'neon',
  'lucky',
  'quantum',
  'silent',
  'cosmic',
  'rapid',
  'fuzzy',
  'iron',
  'echo',
  'nova',
  'mellow',
  'zesty',
  'arcane',
  'brisk',
  'vivid',
  'lunar',
  'crimson',
  'jolly',
  'swift',
  'mystic',
  'atomic',
  'plucky',
] as const;

const NAME_PARTS_B = [
  'fox',
  'cat',
  'otter',
  'raven',
  'moth',
  'wolf',
  'koi',
  'lynx',
  'crane',
  'bear',
  'hawk',
  'newt',
  'ibis',
  'mole',
  'swan',
  'yak',
  'puma',
  'wren',
  'seal',
  'stag',
] as const;

/** Stand-in profile pictures. An emoji needs no network and no asset pipeline. */
const FACES = [
  '🦊',
  '🐱',
  '🦉',
  '🐼',
  '🐸',
  '🐙',
  '🦁',
  '🐯',
  '🐨',
  '🦄',
  '🐺',
  '🦝',
  '🐵',
  '🐧',
  '🦖',
  '🐳',
  '🦋',
  '🐝',
  '🦈',
  '🐢',
  '🦜',
  '🐰',
  '🦔',
  '🐹',
] as const;

const AVATAR_COLOURS = [
  '#22E0E8',
  '#38E08B',
  '#FF9A3C',
  '#FF5FA2',
  '#A46BFF',
  '#FFD54A',
  '#3D8BFF',
  '#F2F6FF',
] as const;

export interface Rival {
  id: string;
  name: string;
  face: string;
  colour: string;
  score: number;
  /** Shown as a live dot. Cosmetic, and deterministic like everything else here. */
  playingNow: boolean;
}

export interface SeasonClock {
  index: number;
  /** 0..1 through the current week. */
  progress: number;
  msRemaining: number;
}

export function seasonClock(now: number): SeasonClock {
  const since = Math.max(0, now - SEASON_EPOCH);
  const index = Math.floor(since / WEEK_MS);
  const into = since % WEEK_MS;
  return {
    index,
    progress: into / WEEK_MS,
    msRemaining: WEEK_MS - into,
  };
}

export function leagueIndexFor(lifetimeScore: number): number {
  return Math.max(0, Math.floor(Math.max(0, lifetimeScore) / LEAGUE_SPAN));
}

export function leagueNameFor(leagueIndex: number): string {
  const name = LEAGUE_NAMES[leagueIndex % LEAGUE_NAMES.length];
  // Past one pass through the list the leagues start over at a higher grade, so the
  // ladder keeps going without inventing sixty adjectives.
  const cycle = Math.floor(leagueIndex / LEAGUE_NAMES.length);
  return cycle === 0 ? name : `${name} ${'I'.repeat(Math.min(3, cycle + 1))}`;
}

/**
 * The roster for one league in one season.
 *
 * Rivals are spread across the band rather than bunched, so a level's worth of points
 * always crosses somebody: the band is 20,000 wide and holds 24 players, which puts
 * roughly 800 points between neighbours against the two to four thousand a level
 * tends to pay.
 */
export function rivalsFor(leagueIndex: number, now: number): Rival[] {
  const season = seasonClock(now);
  const rng = createRng(
    hashSeed(`arrow-escape/league/${leagueIndex}/season/${season.index}`),
  );
  const floorScore = leagueIndex * LEAGUE_SPAN;
  const rivals: Rival[] = [];

  for (let i = 0; i < RIVALS_PER_LEAGUE; i++) {
    const slot = (i + 0.5) / RIVALS_PER_LEAGUE;
    // Opening score sits in this rival's slot of the band, jittered so the ladder is
    // not visibly a ruler.
    const jitter = (rng.next() - 0.5) * (LEAGUE_SPAN / RIVALS_PER_LEAGUE) * 0.7;
    const opening = floorScore + slot * LEAGUE_SPAN * 0.82 + jitter;
    // What they will have gained by the end of the week. Some rivals are quiet, some
    // are grinding; the spread is what makes the board shuffle between sessions.
    const seasonGain = (0.04 + rng.next() * 0.3) * LEAGUE_SPAN;
    const score = Math.round(opening + seasonGain * season.progress);

    rivals.push({
      id: `r${leagueIndex}-${season.index}-${i}`,
      name: `${rng.pick(NAME_PARTS_A)}${rng.pick(NAME_PARTS_B)}${
        rng.next() < 0.45 ? rng.int(90) + 10 : ''
      }`,
      face: rng.pick(FACES),
      colour: rng.pick(AVATAR_COLOURS),
      score,
      playingNow: rng.next() < 0.28,
    });
  }

  return rivals;
}
