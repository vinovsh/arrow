import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {menuTheme as theme} from '../theme/menuTheme';
/** Opaque menu surface, safe areas and vertical scrolling for short displays. */
export function MenuModal({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: theme.bg.base,
  },
  safe: {flex: 1},
  scroll: {flexGrow: 1, justifyContent: 'center', padding: 24},
  content: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 20,
  },
});
