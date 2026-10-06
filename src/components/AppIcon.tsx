import React from 'react';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {theme} from '../theme/theme';

type IconName =
  | 'play'
  | 'levels'
  | 'settings'
  | 'help'
  | 'chevron'
  | 'sparkle'
  | 'heart';

/** Rounded vector icons share one stroke weight and remain crisp on every device. */
export function AppIcon({
  name,
  size = 24,
  color = theme.text.primary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}>
      {name === 'play' && (
        <Path
          d="M8 5.5Q6 4.5 6 7V17Q6 19.5 8 18.5L18 13Q20 12 18 11Z"
          fill={color}
          stroke="none"
        />
      )}
      {name === 'levels' && (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={2.2} />
          <Rect x={14} y={3} width={7} height={7} rx={2.2} />
          <Rect x={3} y={14} width={7} height={7} rx={2.2} />
          <Rect x={14} y={14} width={7} height={7} rx={2.2} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path d="M10 3H14L14.7 5.5L17 6.8L19.5 6.2L21.5 9.8L19.7 11.6V14.1L21.5 15.9L19.5 19.4L17 18.8L14.7 20.1L14 22H10L9.3 20.1L7 18.8L4.5 19.4L2.5 15.9L4.3 14.1V11.6L2.5 9.8L4.5 6.2L7 6.8L9.3 5.5Z" />
          <Circle cx={12} cy={12.5} r={3.3} />
        </>
      )}
      {name === 'help' && (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M9.5 9A2.6 2.6 0 1 1 14 11C12.7 11.8 12 12.4 12 14" />
          <Circle cx={12} cy={17} r={0.8} fill={color} stroke="none" />
        </>
      )}
      {name === 'chevron' && <Path d="M9 6L15 12L9 18" />}
      {name === 'sparkle' && (
        <Path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" />
      )}
      {name === 'heart' && (
        <Path d="M12 20S3 14.5 3 8.5C3 3.5 9.5 2.5 12 7C14.5 2.5 21 3.5 21 8.5C21 14.5 12 20 12 20Z" />
      )}
    </Svg>
  );
}
