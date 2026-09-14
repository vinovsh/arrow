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
  MAX_SCALE,
  MIN_SCALE,
  PAN_OVERSHOOT_DP,
  TAP_MAX_MS,
  TAP_SLOP_DP,
  clampPan,
} from '../../utils/layout';
// TEMPORARY — tap-latency instrumentation, see src/utils/tapTrace.ts.
import {traceTap} from '../../utils/tapTrace';

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
 * §5.5 — pinch, pan, tap and fit.
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
  // TEMPORARY — when the finger touched down and when it left the glass, so the
  // wait between the lift and this gesture being allowed to activate is visible.
  const touchDownAt = useSharedValue(0);
  const touchUpAt = useSharedValue(0);

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

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(TAP_MAX_MS)
    .maxDistance(TAP_SLOP_DP)
    // TEMPORARY — instrumentation only; touch callbacks do not affect arbitration.
    .onTouchesDown(() => {
      'worklet';
      touchDownAt.value = Date.now();
    })
    .onTouchesUp(() => {
      'worklet';
      touchUpAt.value = Date.now();
    })
    .onEnd((event, success) => {
      'worklet';
      if (!success) {
        return;
      }
      // TEMPORARY — tap-latency instrumentation.
      runOnJS(traceTap)(touchDownAt.value, touchUpAt.value, Date.now());
      // Undo the container transform to land in board dp. The board is centred in the
      // viewport and scaled about that centre (§5.5).
      const centreX = viewportWidth / 2 + translateX.value;
      const centreY = viewportHeight / 2 + translateY.value;
      const boardX = (event.x - centreX) / scale.value + boardSize / 2;
      const boardY = (event.y - centreY) / scale.value + boardSize / 2;
      runOnJS(onTap)(boardX, boardY, scale.value);
    });

  // §5.5 — pinch and pan compose simultaneously so zooming and panning can overlap,
  // and the board tap runs beside them rather than behind anything.
  //
  // Nothing here is Exclusive any more, and that is the whole point. Exclusive is
  // implemented as requireToFail, so the board tap could not activate until a
  // double-tap handler had *failed* — and a tap handler still hoping for a second tap
  // does not fail until its maxDelay elapses, which RNGH leaves at 200ms on Android.
  // Every tap on an arrow therefore spent a fifth of a second doing nothing before
  // the engine was so much as asked about it, against roughly 0.07ms of actual work
  // once it was. A single tap cannot be told apart from the first half of a double
  // tap until that window shuts, so the only way to answer the tap at once is to stop
  // asking the question. Zoom keeps pinch and the Fit button above the board.
  const gesture = Gesture.Simultaneous(pinch, pan, singleTap);

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
