import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  CRISP_RERENDER_DEBOUNCE_MS,
  CRISP_RERENDER_SCALE,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  PAN_OVERSHOOT_DP,
  TAP_MAX_MS,
  TAP_SLOP_DP,
  clampPan,
} from '../../utils/layout';

export interface ViewportHandle {
  /** Springs back to fit and re-centres (§5.5, and on level complete §9.4). */
  reset: () => void;
  /**
   * §3.4 — a hint on a 40+ arrow board first brings its target on-screen. Board
   * coordinates in dp; the viewport centres them at at least `scale`.
   */
  focusOn: (boardX: number, boardY: number, scale: number) => void;
  /** Current scale, for callers that need it off the UI thread. */
  currentScale: () => number;
}

interface Props {
  boardSize: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Board-space tap in dp, already corrected for scale and pan. */
  onTap: (boardX: number, boardY: number, scale: number) => void;
  /** §5.5 — zoom is locked during the win sequence and behind modals. */
  locked?: boolean;
  onScaleSettled?: (scale: number) => void;
  children: React.ReactNode;
}

const SPRING = {damping: 20, stiffness: 180, mass: 0.6} as const;

/**
 * §5.5 — pinch, pan, two-finger-tap zoom and fit.
 *
 * The load-bearing detail is that **the container view transforms, not the SVG**.
 * Reanimated drives `scale`/`translateX`/`translateY` as shared values on this
 * wrapper, so no SVG work happens during a gesture and 60fps is reachable even at 90
 * arrows. Android magnifies the rasterised layer, which goes soft past roughly 1.5x,
 * so once the gesture settles the board re-rasterises exactly once (§13).
 */
