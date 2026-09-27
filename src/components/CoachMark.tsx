import React, {useEffect} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {FINGERTIP, GuideHand} from './GuideHand';
import type {ActiveCoachMark} from '../game/tutorial/TutorialController';

/** Where the mark sits on screen, in dp. */
export interface CoachSpotlight {
  x: number;
  y: number;
  radius: number;
  /** The board's cell size, which is what the hand is scaled against. */
  cellSize: number;
  /** The target's own box, which the hand points into and the caption hangs under. */
  bounds: {left: number; top: number; right: number; bottom: number};
}

interface Props {
  mark: ActiveCoachMark;
  /** Spotlight centre in screen dp, or null for a board-wide mark. */
  spotlight: CoachSpotlight | null;
  /** Which half of the board the caption must avoid. */
  targetInTopHalf: boolean;
  onDismiss: () => void;
  onSkip?: () => void;
}

/** §6 — 55% dim, soft radial spotlight, 900ms ghost-hand loop fading after 3 loops. */
/**
 * The veil over everything but the spotlit arrow.
 *
 * It is white now, not near-black, because the board underneath it is (§10.2). The
 * effect survives the inversion intact and is arguably cleaner: navy arrows under a
 * white veil go pale while the one in the spotlight stays full strength, which is the
 * focus the coach mark is for. A dark scrim on a white page would have been a
 * flashbang.
 *
 * A step can switch it off, and level 1 does. Three arrows on an otherwise blank page
 * have nothing to be picked out *from*: the veil there only greys out two of the
 * three things the player is being invited to tap. The reference dims nothing at all
 * on that board — it points at one arrow and captions it.
 */
const DIM = 0.74;
const VEIL = `rgba(255,255,255,${DIM})`;
const GHOST_LOOP_MS = 900;
const GHOST_LOOPS = 3;
/** The caption's nub. */
const TAIL_WIDTH = 26;
const TAIL_HEIGHT = 14;
const CAPTION_GAP = 10;
const SCREEN_MARGIN = 16;

