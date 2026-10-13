import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {ScrollView} from 'react-native';
import {LeaderboardOverlay} from '../src/components/LeaderboardOverlay';
import {LevelCompleteOverlay} from '../src/components/LevelCompleteOverlay';
import {climbFor} from '../src/game/leaderboard/board';
import {computeScore} from '../src/game/engine/ScoreManager';
import {Audio} from '../src/audio/AudioService';
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 16, left: 0, right: 0}),
}));
const climb = climbFor(4500, 5100, Date.UTC(2026, 9, 13));
let renderer: ReactTestRenderer;
function press(label: string) {
  const target = renderer.root
    .findAllByProps({accessibilityLabel: label})
    .find(n => typeof n.props.onPress === 'function');
  expect(target).toBeDefined();
  expect(target!.props.disabled).not.toBe(true);
  act(() => target!.props.onPress());
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Audio, 'play').mockImplementation(() => {});
  jest.spyOn(Audio, 'playClick').mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('next works on the first tap before any animation delay, and ignores duplicate taps', () => {
  const onNext = jest.fn();
  act(() => {
    renderer = create(
      <LeaderboardOverlay visible climb={climb} onNext={onNext} />,
    );
  });
  press('Next Level');
  expect(onNext).toHaveBeenCalledTimes(1);
  press('Next Level');
  expect(onNext).toHaveBeenCalledTimes(1);
});
it('keeps actions outside the scroll area and includes the player among five rows', () => {
  act(() => {
    renderer = create(
      <LeaderboardOverlay visible climb={climb} onNext={() => {}} />,
    );
  });
  const scroll = renderer.root.findByType(ScrollView);
  expect(scroll.findAllByProps({testID: 'leaderboard-actions'})).toHaveLength(
    0,
  );
  const labels = scroll.findAll(
    n =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Rank '),
  );
  const unique = new Set(labels.map(n => n.props.accessibilityLabel));
  expect(unique.size).toBe(5);
  expect([...unique].some(label => label.includes(', You,'))).toBe(true);
});
it('allows closing from Home and allows a fresh action after reopening', () => {
  const onNext = jest.fn();
  const view = (visible: boolean) => (
    <LeaderboardOverlay
      visible={visible}
      climb={climb}
      primaryLabel="Close"
      onNext={onNext}
    />
  );
  act(() => {
    renderer = create(view(true));
  });
  press('Close');
  act(() => renderer.update(view(false)));
  act(() => renderer.update(view(true)));
  press('Close');
  expect(onNext).toHaveBeenCalledTimes(2);
});
it('completion Continue works immediately instead of consuming a tap to skip its animation', () => {
  const onNext = jest.fn();
  const breakdown = computeScore({
    n: 4,
    blockedTaps: 0,
    hintsUsed: 0,
    elapsedSeconds: 12,
    parTime: 30,
  });
  act(() => {
    renderer = create(
      <LevelCompleteOverlay
        visible
        breakdown={breakdown}
        newHighScore={false}
        levelId={1}
        newBestTime={false}
        levelsCompleted={1}
        onNext={onNext}
        onHome={() => {}}
      />,
    );
  });
  press('Continue');
  expect(onNext).toHaveBeenCalledTimes(1);
});
