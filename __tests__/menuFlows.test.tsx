import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {HomeScreen} from '../src/screens/HomeScreen';
import {LevelSelectionScreen} from '../src/screens/LevelSelectionScreen';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {HowToPlayScreen} from '../src/screens/HowToPlayScreen';
import {SaveStore} from '../src/storage/SaveStore';
import {Audio} from '../src/audio/AudioService';
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('../src/components/LeaderboardOverlay', () => ({
  LeaderboardOverlay: () => null,
}));
jest.mock('../src/ads/AdService', () => ({Ads: {enabled: false}}));
const navigation = {navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn()};
const props = {navigation, route: {}};
let renderer: ReactTestRenderer;
function press(label: string) {
  const node = renderer.root
    .findAllByProps({accessibilityLabel: label})
    .find(n => typeof n.props.onPress === 'function');
  expect(node).toBeDefined();
  act(() => node!.props.onPress());
}
beforeEach(() => {
  SaveStore.resetForTests();
  jest.clearAllMocks();
  jest.spyOn(Audio, 'playClick').mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.restoreAllMocks();
});
it('home play and menu actions keep their destinations', () => {
  act(() => {
    renderer = create(
      <HomeScreen
        {...(props as unknown as React.ComponentProps<typeof HomeScreen>)}
      />,
    );
  });
  press('Play · Level 1');
  expect(navigation.navigate).toHaveBeenCalledWith('Game', {levelId: 1});
  press('Levels');
  expect(navigation.navigate).toHaveBeenCalledWith('LevelSelection');
  press('Settings');
  expect(navigation.navigate).toHaveBeenCalledWith('Settings');
});
it('level menu keeps future levels locked and offers the next playable level', () => {
  act(() => {
    renderer = create(
      <LevelSelectionScreen
        {...(props as unknown as React.ComponentProps<
          typeof LevelSelectionScreen
        >)}
      />,
    );
  });
  const locked = renderer.root
    .findAllByProps({accessibilityLabel: 'Level 2, locked'})
    .find(n => n.props.disabled);
  expect(locked).toBeDefined();
  press('Continue · Level 1');
  expect(navigation.navigate).toHaveBeenCalledWith('Game', {levelId: 1});
});
it('settings switches update persisted sound preferences', () => {
  act(() => {
    renderer = create(
      <SettingsScreen
        {...(props as unknown as React.ComponentProps<typeof SettingsScreen>)}
      />,
    );
  });
  press('Sound');
  expect(SaveStore.data.soundEnabled).toBe(false);
  press('Sound');
  expect(SaveStore.data.soundEnabled).toBe(true);
});
it('help Next advances through all five lessons before returning', () => {
  act(() => {
    renderer = create(
      <HowToPlayScreen
        {...(props as unknown as React.ComponentProps<typeof HowToPlayScreen>)}
      />,
    );
  });
  for (let i = 0; i < 4; i++) {
    press('Next');
    expect(navigation.goBack).not.toHaveBeenCalled();
  }
  press('Got it');
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});
