import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {theme} from '../theme/theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Modal panels sit on the dimmed game screen and want a stronger shadow. */
  raised?: boolean;
}

/** §10.2 — rounded card, 1px 8%-white border, soft outer shadow. Never glows. */
export function Panel({
  children,
  style,
  raised = false,
}: Props): React.JSX.Element {
  return (
    <View style={[styles.panel, raised && styles.raised, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.bg.panel,
    borderRadius: theme.radius.panel,
    borderWidth: 1,
    borderColor: theme.bg.border,
    padding: theme.space.lg,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 10},
    elevation: 12,
  },
});
