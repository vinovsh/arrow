import {avatarFor} from '../src/theme/avatars';
it('keeps the player portrait distinct and recognises named animal rivals', () => {
  expect(avatarFor({id: 'you', name: 'You', isPlayer: true})).toBe('player');
  for (const [name, expected] of [
    ['mysticcat46', 'cat'],
    ['jollyibis', 'ibis'],
    ['turbofox59', 'fox'],
    ['briskraven', 'bird'],
  ]) {
    expect(avatarFor({id: name, name, isPlayer: false})).toBe(expected);
  }
});
it('keeps a rival portrait consistent when scores, rank and display name change', () => {
  const first = avatarFor({
    id: 'rival-42',
    name: 'jollypanda',
    isPlayer: false,
  });
  expect(avatarFor({id: 'rival-42', name: 'calmpanda', isPlayer: false})).toBe(
    first,
  );
  expect(first).not.toBe('player');
});
