import React, {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ClickPressable} from '../components/ClickPressable';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Panel} from '../components/Panel';
import {MenuHeader} from '../components/MenuHeader';
import {AppIcon} from '../components/AppIcon';
import {Toggle} from '../components/Toggle';
import {SaveStore} from '../storage/SaveStore';
import type {SaveData} from '../storage/SaveStore';
import {Ads} from '../ads/AdService';
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
      <MenuHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>Preferences</Text>
        <Panel>
          <Toggle
            icon={<AppIcon name="sound" color={theme.brand.tagline} />}
            label="Sound"
            value={save.soundEnabled}
            onChange={next => {
              SaveStore.update({soundEnabled: next});
            }}
          />
          <View style={styles.divider} />
          <Toggle
            icon={<AppIcon name="music" color={theme.brand.tagline} />}
            label="Music"
            value={save.musicEnabled}
            onChange={next => {
              SaveStore.update({musicEnabled: next});
              // §14 — toggles take effect immediately, including on looping music.
              Audio.applySettings();
            }}
          />
          <View style={styles.divider} />
          <Toggle
            icon={<AppIcon name="vibration" color={theme.brand.tagline} />}
            label="Vibration"
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
          {Ads.enabled && (
            <>
              <ChevronRow
                icon="?"
                label="Ad privacy"
                onPress={() => {
                  void Ads.showPrivacyOptions().catch((error: unknown) =>
                    Alert.alert(
                      'Ad privacy choices',
                      error instanceof Error
                        ? error.message
                        : 'No privacy form is available right now.',
                    ),
                  );
                }}
              />
              <View style={styles.divider} />
            </>
          )}
          <ChevronRow
            icon="★"
            label="Rate us"
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
            label="Privacy policy"
            onPress={() =>
              Alert.alert(
                'Privacy',
                // §15 — no account, no backend, no analytics endpoint. The policy is
                // short because there is nothing to disclose.
                'Arrow Escape stores your progress and settings on this device only. ' +
                  'Optional rewarded ads are provided by Google AdMob and require internet. ' +
                  'Google may process device and ad interaction data according to your privacy choices. ' +
                  'Puzzle gameplay works offline.',
              )
            }
          />
          <View style={styles.divider} />
          <ChevronRow
            icon="ⓘ"
            label="About"
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
            label="How to play"
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
    <ClickPressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button">
      <AppIcon
        name={
          icon === '★'
            ? 'star'
            : icon === '🛡'
            ? 'shield'
            : icon === 'ⓘ'
            ? 'info'
            : 'help'
        }
        color={theme.brand.tagline}
      />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.spacer} />
      <Text style={styles.chevron}>›</Text>
    </ClickPressable>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    height: 76,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: theme.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {fontSize: 30, color: theme.text.primary, lineHeight: 32},
  title: {
    ...typography.display(20),
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  body: {padding: theme.space.md, gap: theme.space.md},
  group: {marginTop: theme.space.xs},
  sectionLabel: {
    ...typography.ui(11),
    color: theme.brand.tagline,
    letterSpacing: 1.5,
    marginVertical: theme.space.sm,
  },
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
  rowLabel: {...typography.body(15), color: theme.text.primary, flex: 1},
  spacer: {flex: 1},
  chevron: {fontSize: 24, color: theme.text.dim},
  version: {
    ...typography.body(12),
    color: theme.text.dim,
    textAlign: 'center',
    paddingVertical: theme.space.lg,
  },
});
