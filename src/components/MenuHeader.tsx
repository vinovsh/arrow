import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ClickPressable} from './ClickPressable';
import {ProfileAvatar} from './ProfileAvatar';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
export function MenuHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.header}>
      <ClickPressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.back}>
        <Text style={styles.glyph}>‹</Text>
      </ClickPressable>
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <ProfileAvatar kind="player" size={44} />
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 76,
  },
  back: {
    backgroundColor: theme.bg.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.bg.border,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {fontSize: 36, color: theme.text.primary, lineHeight: 40},
  titles: {flex: 1, alignItems: 'center'},
  title: {...typography.ui(23)},
  subtitle: {...typography.body(13), marginTop: 4, textAlign: 'center'},
});
