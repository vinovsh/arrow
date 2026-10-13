import React, {useEffect, useRef} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {MenuBackdrop} from '../components/MenuBackdrop';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {ArrowEmblem} from '../components/MenuArt';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
import {preloadAround} from '../game/levels';
type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export function SplashScreen({navigation}: Props): React.JSX.Element {
  const advanced = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let hold: ReturnType<typeof setTimeout>;
    const held = new Promise<void>(resolve => {
      hold = setTimeout(resolve, 1400);
    });
    const boot = (async () => {
      const data = await SaveStore.load();
      preloadAround(data.currentLevel);
      await Audio.preload();
      Audio.startMusic();
    })();
    void Promise.all([held, boot]).then(() => {
      if (cancelled || advanced.current) {
        return;
      }
      advanced.current = true;
      if (
        !SaveStore.data.tutorialCompleted &&
        !SaveStore.data.completedLevels.length
      ) {
        navigation.replace('Game', {levelId: 1});
      } else {
        navigation.replace('Home');
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(hold);
    };
  }, [navigation]);
  return (
    <SafeAreaView style={styles.root}>
      <MenuBackdrop />
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg.base} />
      <View style={styles.brand}>
        <ArrowEmblem size={190} />
        <Text style={styles.title}>Arrow Escape</Text>
        <View style={styles.dots} accessible accessibilityLabel="Loading">
          <View style={[styles.dot, styles.active]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {alignItems: 'center', gap: 22},
  title: {...typography.display(30)},
  dots: {flexDirection: 'row', gap: 10, marginTop: 28},
  dot: {width: 9, height: 9, borderRadius: 5, backgroundColor: theme.bg.border},
  active: {backgroundColor: theme.brand.tagline},
});
