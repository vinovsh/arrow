/* eslint-env jest */
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));
jest.mock('react-native-sound', () => ({
  __esModule: true,
  default: class MockSound {
    static setCategory() {}
    constructor(_f, _b, cb) { if (cb) { cb(null); } }
    play(cb) { if (cb) { cb(true); } }
    stop(cb) { if (cb) { cb(); } }
    setVolume() { return this; }
    setSpeed() { return this; }
    release() {}
    isPlaying() { return false; }
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
