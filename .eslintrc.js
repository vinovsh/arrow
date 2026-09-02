module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void somePromise()` is how this codebase marks a promise it deliberately does
    // not await — the debounced save flush, the audio preload, the ad seam. The rule
    // exists to catch `void` used as a value, which nothing here does.
    'no-void': ['warn', { allowAsStatement: true }],
  },
  overrides: [
    {
      // The coach-mark spotlight is four dim panels positioned around a hole whose
      // coordinates are computed per level and per arrow. There is no stylesheet
      // entry that can hold a value the renderer works out at runtime.
      files: ['src/components/CoachMark.tsx'],
      rules: { 'react-native/no-inline-styles': 'off' },
    },
    {
      // Seed derivation and the PRNG itself are bitwise by nature.
      files: ['src/utils/rng.ts', 'tools/pipeline/generate.ts'],
      rules: { 'no-bitwise': 'off' },
    },
  ],
};
