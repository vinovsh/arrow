import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import type {GameEngine} from '../game/engine/GameEngine';
import {validate} from '../game/engine/LevelValidator';
import {TOTAL_LEVELS} from '../game/levels';

interface Props {
  engine: GameEngine;
  scale: number;
  onJump: (levelId: number) => void;
  onRestart: () => void;
  onRevealSolution: (order: number[]) => void;
  onClose: () => void;
}

/**
 * §8.7 — developer mode. Reached by seven taps on the version string in About, and
 * only in a debug build: `GameScreen` gates the whole component behind `__DEV__`, so
 * it is stripped from release and is never reachable by a normal user.
 */
export function DevOverlay({
  engine,
  scale,
  onJump,
  onRestart,
  onRevealSolution,
  onClose,
}: Props): React.JSX.Element {
  const [jumpTo, setJumpTo] = useState(String(engine.level.id));
  const [fps, setFps] = useState(0);
  const [revalidated, setRevalidated] = useState<string | null>(null);

  // A frame counter on the JS thread, which is the one §13's budget worries about:
  // the UI thread can hold 60fps while JS is starved and the game still feels wrong.
  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const tick = (): void => {
      frames++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  const analysis = useMemo(() => validate(engine.level), [engine.level]);

  const freeTrace = analysis.freeCounts.join(' ');
  const blockers = engine.detector
    .activeIndices()
    .map(i => {
      const blocker = engine.detector.firstBlocker(i);
      return blocker >= 0 ? `${i}<-${blocker}` : `${i}:free`;
    })
    .join('  ');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>DEV</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <Row
          label="level"
          value={`${engine.level.id} · ${engine.level.theme} · ${engine.level.band}`}
        />
        <Row
          label="grid"
          value={`${engine.level.gridSize}x${engine.level.gridSize}`}
        />
        <Row
          label="arrows"
          value={`${engine.activeCount} active / ${engine.level.arrows.length}`}
        />
        <Row label="D (stored)" value={engine.level.difficulty.toFixed(2)} />
        <Row label="D (recomputed)" value={analysis.difficulty.toFixed(2)} />
        <Row label="par" value={`${engine.level.parTime}s`} />
        <Row label="elapsed" value={`${engine.elapsedSeconds.toFixed(1)}s`} />
        <Row label="blocked taps" value={String(engine.blockedTaps)} />
        <Row label="hints used" value={String(engine.hintsUsed)} />
        <Row
          label="hearts"
          value={`${engine.hearts} (lives ${
            engine.livesEnabled ? 'on' : 'off'
          })`}
        />
        <Row label="zoom" value={`${scale.toFixed(2)}x`} />
        <Row label="JS fps" value={String(fps)} />

        {analysis.signals && (
          <>
            <Text style={styles.section}>signals (§7.1)</Text>
            <Row label="depth" value={String(analysis.signals.depth)} />
            <Row
              label="freeMin"
              value={analysis.signals.freeMinCount.toFixed(1)}
            />
            <Row
              label="freeAvg"
              value={analysis.signals.freeAvgCount.toFixed(2)}
            />
            <Row
              label="blockedStart"
              value={analysis.signals.blockedStart.toFixed(2)}
            />
            <Row label="turns" value={analysis.signals.turns.toFixed(2)} />
            <Row
              label="occupancy"
              value={analysis.signals.occupancy.toFixed(2)}
            />
            <Row label="spanAvg" value={analysis.signals.spanAvg.toFixed(2)} />
          </>
        )}

        <Text style={styles.section}>free-count trace</Text>
        <Text style={styles.mono}>{freeTrace}</Text>

        <Text style={styles.section}>
          dependency graph (arrow &lt;- blocker)
        </Text>
        <Text style={styles.mono}>{blockers}</Text>

        <Text style={styles.section}>actions</Text>
        <View style={styles.actions}>
          <Action
            label="reveal solution"
            onPress={() =>
              onRevealSolution(
                analysis.order.map(id =>
                  engine.level.arrows.findIndex(a => a.id === id),
                ),
              )
            }
          />
          <Action label="reload level" onPress={onRestart} />
          <Action
            label="re-validate"
            onPress={() => {
              const again = validate(engine.level);
              setRevalidated(
                again.solvable
                  ? `solvable · D ${again.difficulty.toFixed(2)} · ${
                      again.errors.length
                    } errors`
                  : 'UNSOLVABLE',
              );
            }}
          />
        </View>
        {revalidated && <Text style={styles.mono}>{revalidated}</Text>}

        <Text style={styles.section}>jump</Text>
        <View style={styles.jumpRow}>
          <TextInput
            style={styles.input}
            value={jumpTo}
            onChangeText={setJumpTo}
            keyboardType="number-pad"
            placeholder="level"
            placeholderTextColor={theme.text.dim}
          />
          <Action
            label="go"
            onPress={() => {
              const id = Number(jumpTo);
              if (Number.isInteger(id) && id >= 1 && id <= TOTAL_LEVELS) {
                onJump(id);
              }
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,5,12,0.94)',
    zIndex: 60,
  },
  body: {padding: theme.space.md, gap: 2},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space.sm,
  },
  title: {...typography.display(16), letterSpacing: 3},
  close: {fontSize: 20, color: theme.text.secondary, padding: theme.space.sm},
  section: {
    ...typography.ui(12),
    color: theme.state.currentLevel,
    letterSpacing: 1.5,
    marginTop: theme.space.md,
    marginBottom: 4,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between'},
  rowLabel: {...typography.body(12), color: theme.text.dim},
  rowValue: {...typography.body(12), color: theme.text.primary},
  mono: {
    ...typography.body(11),
    color: theme.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm},
  action: {
    backgroundColor: theme.bg.panelAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.bg.border,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  actionLabel: {...typography.body(12), color: theme.text.primary},
  jumpRow: {flexDirection: 'row', alignItems: 'center', gap: theme.space.sm},
  input: {
    flex: 1,
    backgroundColor: theme.bg.panelAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.bg.border,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.text.primary,
  },
});