export function CoachMark({
  mark,
  spotlight,
  targetInTopHalf,
  onDismiss,
  onSkip,
}: Props): React.JSX.Element {
  const {width} = useWindowDimensions();
  const ghost = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, {duration: 240});
    if (mark.step.gesture === 'none') {
      return;
    }
    ghost.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: GHOST_LOOP_MS / 2,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: GHOST_LOOP_MS / 2,
          easing: Easing.in(Easing.quad),
        }),
      ),
      GHOST_LOOPS * 2,
      false,
    );
  }, [mark, ghost, fade]);

  const overlay = useAnimatedStyle(() => ({opacity: fade.value}));

  const pinch = mark.step.gesture === 'pinch';
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: pinch ? 0.85 * (1 - ghost.value * 0.4) : 1,
    transform: pinch
      ? [{scale: 1 + ghost.value * 0.35}, {translateY: ghost.value * 6}]
      : // A tap, not a hover: the hand presses along its own finger and comes back.
        [
          {translateX: ghost.value * 5},
          {translateY: ghost.value * 8},
          {scale: 1 - ghost.value * 0.06},
        ],
  }));

  const veiled = spotlight !== null && mark.step.veil !== false;
  // Two cells wide: a hand indicates, it does not upstage. The clamps are for the
  // ends of the range — a 22-wide board's cell is too small to hold a legible hand,
  // and a tablet's is big enough to put a comic glove on the page.
  const handSize = spotlight
    ? Math.max(34, Math.min(64, spotlight.cellSize * 2))
    : 44;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, overlay]}
      // With no veil there is nothing left to catch a touch, and nothing should: the
      // board stays tappable, and tapping it is what dismisses the mark (§6, and
      // GameScreen.handleTap). `box-none` rather than `none` so a SKIP button still
      // takes its own touches.
      pointerEvents={veiled || !spotlight ? 'auto' : 'box-none'}>
      {/* The overlay never blocks the target's touch area (§6): the dim is drawn as
          four panels around the spotlight rather than as one sheet over everything.
          Each panel dismisses on press, because §6 also says every coach mark is
          dismissible by tapping anywhere — a dim panel that merely swallows the touch
          leaves the player poking at a screen that does not answer. */}
      {veiled && spotlight && (
        <>
          <Pressable
            onPress={onDismiss}
            style={[styles.dim, {height: spotlight.y - spotlight.radius}]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dim,
              {
                top: spotlight.y + spotlight.radius,
                height: 2000,
              },
            ]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dimSide,
              {
                top: spotlight.y - spotlight.radius,
                height: spotlight.radius * 2,
                width: Math.max(0, spotlight.x - spotlight.radius),
                left: 0,
              },
            ]}
          />
          <Pressable
            onPress={onDismiss}
            style={[
              styles.dimSide,
              {
                top: spotlight.y - spotlight.radius,
                height: spotlight.radius * 2,
                left: spotlight.x + spotlight.radius,
                right: 0,
              },
            ]}
          />
          <View
            style={[
              styles.halo,
              {
                left: spotlight.x - spotlight.radius,
                top: spotlight.y - spotlight.radius,
                width: spotlight.radius * 2,
                height: spotlight.radius * 2,
                borderRadius: spotlight.radius,
              },
            ]}
            pointerEvents="none"
          />
        </>
      )}

      {!spotlight && (
        <Pressable style={[styles.dim, styles.full]} onPress={onDismiss} />
      )}

      {/* The hand rests its fingertip on the middle of the target and lies below and
          to the right of it, which is the one quadrant it covers nothing from. */}
      {spotlight && mark.step.gesture !== 'none' && (
        <Animated.View
          style={[
            styles.ghost,
            pinch
              ? {left: spotlight.x - 18, top: spotlight.y - 12}
              : {
                  left:
                    (spotlight.bounds.left + spotlight.bounds.right) / 2 -
                    handSize * FINGERTIP.x,
                  top:
                    (spotlight.bounds.top + spotlight.bounds.bottom) / 2 -
                    handSize * FINGERTIP.y,
                },
            ghostStyle,
          ]}
          pointerEvents="none">
          {pinch ? (
            <Text style={styles.ghostGlyph}>👌</Text>
          ) : (
            <GuideHand size={handSize} />
          )}
        </Animated.View>
      )}

      {mark.step.caption !== '' &&
        (spotlight ? (
          // Anchored: the caption hangs under the target with a nub pointing back at
          // it, so there is never a doubt about what is being explained.
          <View
            style={[
              styles.anchoredSlot,
              {
                top: spotlight.bounds.bottom + CAPTION_GAP,
                left: SCREEN_MARGIN,
                right: SCREEN_MARGIN,
              },
            ]}
            pointerEvents="none">
            <View
              style={[
                styles.anchoredInner,
                {
                  transform: [
                    {
                      translateX: nudgeIntoScreen(
                        (spotlight.bounds.left + spotlight.bounds.right) / 2,
                        width,
                      ),
                    },
                  ],
                },
              ]}>
              <View style={styles.tail} />
              <View style={styles.caption}>
                <Text style={styles.captionText}>{mark.step.caption}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            style={[
              styles.captionSlot,
              targetInTopHalf ? styles.lower : styles.upper,
            ]}
            onPress={onDismiss}>
            <View style={styles.caption}>
              <Text style={styles.captionText}>{mark.step.caption}</Text>
            </View>
          </Pressable>
        ))}

      {onSkip && (
        <Pressable
          style={styles.skip}
          onPress={onSkip}
          accessibilityRole="button">
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

/**
 * How far the caption may slide off centre to follow its target. The bubble is laid
 * out centred on the screen and shifted from there, so an arrow near the edge keeps
 * its nub without pushing the text off the page — the shift stops where the bubble
 * would reach the margin.
 */
function nudgeIntoScreen(targetCentre: number, screenWidth: number): number {
  const limit = Math.max(0, screenWidth / 2 - SCREEN_MARGIN * 2);
  const offset = targetCentre - screenWidth / 2;
  return Math.max(-limit, Math.min(limit, offset));
}

const styles = StyleSheet.create({
  root: {zIndex: 30},
  full: {...StyleSheet.absoluteFillObject},
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: VEIL,
  },
  dimSide: {position: 'absolute', backgroundColor: VEIL},
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(47,155,255,0.55)',
  },
  ghost: {position: 'absolute'},
  ghostGlyph: {fontSize: 34},
  captionSlot: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  anchoredSlot: {position: 'absolute', alignItems: 'center'},
  anchoredInner: {alignItems: 'center'},
  upper: {top: '18%'},
  lower: {bottom: '18%'},
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_WIDTH / 2,
    borderRightWidth: TAIL_WIDTH / 2,
    borderBottomWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.board.chrome,
    // Overlapped by a dp so the nub and the bubble never show a seam between them.
    marginBottom: -1,
  },
  caption: {
    backgroundColor: theme.board.chrome,
    borderRadius: theme.radius.panel,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  captionText: {...typography.ui(18), textAlign: 'center', color: '#FFFFFF'},
  skip: {
    position: 'absolute',
    right: theme.space.md,
    bottom: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  skipText: {
    ...typography.body(13),
    color: theme.board.chipText,
    letterSpacing: 1.5,
  },
});
