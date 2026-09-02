import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import {theme} from '../../theme/theme';
import type {ArrowColor} from '../models/types';

/**
 * §13 — one pooled layer, max 80 sprites, recycled, driven by a single
 * `useFrameCallback` worklet. Nothing here mounts or unmounts per particle: every
 * sprite is a View that exists for the life of the board and is simply moved
 * off-screen and made transparent when its life runs out.
 */
export const MAX_PARTICLES = 80;
const PARTICLE_LIFE_MS = 400;
/** §9.4 — the completion burst is capped separately and is the densest moment. */
export const BURST_MAX = 60;

export interface ParticleHandle {
  /** §9.2 — trail from an escaping arrow's head. */
  trail: (
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: ArrowColor,
    count: number,
  ) => void;
  /** §9.4 — radial burst from the board centre on completion. */
  burst: (x: number, y: number, count: number) => void;
  clear: () => void;
}

interface Props {
  size: number;
}

interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  colour: string;
}

const emptyParticle = (): ParticleState => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  size: 4,
  colour: theme.arrow.white,
});

/**
 * Sprite views read their own slot out of one shared array. The array is a plain
 * object on the UI thread, mutated by the frame worklet, so a full particle field
 * costs one worklet per frame rather than eighty animated styles fighting each other.
 */
function Sprite({
  particles,
  index,
}: {
  particles: {value: ParticleState[]};
  index: number;
}): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const p = particles.value[index];
    const t = p.life / PARTICLE_LIFE_MS;
    return {
      opacity: t <= 0 ? 0 : t,
      width: p.size,
      height: p.size,
      borderRadius: p.size / 2,
      backgroundColor: p.colour,
      transform: [{translateX: p.x}, {translateY: p.y}, {scale: 0.6 + t * 0.6}],
    };
  });
  return <Animated.View style={[styles.sprite, style]} pointerEvents="none" />;
}

function ParticleSystemBase(
  {size}: Props,
  ref: React.Ref<ParticleHandle>,
): React.JSX.Element {
  const particles = useSharedValue<ParticleState[]>(
    Array.from({length: MAX_PARTICLES}, emptyParticle),
  );
  const cursor = useRef(0);
  const lastFrame = useSharedValue(0);

  useFrameCallback(frame => {
    'worklet';
    const now = frame.timeSinceFirstFrame;
    const dt = lastFrame.value === 0 ? 16 : Math.min(48, now - lastFrame.value);
    lastFrame.value = now;
    const next = particles.value;
    let alive = false;
    for (let i = 0; i < next.length; i++) {
      const p = next[i];
      if (p.life <= 0) {
        continue;
      }
      alive = true;
      p.life -= dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      // A touch of drag so trails feather out instead of shooting off in straight
      // lines; additive blending is approximated by the fade alone.
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    if (alive) {
      particles.value = [...next];
    }
  }, true);

  const spawn = useCallback(
    (state: ParticleState) => {
      const slot = cursor.current % MAX_PARTICLES;
      cursor.current = slot + 1;
      const next = particles.value;
      next[slot] = state;
      particles.value = [...next];
    },
    [particles],
  );

  useImperativeHandle(
    ref,
    () => ({
      trail: (x, y, dx, dy, color, count) => {
        const colour = theme.arrow[color];
        for (let i = 0; i < count; i++) {
          const spread = (Math.random() - 0.5) * 90;
          const speed = 60 + Math.random() * 110;
          spawn({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: -dx * speed + -dy * spread,
            vy: -dy * speed + -dx * spread,
            life: PARTICLE_LIFE_MS,
            size: 3 + Math.random() * 4,
            colour,
          });
        }
      },
      burst: (x, y, count) => {
        const palette = Object.values(theme.arrow);
        for (let i = 0; i < Math.min(count, BURST_MAX); i++) {
          const angle = (i / Math.min(count, BURST_MAX)) * Math.PI * 2;
          const speed = 140 + Math.random() * 180;
          spawn({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: PARTICLE_LIFE_MS * 2,
            size: 4 + Math.random() * 5,
            colour: palette[i % palette.length],
          });
        }
      },
      clear: () => {
        particles.value = Array.from({length: MAX_PARTICLES}, emptyParticle);
      },
    }),
    [particles, spawn],
  );

  const sprites = useMemo(
    () =>
      Array.from({length: MAX_PARTICLES}, (_, i) => (
        <Sprite key={i} particles={particles} index={i} />
      )),
    [particles],
  );

  return (
    <View
      style={[styles.layer, {width: size, height: size}]}
      pointerEvents="none">
      {sprites}
    </View>
  );
}

/**
 * React 18 does not pass `ref` through as an ordinary prop; the trail and burst
 * methods the game screen fires on a tap have to come through forwardRef.
 */
export const ParticleSystem = forwardRef(ParticleSystemBase);

const styles = StyleSheet.create({
  layer: {position: 'absolute', left: 0, top: 0},
  sprite: {position: 'absolute', left: 0, top: 0},
});
