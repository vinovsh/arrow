import React from 'react';
import Svg, {G, Path} from 'react-native-svg';
import {theme} from '../theme/theme';

interface Props {
  /** Width in dp; the hand is square and scales with it. */
  size: number;
}

/**
 * The hand the coach mark points with.
 *
 * It is an icon, not a drawing of one: Font Awesome Free's `hand-pointer` (solid),
 * which is the pointing-glove shape the reference uses — index finger up, three
 * curled fingers, thumb tucked. Two attempts at drawing the silhouette by hand came
 * out as a blob with a stick on it; an icon that thousands of products ship is a hand
 * at any size, which is the whole job here. Licence and provenance are recorded in
 * `assets/art/LICENSES.md` — it is CC BY 4.0 and therefore needs attribution.
 *
 * Three things are done to it:
 *
 * - **Rotated 25° anticlockwise**, so it points up and to the left and can sit below
 *   and right of the arrow it indicates — the one quadrant where it covers nothing.
 *   The viewBox is the rotated art's own bounding box plus room for the stroke, not
 *   the icon's original 448x512, which the rotation overflows.
 * - **Filled white and stroked in the board's ink**, which is what makes it read as a
 *   cartoon glove rather than as a navy blot. The reference outlines its hand in the
 *   same navy it draws arrows in.
 * - **Backed by a soft offset copy**, so it sits above the board rather than in it.
 */
const ICON =
  'M128 40c0-22.1 17.9-40 40-40s40 17.9 40 40l0 148.2c8.5-7.6 19.7-12.2 32-12.2' +
  'c20.6 0 38.2 13 45 31.2c8.8-9.3 21.2-15.2 35-15.2c25.3 0 46 19.5 47.9 44.3' +
  'c8.5-7.7 19.8-12.3 32.1-12.3c26.5 0 48 21.5 48 48l0 48 0 16 0 48c0 70.7-57.3 128-128 128' +
  'l-16 0-64 0-.1 0-5.2 0c-5 0-9.9-.3-14.7-1c-55.3-5.6-106.2-34-140-79L8 336' +
  'c-13.3-17.7-9.7-42.7 8-56s42.7-9.7 56 8l56 74.7L128 40z' +
  'M240 304c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96z' +
  'm48-16c-8.8 0-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96c0-8.8-7.2-16-16-16z' +
  'm80 16c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96z';

/** The rotated art measured in Chrome: x 40.9..493.1, y 43.9..500.0. */
const VIEW_BOX = '26 31 482 482';
const ROTATE = 'rotate(-25 224 256)';
const STROKE = 22;
const SHADOW = 'rgba(6,18,66,0.13)';

/**
 * Where the finger meets what it is pointing at, as a fraction of `size`. The
 * topmost point of the rotated path is at (81.9, 43.9); this is a little way back
 * down the finger from it, so the arrow passes under the fingertip rather than
 * grazing its outer edge — which is how the reference places it.
 */
export const FINGERTIP = {x: 0.14, y: 0.08};

function GuideHandBase({size}: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      {/* The shadow is offset in screen space, so its translate sits outside the
          rotation rather than being turned by it. */}
      <G transform="translate(8 14)">
        <G transform={ROTATE}>
          <Path
            d={ICON}
            fill={SHADOW}
            stroke={SHADOW}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
        </G>
      </G>
      <G transform={ROTATE}>
        <Path
          d={ICON}
          fill="#FFFFFF"
          stroke={theme.board.ink}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

export const GuideHand = React.memo(GuideHandBase);
