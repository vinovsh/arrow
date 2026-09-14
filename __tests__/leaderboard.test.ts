import {
  LEAGUE_SPAN,
  RIVALS_PER_LEAGUE,
  leagueIndexFor,
  rivalsFor,
  seasonClock,
} from '../src/game/leaderboard/league';
import {
  PLAYER_ROW_ID,
  climbFor,
  standingsFor,
  windowAround,
} from '../src/game/leaderboard/board';
import {TIERS, tierFor} from '../src/game/leaderboard/tiers';

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

describe('badge tiers', () => {
  it('starts everyone at the bottom of the ladder', () => {
    expect(tierFor(0).tier.key).toBe('bronze');
    expect(tierFor(-5).tier.key).toBe('bronze');
  });

  it('names the tier that the score has actually reached', () => {
    for (const tier of TIERS) {
      expect(tierFor(tier.from).tier.key).toBe(tier.key);
      if (tier.from > 0) {
        expect(tierFor(tier.from - 1).tier.key).not.toBe(tier.key);
      }
    }
  });

  it('tops out rather than running off the end', () => {
    const top = TIERS[TIERS.length - 1];
    const standing = tierFor(top.from * 10);
    expect(standing.tier.key).toBe(top.key);
    expect(standing.next).toBeNull();
    expect(standing.progress).toBe(1);
    expect(standing.remaining).toBe(0);
  });

  it('reports progress through the current tier, never outside 0..1', () => {
    for (let score = 0; score < 1500000; score += 7919) {
      const {progress} = tierFor(score);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('league roster', () => {
  it('is the same board for the same league, season and clock', () => {
    const a = rivalsFor(3, NOW);
    const b = rivalsFor(3, NOW);
    expect(b).toEqual(a);
  });

  it('gives each league its own field', () => {
    const names = (i: number) => rivalsFor(i, NOW).map(r => r.name);
    expect(names(3)).not.toEqual(names(4));
  });

  it('keeps every rival inside their own league band', () => {
    for (const leagueIndex of [0, 1, 7, 25]) {
      for (const rival of rivalsFor(leagueIndex, NOW)) {
        expect(rival.score).toBeGreaterThanOrEqual(leagueIndex * LEAGUE_SPAN);
        expect(rival.score).toBeLessThan((leagueIndex + 1) * LEAGUE_SPAN);
      }
    }
  });

  it('has rivals gain ground as the season runs', () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const monday = NOW - seasonClock(NOW).progress * week;
    const early = rivalsFor(2, monday + 60 * 60 * 1000);
    const late = rivalsFor(2, monday + 5 * 24 * 60 * 60 * 1000);
    const climbed = early.filter((rival, i) => late[i].score > rival.score);
    expect(climbed.length).toBe(early.length);
  });
});

describe('standings', () => {
  it('puts the player in the table exactly once, ranked by score', () => {
    const standings = standingsFor(34000, NOW);
    expect(standings.rows).toHaveLength(RIVALS_PER_LEAGUE + 1);
    expect(standings.rows.filter(row => row.isPlayer)).toHaveLength(1);
    expect(standings.rows[standings.playerRank - 1].id).toBe(PLAYER_ROW_ID);
    for (let i = 1; i < standings.rows.length; i++) {
      expect(standings.rows[i - 1].score).toBeGreaterThanOrEqual(
        standings.rows[i].score,
      );
      expect(standings.rows[i].rank).toBe(i + 1);
    }
  });

  it('places the player in the league their score belongs to', () => {
    expect(standingsFor(0, NOW).leagueIndex).toBe(0);
    expect(standingsFor(LEAGUE_SPAN - 1, NOW).leagueIndex).toBe(0);
    expect(standingsFor(LEAGUE_SPAN, NOW).leagueIndex).toBe(1);
    expect(leagueIndexFor(LEAGUE_SPAN * 4 + 10)).toBe(4);
  });
});

describe('the climb', () => {
  it('moves the player up and names who they passed', () => {
    const climb = climbFor(30000, 33000, NOW);
    expect(climb.gained).toBe(3000);
    expect(climb.after.playerRank).toBeLessThanOrEqual(
      climb.before.playerRank,
    );
    expect(climb.placesGained).toBe(
      climb.before.playerRank - climb.after.playerRank,
    );
    expect(climb.overtaken).toHaveLength(climb.placesGained);
    for (const passed of climb.overtaken) {
      expect(passed.score).toBeGreaterThan(30000);
      expect(passed.score).toBeLessThanOrEqual(33000);
    }
  });

  it('never reports a fall, because lifetime score only goes up', () => {
    let score = 0;
    for (let level = 1; level <= 120; level++) {
      const gain = 1800 + ((level * 977) % 2400);
      const climb = climbFor(score, score + gain, NOW);
      expect(climb.placesGained).toBeGreaterThanOrEqual(0);
      score += gain;
    }
  });

  it('promotes rather than climbing when the band is left behind', () => {
    const climb = climbFor(LEAGUE_SPAN - 500, LEAGUE_SPAN + 2000, NOW);
    expect(climb.promoted).toBe(true);
    expect(climb.after.leagueIndex).toBe(climb.before.leagueIndex + 1);
    // A promotion is a different field, so there is nobody to have overtaken.
    expect(climb.overtaken).toEqual([]);
    expect(climb.placesGained).toBe(0);
  });

  it('flags the badge upgrade only on the level that crosses it', () => {
    const silver = TIERS[1].from;
    expect(climbFor(silver - 1000, silver + 500, NOW).tierUpgraded).toBe(true);
    expect(climbFor(silver + 500, silver + 2000, NOW).tierUpgraded).toBe(false);
  });

  it('passes somebody on most levels, which is the point of the pacing', () => {
    let score = 0;
    let moved = 0;
    const levels = 60;
    for (let level = 1; level <= levels; level++) {
      const gain = 1800 + ((level * 977) % 2400);
      const climb = climbFor(score, score + gain, NOW);
      if (climb.promoted || climb.placesGained > 0) {
        moved++;
      }
      score += gain;
    }
    expect(moved / levels).toBeGreaterThan(0.9);
  });
});

describe('the visible window', () => {
  it('covers where the player was and where they landed', () => {
    const climb = climbFor(30000, 33000, NOW);
    const rows = windowAround(
      climb.after,
      climb.before.playerRank,
      7,
    );
    const ranks = rows.map(row => row.rank);
    expect(ranks).toContain(climb.after.playerRank);
    expect(Math.min(...ranks)).toBeLessThanOrEqual(climb.after.playerRank);
    expect(Math.max(...ranks)).toBeGreaterThanOrEqual(climb.after.playerRank);
    // Contiguous, or the absolute row positions in the overlay would have gaps.
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBe(ranks[i - 1] + 1);
    }
  });

  it('shows the leader when the player is near the podium', () => {
    const standings = standingsFor(LEAGUE_SPAN - 1, NOW);
    const rows = windowAround(standings, standings.playerRank, 7);
    expect(rows[0].rank).toBe(1);
  });

  it('never asks for more rows than the league has', () => {
    const standings = standingsFor(5000, NOW);
    expect(windowAround(standings, standings.playerRank, 500)).toHaveLength(
      standings.rows.length,
    );
  });
});
