import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, G, Path, ClipPath, Rect} from 'react-native-svg';
import type {Level} from '../models/types';
import {theme} from '../../theme/theme';
import {renderTierFor} from '../../app/featureFlags';
import {BASE_RESOLUTION_SCALE} from '../../utils/layout';
import {DotGrid} from './DotGrid';
import {DecorLayer} from './DecorLayer';
import {ArrowRenderer} from './ArrowRenderer';
import type {ArrowVisualState} from './ArrowRenderer';
import {buildArrowGeometry} from './arrowGeometry';
// TEMPORARY — tap-latency instrumentation, see src/utils/tapTrace.ts.
import {trace} from '../../utils/tapTrace';

interface Props {
  level: Level;
  cellSize: number;
  arrowStates: readonly ArrowVisualState[];
  /**
   * §5.5 — the crispness re-render. The container view is what zooms, so the SVG is
   * untouched during a gesture; 120ms after it settles, above 1.5x, the board is
   * rasterised once more at the new scale and looks sharp again.
   */
  renderScale: number;
}

/**
 * §13 — one `<Svg>` root for the whole board.
 *
 * The board is rasterised at `BASE_RESOLUTION_SCALE` and displayed at 1.0, which
 * keeps moderate zoom sharp without any re-render at all; `renderScale` raises that
 * multiplier once, after a gesture settles, for the deep end of the zoom range.
 */
function BoardBase({
  level,
  cellSize,
  arrowStates,
  renderScale,
}: Props): React.JSX.Element {
  trace('Board render body');
  const {gridSize, arrows} = level;
  const size = cellSize * gridSize;
  const tier = useMemo(() => renderTierFor(arrows.length), [arrows.length]);
  const resolution = Math.max(BASE_RESOLUTION_SCALE, renderScale);

  // Geometry depends only on the path and the cell size, neither of which changes
  // while a level is being played, so it is built once rather than per state change.
  const geometries = useMemo(
    () =>
      tier.bakedUnderlay ? arrows.map(a => buildArrowGeometry(a, cellSize)) : [],
    [tier.bakedUnderlay, arrows, cellSize],
  );

  // §13 — above 60 arrows every arrow's casing collapses into a single static
  // underlay. Ninety separately decorated paths is a node count the frame budget
  // cannot carry, and the choice of casing over glow is the point: at 14x14 the win is
  // being able to tell two adjacent lines apart, not making them bloom. Keying the
  // memo on the set of still-active arrows rather than on the whole visual-state array
  // means a shake or a blocker highlight does not rebuild the underlay.
  const activeKey = arrowStates
    .map(v => (v.state === 'active' && !v.shaking ? '1' : '0'))
    .join('');

  // Each arrow's casing is built once and thereafter handed out by reference. The
  // geometry behind it cannot change while a level is being played — only which
  // arrows are still on the board can — so expressing "one of them left" by rebuilding
  // every Path in the layer was work with no output: at 86 arrows it measured ~15ms of
  // a ~22ms re-render, on the critical path of every single tap.
  const underlayNodes = useMemo(() => {
    if (!tier.bakedUnderlay) {
      return null;
    }
    return arrows.map((arrow, i) => {
      const geometry = geometries[i];
      return (
        <React.Fragment key={arrow.id}>
          {geometry.body !== '' && (
            <Path
              d={geometry.body}
              stroke={theme.arrowInk.casing}
              strokeWidth={geometry.strokeWidth * 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          <Path
            d={geometry.head}
            fill={theme.arrowInk.casing}
            stroke={theme.arrowInk.casing}
            strokeWidth={geometry.strokeWidth * 0.7}
            strokeLinejoin="round"
          />
        </React.Fragment>
      );
    });
  }, [tier.bakedUnderlay, arrows, geometries]);

  // Which of those casings are currently on the board. This is the part that changes
  // per tap, and all it costs now is an array walk: every surviving arrow hands back
  // the identical element it gave last time, which React skips without descending.
  //
  // activeKey stands in for arrowStates on purpose: it is exactly the part of it this
  // layer depends on, so a shake or a highlight does not disturb the underlay.
  const bakedUnderlay = useMemo(
    () =>
      underlayNodes
        ? underlayNodes.map((node, i) => (activeKey[i] === '1' ? node : null))
        : null,
    [underlayNodes, activeKey],
  );

  // §13 — the board is rasterised at `resolution` and displayed at 1.0. The scaling
  // has to happen on a plain RN View: react-native-svg treats a `transform` in the
  // <Svg>'s own style as an SVG transform, so putting it there draws the board
  // oversized and scales nothing back.
  //
  // A View scales about its own centre, which would leave the content offset by
  // half the overscan. Positioning the inner view at -overscan cancels that exactly,
  // and avoids depending on `transformOrigin` reaching the Android view.
  const overscan = (size * (resolution - 1)) / 2;

  return (
    <View style={[styles.frame, {width: size, height: size}]}>
      <View
        style={[
          styles.canvas,
          {
            left: -overscan,
            top: -overscan,
            width: size * resolution,
            height: size * resolution,
            transform: [{scale: 1 / resolution}],
          },
        ]}>
        <Svg
          width={size * resolution}
          height={size * resolution}
          viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {/* §9.2 — the board is clipped so escaping paths slip under the frame. */}
            <ClipPath id="board-clip">
              <Rect x={0} y={0} width={size} height={size} />
            </ClipPath>
          </Defs>

          <G clipPath="url(#board-clip)">
            <DotGrid gridSize={gridSize} cellSize={cellSize} />
            {level.decor && <DecorLayer decor={level.decor} boardSize={size} />}

            {bakedUnderlay && <G pointerEvents="none">{bakedUnderlay}</G>}

            {arrows.map((arrow, index) => {
              const visual = arrowStates[index];
              // An arrow that is escaping or shaking is drawn by MovingArrow in its
              // own layer; leaving a copy here too would show it in both places at
              // once, one of them frozen in the cell it is supposed to be leaving.
              if (!visual || visual.state !== 'active' || visual.shaking) {
                return null;
              }
              return (
                <ArrowRenderer
                  key={arrow.id}
                  arrow={arrow}
                  index={index}
                  cellSize={cellSize}
                  tier={tier}
                  highlighted={visual.highlighted}
                  pulsing={visual.pulsing}
                />
              );
            })}
          </G>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {overflow: 'hidden'},
  canvas: {position: 'absolute'},
});

export const Board = React.memo(BoardBase);
