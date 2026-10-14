import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Svg, {Path, G, Circle, Rect} from 'react-native-svg';
import {ProfileAvatar} from './ProfileAvatar';
import {menuTheme as theme} from '../theme/menuTheme';

/** Approved Happy Arrow logo shared with the Android launcher. */
export function ArrowEmblem({size = 120}: {size?: number}): React.JSX.Element {
  return (
    <Image
      source={require('../../assets/art/happy-arrow.png')}
      resizeMode="contain"
      resizeMethod="resize"
      accessible={false}
      style={{width: size, height: size, borderRadius: size * 0.24}}
    />
  );
}

export function MenuHero({
  kind,
  size = 120,
}: {
  kind: 'happy' | 'party' | 'bulb' | 'hearts' | 'trophy' | 'pause';
  size?: number;
}): React.JSX.Element {
  const emoji = {
    happy: '😄',
    party: '🥳',
    bulb: '💡',
    hearts: '💕',
    trophy: '🏆',
    pause: '⏸️',
  }[kind];
  return (
    <View
      style={[styles.hero, {width: size * 1.4, height: size * 1.25}]}
      accessible={false}>
      <View
        style={[
          styles.halo,
          {width: size, height: size, borderRadius: size / 2},
        ]}
      />
      {(kind === 'happy' || kind === 'party') && (
        <Svg
          width={size * 1.4}
          height={size * 1.25}
          viewBox="0 0 140 125"
          style={StyleSheet.absoluteFill}>
          <G strokeWidth={5} strokeLinecap="round">
            <Path d="M12 40L17 46 M118 24L115 34" stroke="#27A8FB" />
            <Path d="M34 12L38 18 M130 62L126 70" stroke="#FF7290" />
            <Path d="M61 6L63 12 M18 80L23 84" stroke="#FFC53D" />
          </G>
          <Circle cx={104} cy={105} r={3} fill="#27A8FB" />
        </Svg>
      )}
      {kind === 'happy' ? (
        <ProfileAvatar kind="player" size={size} />
      ) : kind === 'pause' ? (
        <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 100 100">
          <Rect
            x={25}
            y={15}
            width={18}
            height={70}
            rx={9}
            fill={theme.brand.tagline}
          />
          <Rect
            x={57}
            y={15}
            width={18}
            height={70}
            rx={9}
            fill={theme.brand.tagline}
          />
        </Svg>
      ) : (
        <Text style={{fontSize: size * 0.82, lineHeight: size * 1.12}}>
          {emoji}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  hero: {alignItems: 'center', justifyContent: 'center'},
  halo: {position: 'absolute', backgroundColor: theme.pastel.yellow},
});
