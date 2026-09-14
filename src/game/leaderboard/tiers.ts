/**
 * The badge ladder.
 *
 * Tiers are driven by the lifetime score (`SaveData.bestScore`), which only ever goes
 * up, so a badge once earned is never taken away. That matters more than it sounds:
 * the whole point of a badge is that it is a record of what you did, and a ladder that
 * can demote you turns every session into something you can lose. The *league* below
 * is where the competitive churn lives; this is the permanent part.
 *
 * Thresholds widen as they go, so the early ones arrive quickly enough to teach the
 * player that the ladder exists, and the late ones stay worth reaching.
 */
export interface Tier {
  key: string;
  label: string;
  /** The badge's own colour, and the ring drawn around the player's avatar. */
  colour: string;
  /** Darker partner for the badge gradient. */
  shade: string;
  /** Lifetime score at which this tier is reached. */
  from: number;
}

export const TIERS: readonly Tier[] = [
  {key: 'bronze', label: 'BRONZE', colour: '#CD8E5A', shade: '#8A5A33', from: 0},
  {
    key: 'silver',
    label: 'SILVER',
    colour: '#C7D3E8',
    shade: '#7D8AA3',
    from: 25000,
  },
  {key: 'gold', label: 'GOLD', colour: '#FFC53D', shade: '#C1860B', from: 75000},
  {
    key: 'platinum',
    label: 'PLATINUM',
    colour: '#5FE3D6',
    shade: '#1E9A90',
    from: 175000,
  },
  {
    key: 'diamond',
    label: 'DIAMOND',
    colour: '#6FB2FF',
    shade: '#2A62C4',
    from: 350000,
  },
  {
    key: 'master',
    label: 'MASTER',
    colour: '#B98BFF',
    shade: '#6C36C9',
    from: 700000,
  },
  {
    key: 'legend',
    label: 'LEGEND',
    colour: '#FF7BA8',
    shade: '#C42B62',
    from: 1200000,
  },
] as const;

export interface TierStanding {
  tier: Tier;
  /** The tier above, or null at the top of the ladder. */
  next: Tier | null;
  /** 0..1 through the current tier. 1 when there is nothing above. */
  progress: number;
  /** Points still needed for `next`, or 0 at the top. */
  remaining: number;
}

export function tierFor(lifetimeScore: number): TierStanding {
  const score = Math.max(0, lifetimeScore);
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (score >= TIERS[i].from) {
      index = i;
    }
  }
  const tier = TIERS[index];
  const next = index + 1 < TIERS.length ? TIERS[index + 1] : null;
  if (!next) {
    return {tier, next: null, progress: 1, remaining: 0};
  }
  const span = next.from - tier.from;
  return {
    tier,
    next,
    progress: Math.min(1, Math.max(0, (score - tier.from) / span)),
    remaining: Math.max(0, next.from - score),
  };
}
