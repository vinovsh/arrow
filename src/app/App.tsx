import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {theme} from '../theme/theme';
import {RootNavigator} from '../navigation/RootNavigator';

/**
 * §18 — React Native CLI only. No `expo`, `expo-modules-core`, `expo-router`, or any
 * `expo-*` package, including transitively.
 *
 * GestureHandlerRootView must wrap everything for §5.5's pinch/pan composition to
 * receive touches, and `react-native-gesture-handler` is imported first in index.js.
 */
export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.bg.base}
          translucent={false}
        />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
});
