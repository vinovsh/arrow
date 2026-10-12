import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
import {Button} from './Button';
import {AppIcon} from './AppIcon';
import {MenuHero} from './MenuArt';
import {MenuModal} from './MenuModal';
interface Props {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  onWatchVideo: () => void;
  onRetry: () => void;
}
export function OutOfLivesOverlay({
  visible,
  loading = false,
  error,
  onWatchVideo,
  onRetry,
}: Props): React.JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <MenuModal>
      <MenuHero kind="hearts" size={130} />
      <Text accessibilityRole="header" style={styles.title}>
        Try again?
      </Text>
      <Text style={styles.body}>Watch a rewarded ad for one heart.</Text>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        label={loading ? 'Loading ad…' : 'Get more lives'}
        icon={<AppIcon name="play" color={theme.bg.panel} />}
        variant="reward"
        disabled={loading}
        onPress={onWatchVideo}
        style={styles.button}
      />
      <Button
        label="Restart level"
        variant="neutral"
        glow={false}
        disabled={loading}
        onPress={onRetry}
        style={styles.button}
      />
    </MenuModal>
  );
}
const styles = StyleSheet.create({
  title: {...typography.display(28), textAlign: 'center'},
  body: {
    ...typography.body(16),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  error: {
    ...typography.body(13),
    color: theme.state.danger,
    textAlign: 'center',
  },
  button: {alignSelf: 'stretch'},
});
