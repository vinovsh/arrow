/**
 * Turning a score into a standings table, and a pair of scores into a climb.
 *
 * Everything here is pure: the overlay asks for the board as it was before the level
 * and as it is after, and the difference between the two *is* the animation.
 */
import {
  LEAGUE_SPAN,
  type Rival,
  type SeasonClock,
  leagueIndexFor,
  leagueNameFor,
  rivalsFor,
  seasonClock,
} from './league';
import {type TierStanding, tierFor} from './tiers';

export interface BoardRow {
  id: string;
  name: string;
  face: string;
  colour: string;
  score: number;
  /** 1-based position in the league. */
  rank: number;
  isPlayer: boolean;
  playingNow: boolean;
}

export interface Standings {
  leagueIndex: number;
  leagueName: string;
  season: SeasonClock;
  rows: BoardRow[];
  /** The player's 1-based position. */
  playerRank: number;
  /** Position among everyone, if the leagues below were stacked underneath. */
  globalRank: number;
  tier: TierStanding;
}

export const PLAYER_ROW_ID = 'you';

/**
 * A player's standing in their own league.
 *
 * `now` is passed rather than read so the two calls behind a climb animation see one
 * instant, and so tests are not at the mercy of the clock.
 */
export function standingsFor(lifetimeScore: number, now: number): Standings {
  const score = Math.max(0, lifetimeScore);
  const leagueIndex = leagueIndexFor(score);
  const rivals: Rival[] = rivalsFor(leagueIndex, now);

  const entries: Omit<BoardRow, 'rank'>[] = [
    ...rivals.map(rival => ({
      id: rival.id,
      name: rival.name,
      face: rival.face,
      colour: rival.colour,
      score: rival.score,
      isPlayer: false,
      playingNow: rival.playingNow,
    })),
    {
      id: PLAYER_ROW_ID,
      name: 'YOU',
      face: '🎯',
      colour: '#FFD34A',
      score,
      isPlayer: true,
      playingNow: true,
    },
  ];

  // Highest score first. Ties break by id so the order never flickers between two
  // calls that were meant to be identical.
  entries.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const rows = entries.map((entry, i) => ({...entry, rank: i + 1}));
  const playerRank = rows.findIndex(row => row.isPlayer) + 1;

  return {
    leagueIndex,
    leagueName: leagueNameFor(leagueIndex),
    season: seasonClock(now),
    rows,
    playerRank,
    // Everyone in a lower league is behind you by definition. It is a made-up number
    // in a made-up league, but it is consistent, and it is the number that makes the
    // ladder feel like it has a bottom.
    globalRank: playerRank + leagueIndex * (rows.length - 1),
    tier: tierFor(score),
  };
}

export interface Climb {
  before: Standings;
  after: Standings;
  /** Points earned by the level that triggered this. */
  gained: number;
  /** How many places the player moved up inside the league. Never negative. */
  placesGained: number;
  /** The player left their league behind and starts the next one at the bottom. */
  promoted: boolean;
  /** The badge changed. Both are set when it did. */
  tierUpgraded: boolean;
  /** Rivals the player overtook, in the order they were passed. */
  overtaken: BoardRow[];
}

export function climbFor(
  scoreBefore: number,
  scoreAfter: number,
  now: number,
): Climb {
  const before = standingsFor(scoreBefore, now);
  const after = standingsFor(scoreAfter, now);
  const promoted = after.leagueIndex > before.leagueIndex;

  // Who the player went past. Only meaningful within one league — a promotion drops
  // them into a whole new field, and the thing to celebrate there is the promotion.
  const overtaken = promoted
    ? []
    : before.rows.filter(
        row =>
          !row.isPlayer &&
          row.score > scoreBefore &&
          row.score <= scoreAfter,
      );

  return {
    before,
    after,
    gained: Math.max(0, scoreAfter - scoreBefore),
    placesGained: promoted
      ? 0
      : Math.max(0, before.playerRank - after.playerRank),
    promoted,
    tierUpgraded: after.tier.tier.key !== before.tier.tier.key,
    overtaken,
  };
}

/**
 * The slice of the table worth drawing.
 *
 * A league is 25 rows and a phone can show about eight, so the window follows the
 * player — and it has to cover where they *were* as well as where they landed, or the
 * climb animation would start off-screen. Leaders are always worth seeing, so when
 * the player is near the top the window simply starts at the top.
 */
export function windowAround(
  after: Standings,
  beforeRank: number,
  size = 8,
): BoardRow[] {
  const total = after.rows.length;
  const span = Math.min(size, total);
  const highest = Math.min(after.playerRank, beforeRank);
  const lowest = Math.max(after.playerRank, beforeRank);

  // Centre on the climb, then slide the window back inside the table.
  let start = Math.round((highest + lowest) / 2) - Math.ceil(span / 2);
  start = Math.max(0, Math.min(start, total - span));
  // Never hide the leader when the player is within reach of the podium.
  if (highest <= 4) {
    start = 0;
  }
  return after.rows.slice(start, start + span);
}

export {LEAGUE_SPAN};
