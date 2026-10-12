import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  G,
  Circle,
  Rect,
} from 'react-native-svg';
import {menuTheme as theme} from '../theme/menuTheme';

/** Original folded arrow emblem, rendered sharply at every size. */
export function ArrowEmblem({size = 120}: {size?: number}): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" accessible={false}>
      <Defs>
        <LinearGradient id="emblemFront" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#61DDFF" />
          <Stop offset="0.5" stopColor="#13A5FC" />
          <Stop offset="1" stopColor="#0665CE" />
        </LinearGradient>
        <LinearGradient id="emblemFold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#03498D" />
          <Stop offset="1" stopColor="#22BDFF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M34 145 C85 153 116 129 102 104 C91 84 49 84 47 66 C43 43 84 29 112 33 L111 12 L149 43 L111 75 L112 53 C87 52 63 64 72 76 C85 89 128 96 127 118 C127 145 87 156 34 145Z"
        fill="url(#emblemFront)"
      />
      <Path
        d="M47 66 C50 84 93 85 102 104 C109 117 102 129 82 135 C102 116 48 109 37 91 C27 76 32 61 47 51Z"
        fill="url(#emblemFold)"
      />
      <Path
        d="M40 54 C54 33 84 27 110 33 M117 25 L137 43 M48 137 C71 143 97 137 108 130"
        fill="none"
        stroke="#B5EFFF"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.65}
      />
    </Svg>
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
      {kind === 'pause' ? (
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
  halo: {position: 'absolute', backgroundColor: theme.bg.panelAlt},
});
