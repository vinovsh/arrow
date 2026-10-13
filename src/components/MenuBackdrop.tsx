import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {menuTheme as theme} from '../theme/menuTheme';

/** Quiet decoration behind the menus; never intercepts a tap. */
export function MenuBackdrop(): React.JSX.Element {
  return (
    <View pointerEvents="none" accessible={false} style={styles.root}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-30 96C-15 64 12 60 29 76C24 31 90 28 94 73C132 66 148 122 113 132H-30Z"
          fill="#FFFFFF"
          opacity={0.8}
        />
        <Path
          d="M322 46C329 17 366 18 373 44C398 22 430 39 430 69V100H322C290 99 292 49 322 46Z"
          fill="#FFFFFF"
          opacity={0.8}
        />
        <Path
          d="M-30 768C-12 731 24 732 35 749C38 709 96 718 94 754C125 748 149 780 128 811H-30Z"
          fill="#FFFFFF"
        />
        <Path
          d="M318 790C315 755 359 744 377 766C389 730 430 730 437 768V830H318Z"
          fill={theme.pastel.lavender}
          opacity={0.6}
        />
        <Path
          d="M32 168Q35 157 38 168Q49 171 38 174Q35 185 32 174Q21 171 32 168Z"
          fill={theme.pastel.yellow}
        />
        <Path
          d="M354 179Q357 168 360 179Q371 182 360 185Q357 196 354 185Q343 182 354 179Z"
          fill={theme.pastel.mint}
        />
        <Circle cx={376} cy={208} r={4} fill={theme.pastel.lavender} />
        <Circle cx={22} cy={621} r={3} fill={theme.pastel.peach} />
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
});
