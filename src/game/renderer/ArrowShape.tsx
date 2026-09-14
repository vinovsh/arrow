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
  /** §9.3 — outlined at 25% as the blocker of a failed tap. */
  highlighted?: boolean;
  /** §3.3, §3.4 — pulsing for a hint or the silent assist. */
  pulsing?: boolean;
}

/**
 * §10.2 — the layer stack, and every width in it as a multiple of the stroke.
 *
 * Tying these to the stroke rather than to the cell is the whole trick behind the
 * thin look: halve the line and the halo, the casing and the gloss all halve with it,
 * so an arrow stays the same drawing from a 5x5 board to a 14x14 one. Sized off the
 * cell instead — which is what the old chunky version did — thinning the line just
 * leaves the decoration behind at pipe scale, swallowing the line inside its own glow.
 *
 * The two attention states run wider than everything else because a halo has to clear
 * the glow to be seen at all at 3dp.
 */
const GLOW = 2.4;
const GLOW_OPACITY = 0.22;
const CASING = 1.75;
const GLOSS = 0.26;
const HIGHLIGHT = 3;
const PULSE = 3.4;

/**
 * The arrow itself, with no animation and no state of its own.
 *
 * Both the static board and the moving overlay draw through this, so an arrow that
 * lifts off to leave the board is pixel-identical to the one that was sitting there a
 * frame earlier — which is the whole point of the exit animation: the player has to
 * believe it is the same object. `ArrowStrokes` is the narrowest thing that can be
 * drawn, so a resting `ArrowGeometry` and a deforming `RopeGeometry` both satisfy it.
 */
function ArrowShapeBase({
  arrow,
  geometry,
  tier,
  highlighted = false,
  pulsing = false,
}: Props): React.JSX.Element {
  const colour = theme.arrow[arrow.color];
  const {body, head, strokeWidth: w} = geometry;
  const hasBody = body !== '';

  return (
    <G>
      {/* Glow and casing. Above 60 arrows the tier bakes one shared underlay instead
          of giving every arrow its own (§13); there the underlay is the casing, since
          on a board that dense separating neighbouring paths is worth far more than a
          bloom that would just haze the picture over. */}
      {!tier.bakedUnderlay && (
        <>
          {hasBody && (
            <Path
              d={body}
              stroke={colour}
              strokeWidth={w * GLOW}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeOpacity={GLOW_OPACITY * tier.glowOpacityScale}
            />
          )}
          <Path
            d={head}
            fill={colour}
            stroke={colour}
            strokeWidth={w * 1.1}
            strokeLinejoin="round"
            opacity={GLOW_OPACITY * tier.glowOpacityScale}
          />

          {hasBody && (
            <Path
              d={body}
              stroke={theme.arrowInk.casing}
              strokeWidth={w * CASING}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          <Path
            d={head}
            fill={theme.arrowInk.casing}
            stroke={theme.arrowInk.casing}
            strokeWidth={w * 0.7}
            strokeLinejoin="round"
          />
        </>
      )}

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

      {/* Gloss — the third layer, and the first thing the tier drops (§13). */}
      {tier.layersPerArrow === 3 && hasBody && (
        <Path
          d={body}
          stroke={theme.arrowInk.gloss}
          strokeWidth={w * GLOSS}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.22}
        />
      )}

      {/* §9.3 — the blocker outline: the single highest-value readability cue in the
          game, and worth more the denser the board gets. */}
      {highlighted && (
        <>
          {hasBody && (
            <Path
              d={body}
              stroke={theme.text.primary}
              strokeWidth={w * HIGHLIGHT}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.25}
            />
          )}
          <Path
            d={head}
            fill="none"
            stroke={theme.text.primary}
            strokeWidth={w}
            strokeLinejoin="round"
            opacity={0.25}
          />
        </>
      )}

      {pulsing && (
        <>
          {hasBody && (
            <Path
              d={body}
              stroke={theme.state.star}
              strokeWidth={w * PULSE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.5}
            />
          )}
          <Path
            d={head}
            fill="none"
            stroke={theme.state.star}
            strokeWidth={w * 1.2}
            strokeLinejoin="round"
            opacity={0.5}
          />
        </>
      )}
    </G>
  );
}

export const ArrowShape = React.memo(ArrowShapeBase);
