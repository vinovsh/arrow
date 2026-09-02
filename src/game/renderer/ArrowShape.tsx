import React from 'react';
import {G, Path} from 'react-native-svg';
import type {ArrowPath} from '../models/types';
import {theme} from '../../theme/theme';
import type {RenderTier} from '../../app/featureFlags';
import type {ArrowGeometry} from './arrowGeometry';

interface Props {
  arrow: ArrowPath;
  geometry: ArrowGeometry;
  tier: RenderTier;
  /** §9.3 — outlined at 25% as the blocker of a failed tap. */
  highlighted?: boolean;
  /** §3.3, §3.4 — pulsing for a hint or the silent assist. */
  pulsing?: boolean;
}

/**
 * The arrow itself, with no animation and no state of its own.
 *
 * Both the static board and the moving overlay draw through this, so an arrow that
 * lifts off to leave the board is pixel-identical to the one that was sitting there a
 * frame earlier — which is the whole point of the exit animation: the player has to
 * believe it is the same object.
 */
function ArrowShapeBase({
  arrow,
  geometry,
  tier,
  highlighted = false,
  pulsing = false,
}: Props): React.JSX.Element {
  const colour = theme.arrow[arrow.color];
  const hasBody = geometry.body !== '';

  return (
    <G>
      {/* Glow. Above 60 arrows the tier bakes a static glow into one shared underlay
          instead of giving every arrow its own (§13). */}
      {!tier.bakedGlowUnderlay && (
        <>
          {hasBody && (
            <Path
              d={geometry.body}
              stroke={colour}
              strokeWidth={geometry.strokeWidth * 1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeOpacity={0.34 * tier.glowOpacityScale}
            />
          )}
          <Path
            d={geometry.head}
            fill={colour}
            stroke={colour}
            strokeWidth={geometry.strokeWidth * 0.85}
            strokeLinejoin="round"
            opacity={0.34 * tier.glowOpacityScale}
          />
        </>
      )}

      {hasBody && (
        <Path
          d={geometry.body}
          stroke={colour}
          strokeWidth={geometry.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      <Path d={geometry.head} fill={colour} />

      {/* Highlight — the third layer, and the first thing the tier drops (§13). */}
      {tier.layersPerArrow === 3 && hasBody && (
        <Path
          d={geometry.body}
          stroke={theme.arrow.white}
          strokeWidth={geometry.strokeWidth * 0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.25}
        />
      )}

      {/* §9.3 — the blocker outline: the single highest-value readability cue in the
          game, and worth more the denser the board gets. */}
      {highlighted && (
        <>
          {hasBody && (
            <Path
              d={geometry.body}
              stroke={theme.text.primary}
              strokeWidth={geometry.strokeWidth * 1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.25}
            />
          )}
          <Path
            d={geometry.head}
            fill="none"
            stroke={theme.text.primary}
            strokeWidth={geometry.strokeWidth * 0.4}
            strokeLinejoin="round"
            opacity={0.25}
          />
        </>
      )}

      {pulsing && (
        <>
          {hasBody && (
            <Path
              d={geometry.body}
              stroke={theme.state.star}
              strokeWidth={geometry.strokeWidth * 1.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.55}
            />
          )}
          <Path
            d={geometry.head}
            fill="none"
            stroke={theme.state.star}
            strokeWidth={geometry.strokeWidth * 0.5}
            strokeLinejoin="round"
            opacity={0.55}
          />
        </>
      )}
    </G>
  );
}

export const ArrowShape = React.memo(ArrowShapeBase);
