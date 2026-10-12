import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';
import {theme} from '../theme/theme';

/** Original touch-target icon. A clear fingertip target instead of a cartoon hand. */
export function TapCue({size = 28}: {size?: number}): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      accessibilityLabel="Tap">
      <Circle
        cx={13}
        cy={13}
        r={9}
        fill="none"
        stroke={theme.board.escaping}
        strokeWidth={1.7}
      />
      <Circle cx={13} cy={13} r={3} fill={theme.board.escaping} />
      <Path
        d="M 17 16 L 27 22 L 22 23 L 20 28 Z"
        fill={theme.board.ink}
        stroke={theme.board.bg}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
