import {Audio} from '../src/audio/AudioService';
it('keeps movement pitch distinct for medium and long arrows and clamps outliers', () => {
  const play = jest.spyOn(Audio, 'play').mockImplementation(() => {});
  for (const length of [4, 16, 64, 1000]) {
    Audio.playArrowMove(length);
  }
  const rates = play.mock.calls.map(call => call[1]!);
  expect(new Set(rates.slice(0, 3)).size).toBe(3);
  expect(rates[0]).toBeGreaterThan(rates[1]);
  expect(rates[1]).toBeGreaterThan(rates[2]);
  expect(rates[2]).toBe(rates[3]);
  expect(rates.every(rate => rate > 0.9 && rate < 1.1)).toBe(true);
  expect(play.mock.calls.every(call => call[0] === 'arrow_move')).toBe(true);
  play.mockRestore();
});
