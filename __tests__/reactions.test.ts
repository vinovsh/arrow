import {
  ReactionMilestones,
  reactionFor,
} from '../src/game/celebration/reactions';

describe('fun reactions', () => {
  it('shows halfway once, on the threshold crossing even when counts jump', () => {
    const milestones = new ReactionMilestones();
    expect(milestones.reachedHalfway(4, 10)).toBe(false);
    expect(milestones.reachedHalfway(6, 10)).toBe(true);
    expect(milestones.reachedHalfway(6, 10)).toBe(false);
    expect(milestones.reachedHalfway(8, 10)).toBe(false);
  });
  it('rounds odd boards up, allows another attempt, and avoids a halfway event on completion', () => {
    const milestones = new ReactionMilestones();
    expect(milestones.reachedHalfway(2, 5)).toBe(false);
    expect(milestones.reachedHalfway(3, 5)).toBe(true);
    milestones.reset();
    expect(milestones.reachedHalfway(3, 5)).toBe(true);
    milestones.reset();
    expect(milestones.reachedHalfway(5, 5)).toBe(false);
    expect(milestones.reachedHalfway(1, 1)).toBe(false);
  });
  it('celebrates tutorial, hard perfect solves and assisted solves positively', () => {
    expect(reactionFor({id: 1, band: 'Tutorial'}, 'complete').caption).toBe(
      'You got it!',
    );
    expect(reactionFor({id: 10, band: 'Very Hard'}, 'complete').caption).toBe(
      'Genius!',
    );
    expect(
      reactionFor({id: 10, band: 'Very Hard'}, 'complete', 1, 1).caption,
    ).toBe('Impressive!');
    expect(reactionFor({id: 2, band: 'Medium'}, 'complete', 3, 1).emoji).toBe(
      '🥳',
    );
  });
  it('varies halfway messages across levels', () => {
    const captions = [1, 2, 3].map(
      id => reactionFor({id, band: 'Hard'}, 'halfway').caption,
    );
    expect(new Set(captions).size).toBe(3);
  });
});
