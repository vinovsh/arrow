import React from 'react';
import {G, Path} from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import {theme} from '../../theme/theme';
import type {RenderTier} from '../../app/featureFlags';
import type {ArrowStrokes} from './arrowGeometry';

interface Props {
  arrow: ArrowPath;
  geometry: ArrowStrokes;
  tier: RenderTier;
  /** §9.3 — the arrow that blocked a failed tap. */
  highlighted?: boolean;
  /** §9.3 — the arrow the player actually tapped and could not free. */
  blocked?: boolean;
  /** §3.3, §3.4 — pulsing for a hint or the silent assist. */
  pulsing?: boolean;
  /** The reference turns only the departing arrow cyan. */
  escaping?: boolean;
  guided?: boolean;
}

/**
 * §10.2 — one line, one colour, no layers.
 *
 * This used to draw five passes per arrow — glow, casing, body, gloss, and a halo for
 * each attention state — in one of eight hues carried by the level data. All of that
 * is gone, and the reason is worth keeping: on a board of forty interlocking paths
 * the decoration *was* the noise. A glow and a casing are both ways of separating a
 * line from what sits next to it, and on a dense maze they fight the one separator
 * that actually works, which is the white page showing through the gap. The hues did
 * the same thing to the silhouette: eight colours across one picture stops it reading
 * as one picture.
 *
 * So the arrow is now exactly what the reference draws — a navy stroke with a solid
 * triangle on the end — and `arrow.color` is deliberately not read. The palette is
 * still in the theme and still in the level data; nothing on the board consults it.
 *
 * `tier` is kept in the signature because every caller still threads it through, but
 * nothing here varies by it and `renderTierFor` no longer has anything to say: two
 * paths per arrow is already below the budget the tier existed to defend.
 */

function ArrowShapeBase({
  geometry,
  highlighted = false,
  blocked = false,
  pulsing = false,
  escaping = false,
  guided = false,
}: Props): React.JSX.Element {
  const {body, head, strokeWidth: w} = geometry;
  const hasBody = body !== '';

  // §9.3 — a failed tap is the only thing that puts a second colour on the board, and
  // it puts two: the arrow the player tapped goes bright, the arrow in its way goes
  // muted. Recolouring the arrows rather than ringing them is both louder and
  // cheaper — at these stroke widths an outline at 25% was barely visible on a dense
  // board — and the two tones are what say *which* of the two the player touched.
  const colour = blocked
    ? theme.board.blocked
    : highlighted
    ? theme.board.blocker
    : escaping || guided || pulsing
    ? theme.board.escaping
    : theme.board.ink;

  return (
    <G>
      {hasBody && (
        <Path
          d={body}
          stroke={colour}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      <Path d={head} fill={colour} />
    </G>
  );
}

export const ArrowShape = React.memo(ArrowShapeBase);
