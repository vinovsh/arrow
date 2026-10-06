import React from 'react';
import Svg, {Circle, Ellipse, Path, Rect} from 'react-native-svg';
import {theme} from '../theme/theme';

/** A small, original arrow friend, drawn with vectors for crisp scaling. */
export function ArrowBuddy(): React.JSX.Element {
  return (
    <Svg width={132} height={116} viewBox="0 0 160 140" accessible={false}>
      <Ellipse cx={80} cy={126} rx={42} ry={7} fill={theme.bg.border} />
      <Circle cx={80} cy={65} r={56} fill={theme.bg.panelAlt} />
      <Path
        d="M26 28L29 20L32 28L40 31L32 34L29 42L26 34L18 31Z"
        fill={theme.state.star}
      />
      <Circle cx={138} cy={88} r={5} fill={theme.button.levels[0]} />
      <Path
        d="M48 53Q43 53 43 60V92Q43 99 51 99H91V112Q91 120 98 114L128 85Q134 79 128 73L98 44Q91 38 91 46V53Z"
        fill={theme.button.play[1]}
      />
      <Rect
        x={39}
        y={48}
        width={57}
        height={47}
        rx={16}
        fill={theme.button.play[0]}
      />
      <Path
        d="M88 46Q88 38 95 44L125 73Q131 79 125 85L95 114Q88 120 88 112Z"
        fill={theme.button.play[0]}
      />
      <Circle cx={63} cy={70} r={3.5} fill={theme.text.primary} />
      <Circle cx={84} cy={70} r={3.5} fill={theme.text.primary} />
      <Ellipse cx={55} cy={81} rx={6} ry={3} fill={theme.button.levels[0]} />
      <Ellipse cx={92} cy={81} rx={6} ry={3} fill={theme.button.levels[0]} />
      <Path
        d="M66 81Q73 89 81 81"
        fill="none"
        stroke={theme.text.primary}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M48 57H72"
        stroke={theme.bg.panel}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.4}
      />
    </Svg>
  );
}
