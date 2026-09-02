import React from 'react';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {theme} from '../theme/theme';
import {SplashScreen} from '../screens/SplashScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LevelSelectionScreen} from '../screens/LevelSelectionScreen';
import {GameScreen} from '../screens/GameScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {HowToPlayScreen} from '../screens/HowToPlayScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** §10.2 — 220ms fade-through between screens; game entry adds a board scale-in. */
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg.base,
    card: theme.bg.panel,
    text: theme.text.primary,
    border: theme.bg.border,
    primary: theme.state.currentLevel,
  },
};

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 220,
          contentStyle: {backgroundColor: theme.bg.base},
        }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="LevelSelection" component={LevelSelectionScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
