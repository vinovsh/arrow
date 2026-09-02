import React, {useEffect, useState} from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Panel} from '../components/Panel';
import {Toggle} from '../components/Toggle';
import {SaveStore} from '../storage/SaveStore';
import type {SaveData} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import {FEATURES} from '../app/featureFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const APP_VERSION = '1.0.0';

/** §5.9 — three toggles, four chevron rows. Nothing else. */
export function SettingsScreen({navigation}: Props): React.JSX.Element {
  const [save, setSave] = useState<SaveData>(SaveStore.data);
  const [versionTaps, setVersionTaps] = useState(0);

  useEffect(() => SaveStore.subscribe(setSave), []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Panel>
          <Toggle
            icon="🔊"
            label="SOUND"
            value={save.soundEnabled}
            onChange={next => {
              SaveStore.update({soundEnabled: next});
            }}
          />
          <View style={styles.divider} />
          <Toggle
            icon="🎵"
            label="MUSIC"
            value={save.musicEnabled}
            onChange={next => {
              SaveStore.update({musicEnabled: next});
              // §14 — toggles take effect immediately, including on looping music.
              Audio.applySettings();
            }}
          />
          <View style={styles.divider} />
          <Toggle
            icon="📳"
            label="VIBRATION"
            value={save.vibrationEnabled}
            onChange={next => {
              SaveStore.update({vibrationEnabled: next});
              if (next) {
                // Confirm the change with the thing it controls.
                Haptics.selection();
              }
            }}
          />
        </Panel>

        <Panel style={styles.group}>
          <ChevronRow
            icon="★"
            label="RATE US"
            onPress={() => {
              void Linking.openURL('market://details?id=com.arrowescape').catch(
                () =>
                  Alert.alert(
                    'Rate us',
                    'The store is not available on this device.',
                  ),
              );
            }}
          />
          <View style={styles.divider} />
          <ChevronRow
            icon="🛡"
            label="PRIVACY POLICY"
            onPress={() =>
              Alert.alert(
                'Privacy',
                // §15 — no account, no backend, no analytics endpoint. The policy is
                // short because there is nothing to disclose.
                'Arrow Escape stores your progress and settings on this device only. ' +
                  'It has no account, no backend and no analytics, and works fully in ' +
                  'airplane mode.',
              )
            }
          />
          <View style={styles.divider} />
          <ChevronRow
            icon="ⓘ"
            label="ABOUT"
            onPress={() =>
              Alert.alert(
                'Arrow Escape',
                `Version ${APP_VERSION}\nAll artwork original.`,
              )
            }
          />
          <View style={styles.divider} />
          <ChevronRow
            icon="?"
            label="HOW TO PLAY"
            onPress={() => navigation.navigate('HowToPlay')}
          />
        </Panel>

        {/* §8.7 — developer mode is seven taps on the version string, and only in a
            debug build. It is never reachable by a normal user in release. */}
        <Pressable
          onPress={() => {
            const next = versionTaps + 1;
            setVersionTaps(next);
            if (next >= FEATURES.devMenuTapCount && __DEV__) {
              setVersionTaps(0);
              Alert.alert(
                'Developer mode',
                'Level jump, solution reveal, computed D, free-count trace and the ' +
                  'FPS meter are available from the game screen in debug builds.',
              );
            }
          }}>
          <Text style={styles.version}>v{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChevronRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.spacer} />
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    height: 56,
  },
  back: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 30, color: theme.text.primary, lineHeight: 32},
  title: {
    ...typography.display(20),
    flex: 1,
    textAlign: 'center',
    letterSpacing: 2,
  },
  body: {padding: theme.space.md, gap: theme.space.md},
  group: {marginTop: theme.space.xs},
  divider: {height: 1, backgroundColor: theme.bg.border},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space.md,
    gap: theme.space.md,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    color: theme.text.secondary,
  },
  rowLabel: {...typography.ui(16)},
  spacer: {flex: 1},
  chevron: {fontSize: 24, color: theme.text.dim},
  version: {
    ...typography.body(12),
    color: theme.text.dim,
    textAlign: 'center',
    paddingVertical: theme.space.lg,
  },
});