function BoardViewportBase(
  {
    boardSize,
    viewportWidth,
    viewportHeight,
    onTap,
    locked = false,
    onScaleSettled,
    children,
  }: Props,
  ref: React.Ref<ViewportHandle>,
): React.JSX.Element {
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteScale = useCallback(
    (value: number) => {
      setZoomed(value > 1.01);
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
      }
      // §5.5 — one re-render, debounced, never during motion, and only above 1.5x.
      settleTimer.current = setTimeout(() => {
        onScaleSettled?.(value > CRISP_RERENDER_SCALE ? value : 1);
      }, CRISP_RERENDER_DEBOUNCE_MS);
    },
    [onScaleSettled],
  );

  useEffect(
    () => () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
      }
    },
    [],
  );

  const springTo = useCallback(
    (nextScale: number, nextX: number, nextY: number) => {
      'worklet';
      scale.value = withSpring(nextScale, SPRING);
      translateX.value = withSpring(
        clampPan(nextX, boardSize, viewportWidth, nextScale),
        SPRING,
      );
      translateY.value = withSpring(
        clampPan(nextY, boardSize, viewportHeight, nextScale),
        SPRING,
      );
      savedScale.value = nextScale;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      runOnJS(noteScale)(nextScale);
    },
    [
      boardSize,
      viewportWidth,
      viewportHeight,
      scale,
      translateX,
      translateY,
      savedScale,
      savedX,
      savedY,
      noteScale,
    ],
  );

  const resetViewport = useCallback(() => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = withSpring(MIN_SCALE, SPRING);
    translateX.value = withSpring(0, SPRING);
    translateY.value = withSpring(0, SPRING);
    savedScale.value = MIN_SCALE;
    savedX.value = 0;
    savedY.value = 0;
    noteScale(MIN_SCALE);
  }, [scale, translateX, translateY, savedScale, savedX, savedY, noteScale]);

  useImperativeHandle(
    ref,
    () => ({
      reset: resetViewport,
      focusOn: (boardX: number, boardY: number, target: number) => {
        const next = Math.min(MAX_SCALE, Math.max(scale.value, target));
        // Move the requested board point to the centre of the viewport.
        const offsetX = (boardSize / 2 - boardX) * next;
        const offsetY = (boardSize / 2 - boardY) * next;
        scale.value = withSpring(next, SPRING);
        translateX.value = withSpring(
          clampPan(offsetX, boardSize, viewportWidth, next),
          SPRING,
        );
        translateY.value = withSpring(
          clampPan(offsetY, boardSize, viewportHeight, next),
          SPRING,
        );
        savedScale.value = next;
        savedX.value = offsetX;
        savedY.value = offsetY;
        noteScale(next);
      },
      currentScale: () => scale.value,
    }),
    [
      resetViewport,
      boardSize,
      viewportWidth,
      viewportHeight,
      scale,
      translateX,
      translateY,
      savedScale,
      savedX,
      savedY,
      noteScale,
    ],
  );

  const pinch = Gesture.Pinch()
    .enabled(!locked)
    .onUpdate(event => {
      'worklet';
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * event.scale),
      );
      // Scale about the pinch focal point rather than the view centre, so the board
      // grows out from under the fingers instead of sliding away from them.
      const focalX = event.focalX - viewportWidth / 2;
      const focalY = event.focalY - viewportHeight / 2;
      const ratio = next / savedScale.value;
      scale.value = next;
      translateX.value = clampPan(
        focalX + (savedX.value - focalX) * ratio,
        boardSize,
        viewportWidth,
        next,
        PAN_OVERSHOOT_DP,
      );
      translateY.value = clampPan(
        focalY + (savedY.value - focalY) * ratio,
        boardSize,
        viewportHeight,
        next,
        PAN_OVERSHOOT_DP,
      );
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      translateX.value = withSpring(
        clampPan(translateX.value, boardSize, viewportWidth, scale.value),
        SPRING,
      );
      translateY.value = withSpring(
        clampPan(translateY.value, boardSize, viewportHeight, scale.value),
        SPRING,
      );
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      runOnJS(noteScale)(scale.value);
    });

  const pan = Gesture.Pan()
    .enabled(!locked)
    .averageTouches(true)
    // §5.5 — at fit the whole board is visible, so a one-finger drag is a no-op and
    // must not steal the tap.
    .minPointers(1)
    .onUpdate(event => {
      'worklet';
      if (scale.value <= MIN_SCALE + 0.001) {
        return;
      }
      translateX.value = clampPan(
        savedX.value + event.translationX,
        boardSize,
        viewportWidth,
        scale.value,
        PAN_OVERSHOOT_DP,
      );
      translateY.value = clampPan(
        savedY.value + event.translationY,
        boardSize,
        viewportHeight,
        scale.value,
        PAN_OVERSHOOT_DP,
      );
    })
    .onEnd(() => {
      'worklet';
      // Rubber-band overshoot springs back so an edge never rests inside the viewport.
      translateX.value = withSpring(
        clampPan(translateX.value, boardSize, viewportWidth, scale.value),
        SPRING,
      );
      translateY.value = withSpring(
        clampPan(translateY.value, boardSize, viewportHeight, scale.value),
        SPRING,
      );
      savedX.value = clampPan(
        translateX.value,
        boardSize,
        viewportWidth,
        scale.value,
      );
      savedY.value = clampPan(
        translateY.value,
        boardSize,
        viewportHeight,
        scale.value,
      );
    });

  // §5.5 — the zoom toggle is a two-finger tap, not a double tap, and that is the
  // whole point. A double tap cannot be ruled out until the window for the second tap
  // closes, so Exclusive(doubleTap, tap) sat on every board tap for RNGH's maxDelay —
  // 200ms of nothing between the finger lifting and the arrow so much as twitching,
  // long enough to read as the game having ignored the tap and only then relented.
  // Tapping an arrow *is* the game and has to answer as the finger comes up, so the
  // gesture it was competing with moved to one that cannot be confused with a tap at
  // all. Zoom keeps pinch, this, and the Fit button; only the double tap is gone.
  const zoomToggle = Gesture.Tap()
    .enabled(!locked)
    .numberOfTaps(1)
    .minPointers(2)
    .maxDuration(TAP_MAX_MS)
    // The board tap still has to wait for this one to fail — a two-finger tap ends
    // with the same ACTION_UP a one-finger tap does, so without the wait, zooming
    // would also play a move. maxDelay is what that wait costs, and RNGH's 200ms
    // default is the whole bug in miniature; at 0 the handler gives up on the next
    // run of the main loop instead, which is too short to see.
    .maxDelay(0)
    .onEnd((event, success) => {
      'worklet';
      if (!success) {
        return;
      }
      if (scale.value > MIN_SCALE + 0.01) {
        springTo(MIN_SCALE, 0, 0);
        return;
      }
      // Zoom toward the tapped point, not the centre. With two pointers down the
      // event carries their centroid, which is the point between the fingers.
      const focalX = event.x - viewportWidth / 2;
      const focalY = event.y - viewportHeight / 2;
      springTo(
        DOUBLE_TAP_SCALE,
        -focalX * (DOUBLE_TAP_SCALE - 1),
        -focalY * (DOUBLE_TAP_SCALE - 1),
      );
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(TAP_MAX_MS)
    .maxDistance(TAP_SLOP_DP)
    .onEnd((event, success) => {
      'worklet';
      if (!success) {
        return;
      }
      // Undo the container transform to land in board dp. The board is centred in the
      // viewport and scaled about that centre (§5.5).
      const centreX = viewportWidth / 2 + translateX.value;
      const centreY = viewportHeight / 2 + translateY.value;
      const boardX = (event.x - centreX) / scale.value + boardSize / 2;
      const boardY = (event.y - centreY) / scale.value + boardSize / 2;
      runOnJS(onTap)(boardX, boardY, scale.value);
    });

  // §5.5 — pinch and pan run alongside everything, since zooming and panning overlap
  // and neither can be mistaken for a tap that does not travel. The board tap is the
  // only gesture that defers to another, and only to the zoom toggle, which gives up
  // within a main-loop tick when a second finger never arrives.
  const gesture = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(zoomToggle, singleTap),
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
      {scale: scale.value},
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.viewport,
          {width: viewportWidth, height: viewportHeight},
        ]}
        collapsable={false}>
        <Animated.View style={[styles.board, style]}>{children}</Animated.View>
        {zoomed ? <FitAffordance /> : null}
      </View>
    </GestureDetector>
  );
}

/**
 * React 18 does not pass `ref` through as an ordinary prop, so the imperative handle
 * the game screen needs — reset, focusOn, currentScale — has to come through
 * forwardRef rather than off the props object.
 */
export const BoardViewport = forwardRef(BoardViewportBase);

/**
 * The fit button itself lives in GameScreen's chrome, above the board; this is only
 * the hairline that tells the player the board is currently magnified.
 */
function FitAffordance(): React.JSX.Element {
  return <View style={styles.zoomEdge} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // overflow visible so an escaping arrow stays drawn past the board edge; the
  // viewport above still clips it at the screen.
  board: {alignItems: 'center', justifyContent: 'center', overflow: 'visible'},
  zoomEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
});
