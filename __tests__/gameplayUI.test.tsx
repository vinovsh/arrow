import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {GameHeader} from '../src/components/GameHeader';
import {LevelProgress} from '../src/components/LevelProgress';
import {HintPill} from '../src/components/HintPill';
import {FitButton} from '../src/components/FitButton';
import {Audio} from '../src/audio/AudioService';
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
let renderer: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Audio, 'playClick').mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function press(label: string) {
  const button = renderer.root
    .findAllByProps({accessibilityLabel: label})
    .find(n => typeof n.props.onPress === 'function');
  expect(button).toBeDefined();
  act(() => button!.props.onPress());
}
it('back and pause remain immediately available while header art animates', () => {
  const onBack = jest.fn(),
    onPause = jest.fn();
  act(() => {
    renderer = create(
      <GameHeader
        levelId={12}
        band="Hard"
        hearts={2}
        remaining={24}
        onBack={onBack}
        onPause={onPause}
      />,
    );
  });
  press('Back to home');
  press('Pause');
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onPause).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '24 arrows remaining'})
      .length,
  ).toBeGreaterThan(0);
});
it('reports real cleared progress after an exit completes and resets for the next level', () => {
  act(() => {
    renderer = create(<LevelProgress cleared={8} total={32} />);
  });
  const value = () =>
    renderer.root.findAllByProps({accessibilityRole: 'progressbar'})[0].props
      .accessibilityValue;
  expect(value()).toEqual({min: 0, max: 32, now: 8});
  act(() => {
    renderer.update(<LevelProgress cleared={0} total={4} />);
  });
  expect(value()).toEqual({min: 0, max: 4, now: 0});
});
it('the persistent Fit action resets the viewport on its first tap', () => {
  const reset = jest.fn();
  act(() => {
    renderer = create(<FitButton visible onPress={reset} />);
  });
  press('Fit board to screen');
  expect(reset).toHaveBeenCalledTimes(1);
  act(() => {
    renderer.update(<FitButton visible disabled onPress={reset} />);
  });
  expect(
    renderer.root
      .findAllByProps({accessibilityLabel: 'Fit board to screen'})
      .some(n => n.props.disabled === true),
  ).toBe(true);
});
it('a zero-hint badge cannot consume a hint', () => {
  act(() => {
    renderer = create(<HintPill remaining={0} onPress={jest.fn()} />);
  });
  expect(
    renderer.root
      .findAllByProps({accessibilityLabel: 'Use hint, 0 left'})
      .some(n => n.props.disabled === true),
  ).toBe(true);
});
