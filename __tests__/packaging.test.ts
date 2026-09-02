import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, file), 'utf8'));

/**
 * §18 / §20 — the constraints that are easy to violate by accident and expensive to
 * discover late. A single transitive `expo-*` dependency invalidates the whole
 * platform choice, and an INTERNET permission contradicts "runs in airplane mode".
 */
describe('build constraints', () => {
  it('has no expo package anywhere in the dependency tree (§18)', () => {
    const pkg = readJson('package.json') as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const declared = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    // `expo` itself, `expo-anything`, or a package scoped under @expo.
    const isExpo = (name: string): boolean =>
      name === 'expo' || name.startsWith('expo-') || name.startsWith('@expo/');
    expect(declared.filter(isExpo)).toEqual([]);

    // The lockfile is where a transitive one would hide. `exponential-backoff` is
    // not Expo, so the match has to end at a package boundary rather than a prefix.
    const lock = readFileSync(join(root, 'package-lock.json'), 'utf8');
    const packages = [
      ...new Set([...lock.matchAll(/"node_modules\/([^"]+)"/g)].map(m => m[1])),
    ];
    expect(packages.filter(isExpo)).toEqual([]);
  });

  it('declares every library §18 requires', () => {
    const pkg = readJson('package.json') as {
      dependencies: Record<string, string>;
    };
    for (const required of [
      'react-native-svg',
      'react-native-reanimated',
      'react-native-gesture-handler',
      '@react-navigation/native',
      '@react-navigation/native-stack',
      'react-native-screens',
      'react-native-safe-area-context',
      'react-native-linear-gradient',
      '@react-native-async-storage/async-storage',
      'react-native-sound',
      'react-native-haptic-feedback',
    ]) {
      expect(pkg.dependencies[required]).toBeDefined();
    }
  });

  it('requests no INTERNET permission in the shipping manifest (§18)', () => {
    const manifest = readFileSync(
      join(root, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );
    expect(manifest).not.toContain('android.permission.INTERNET');

    // Metro and the dev menu do need it, so it lives in the debug variant only and
    // is merged out of release entirely.
    const debugManifest = readFileSync(
      join(root, 'android/app/src/debug/AndroidManifest.xml'),
      'utf8',
    );
    expect(debugManifest).toContain('android.permission.INTERNET');
  });

  it('locks to portrait and targets minSdk 24 (§18)', () => {
    const manifest = readFileSync(
      join(root, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );
    expect(manifest).toContain('android:screenOrientation="portrait"');

    const gradle = readFileSync(join(root, 'android/build.gradle'), 'utf8');
    const minSdk = /minSdkVersion\s*=\s*(\d+)/.exec(gradle);
    expect(minSdk).not.toBeNull();
    expect(Number(minSdk?.[1])).toBeGreaterThanOrEqual(24);
  });

  it('keeps reanimated last in the babel plugin list, as the library requires', () => {
    const babel = readFileSync(join(root, 'babel.config.js'), 'utf8');
    const plugins = /plugins:\s*\[([\s\S]*?)\]/.exec(babel)?.[1] ?? '';
    const entries = [...plugins.matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(entries[entries.length - 1]).toBe('react-native-reanimated/plugin');
  });
});
