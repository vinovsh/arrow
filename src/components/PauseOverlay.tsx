import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Button} from './Button';
import {Toggle} from './Toggle';
import {MenuHero} from './MenuArt';
import {MenuModal} from './MenuModal';
import {AppIcon} from './AppIcon';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
interface Props {
  visible: boolean;
  hintsRemaining: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onHint: () => void;
}
export function PauseOverlay({
  visible,
  hintsRemaining,
  onResume,
  onRestart,
  onQuit,
  onHint,
}: Props): React.JSX.Element | null {
  const [save, setSave] = useState(SaveStore.data);
  useEffect(() => SaveStore.subscribe(setSave), []);
  if (!visible) {
    return null;
  }
  return (
    <MenuModal>
      <MenuHero kind="pause" size={116} />
      <Text accessibilityRole="header" style={styles.title}>
        Take a breather
      </Text>
      <View style={styles.actions}>
        <Button label="Resume" variant="play" onPress={onResume} />
        <Button
          label="Restart level"
          variant="neutral"
          icon="↻"
          glow={false}
          onPress={onRestart}
        />
        <Button
          label="Home"
          variant="neutral"
          icon={<AppIcon name="home" color={theme.brand.tagline} />}
          glow={false}
          onPress={onQuit}
        />
      </View>
      <View style={styles.sound}>
        <Toggle
          icon={<AppIcon name="sound" color={theme.brand.tagline} />}
          label="Sound"
          value={save.soundEnabled}
          onChange={value => {
            SaveStore.update({soundEnabled: value});
            Audio.applySettings();
          }}
        />
      </View>
      <Button
        label={`Use hint · ${hintsRemaining} left`}
        disabled={hintsRemaining === 0}
        variant="neutral"
        glow={false}
        onPress={onHint}
        style={styles.actions}
      />
    </MenuModal>
  );
}
const styles = StyleSheet.create({
  title: {...typography.display(27), textAlign: 'center'},
  actions: {alignSelf: 'stretch', gap: 12},
  sound: {
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: theme.bg.border,
    marginTop: 12,
  },
});
