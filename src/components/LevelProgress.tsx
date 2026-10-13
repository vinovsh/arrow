import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {menuTheme as theme} from '../theme/menuTheme';
import {type as typography} from '../theme/menuTypography';
export function LevelProgress({
  cleared,
  total,
}: {
  cleared: number;
  total: number;
}): React.JSX.Element {
  const count = Math.max(0, Math.min(total, cleared));
  return (
    <View style={styles.card}>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Arrows cleared"
        accessibilityValue={{min: 0, max: total, now: count}}>
        <LinearGradient
          colors={['#65E7B6', '#26C88D']}
          style={[
            styles.fill,
            {width: `${total > 0 ? (count / total) * 100 : 0}%`},
          ]}
        />
      </View>
      <Text style={styles.label}>
        {count} / {total} cleared
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.bg.panel,
  },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.pastel.mint,
    overflow: 'hidden',
  },
  fill: {height: '100%', borderRadius: 6},
  label: {...typography.ui(11), color: theme.text.primary},
});
