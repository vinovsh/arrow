import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../navigation/types';
import {theme} from '../theme/theme';
import {type as typography} from '../theme/typography';
import {Hearts} from '../components/Hearts';
import {HintPill} from '../components/HintPill';
import {FitButton} from '../components/FitButton';
import {CoachMark} from '../components/CoachMark';
import {DevOverlay} from '../components/DevOverlay';
import {HintModal} from '../components/HintModal';
import {PauseOverlay} from '../components/PauseOverlay';
import {OutOfLivesOverlay} from '../components/OutOfLivesOverlay';
import {LevelCompleteOverlay} from '../components/LevelCompleteOverlay';
import {ScoreSummaryOverlay} from '../components/ScoreSummaryOverlay';
import {Board} from '../game/renderer/Board';
import {EscapingArrow} from '../game/renderer/EscapingArrow';
import {ShakingArrow} from '../game/renderer/ShakingArrow';
import {BoardViewport} from '../game/renderer/BoardViewport';
import type {ViewportHandle} from '../game/renderer/BoardViewport';
import {ParticleSystem} from '../game/renderer/ParticleSystem';
import type {ParticleHandle} from '../game/renderer/ParticleSystem';
import type {ArrowVisualState} from '../game/renderer/ArrowRenderer';
import {buildArrowGeometry} from '../game/renderer/arrowGeometry';
import {GameEngine, MAX_HEARTS} from '../game/engine/GameEngine';
import {
  HINT_AUTOFOCUS_ARROWS,
  HINT_FOCUS_SCALE,
  HintService,
} from '../game/engine/HintService';
import {computeScore} from '../game/engine/ScoreManager';
import type {ScoreBreakdown} from '../game/engine/ScoreManager';
import {TutorialController} from '../game/tutorial/TutorialController';
import type {ActiveCoachMark} from '../game/tutorial/TutorialController';
import {getLevel, preloadAround, TOTAL_LEVELS} from '../game/levels';
import {computeBoardMetrics} from '../utils/layout';
import {renderTierFor, FEATURES} from '../app/featureFlags';
import {SaveStore} from '../storage/SaveStore';
import {Audio} from '../audio/AudioService';
import {Haptics} from '../haptics/HapticService';
import {Ads} from '../ads/AdService';
// TEMPORARY — tap-latency instrumentation, see src/utils/tapTrace.ts.
import {trace} from '../utils/tapTrace';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

/** §5.4 — 56dp header, 72dp footer, and the board takes what is left. */
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 72;
/** §9.3 — the blocker outline holds for 300ms. */
const BLOCKER_HIGHLIGHT_MS = 300;
/** §3.3 — the silent assist pulses one valid arrow for 1.2s at 60% strength. */
const ASSIST_PULSE_MS = 1200;
/** §3.3 — if still stuck 30s after the assist, the HINT pill pulses once. */
const ASSIST_ESCALATE_MS = 30000;
const IDLE_POLL_MS = 1000;

const freshVisual = (): ArrowVisualState => ({
  state: 'active',
  shaking: false,
  highlighted: false,
  pulsing: false,
});

export function GameScreen({route, navigation}: Props): React.JSX.Element {
  trace('GameScreen render body');
  const {levelId} = route.params;
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const level = useMemo(() => getLevel(levelId), [levelId]);

  // §12 — game state lives in a plain GameEngine held in a ref, never in React state.
  const engineRef = useRef<GameEngine | null>(null);
  const hintsRef = useRef(new HintService());
  const tutorialRef = useRef<TutorialController | null>(null);
  const viewportRef = useRef<ViewportHandle>(null);
  const particlesRef = useRef<ParticleHandle>(null);

  if (
    level &&
    (!engineRef.current || engineRef.current.level.id !== level.id)
  ) {
    engineRef.current = new GameEngine(level);
    hintsRef.current = new HintService();
    tutorialRef.current = new TutorialController(engineRef.current);
  }
  const engine = engineRef.current;

  const [visuals, setVisuals] = useState<ArrowVisualState[]>(() =>
    (level?.arrows ?? []).map(freshVisual),
  );
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [heartsVisible, setHeartsVisible] = useState(false);
  const [hintsRemaining, setHintsRemaining] = useState(
    hintsRef.current.remaining,
  );
  const [renderScale, setRenderScale] = useState(1);
  const [zoomed, setZoomed] = useState(false);

  const [paused, setPaused] = useState(false);
  const [hintModal, setHintModal] = useState(false);
  const [outOfLives, setOutOfLives] = useState(false);
  const [complete, setComplete] = useState<ScoreBreakdown | null>(null);
  const [newHighScore, setNewHighScore] = useState(false);
  const [summary, setSummary] = useState(false);
  const [coachMark, setCoachMark] = useState<ActiveCoachMark | null>(null);
  const [hintPillPulsing, setHintPillPulsing] = useState(false);
  const [offscreenBlocker, setOffscreenBlocker] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [liveScale, setLiveScale] = useState(1);

  const assistUsed = useRef(false);
  const assistEscalated = useRef(false);
  const firstBlockSeen = useRef(false);

  const availableHeight =
    height - insets.top - insets.bottom - HEADER_HEIGHT - FOOTER_HEIGHT;
  const metrics = useMemo(
    () => computeBoardMetrics(width, availableHeight, level?.gridSize ?? 8),
    [width, availableHeight, level?.gridSize],
  );
  const tier = useMemo(
    () => renderTierFor(level?.arrows.length ?? 0),
    [level?.arrows.length],
  );

  /**
   * §9.2 — how far past the board edge an escaping arrow has to travel before the
   * viewport stops drawing it, per direction.
   *
   * `BoardViewport` clips, and the board is centred inside it, so the gap between the
   * board edge and that clip is exactly the centring offset. On a width-fitted board
   * that is a few dp at the sides but around 90dp top and bottom — an arrow retired
   * at the board edge is retired in plain sight. Measured at scale 1 on purpose:
   * zooming in pushes the board edge off-screen, which only makes an arrow leave
   * sooner, so the unzoomed board is the case that has to be right.
   */
  const clearance = useMemo(
    () => ({
      L: metrics.originX,
      R: metrics.originX,
      U: metrics.originY,
      D: metrics.originY,
    }),
    [metrics.originX, metrics.originY],
  );

  const patchVisual = useCallback(
    (index: number, patch: Partial<ArrowVisualState>) => {
      setVisuals(previous => {
        const next = [...previous];
        next[index] = {...next[index], ...patch};
        return next;
      });
    },
    [],
  );

  // ------------------------------------------------------------------ lifecycle

  useEffect(() => {
    if (!level || !engine) {
      return;
    }
    preloadAround(level.id);
    setVisuals(level.arrows.map(freshVisual));
    setHearts(engine.hearts);
    // §5.4 — hearts fade in only after the first blocked tap on levels 1-25, and do
    // not exist at all below the lives threshold (§3.2).
    setHeartsVisible(engine.livesEnabled);
    setHintsRemaining(hintsRef.current.remaining);
    assistUsed.current = false;
    assistEscalated.current = false;
    firstBlockSeen.current = false;
    // §5.5 — zoom resets to fit on every level change and is not persisted.
    viewportRef.current?.reset();
    setCoachMark(tutorialRef.current?.onLevelStart() ?? null);
  }, [level, engine]);

  // §3.3 — struggle detection. Polled rather than driven by taps, because two of its
  // three triggers are about time passing with nothing happening.
  useEffect(() => {
    if (!engine || complete || paused) {
      return;
    }
    const timer = setInterval(() => {
      if (assistUsed.current) {
        if (
          !assistEscalated.current &&
          engine.secondsSinceLastMove * 1000 > ASSIST_ESCALATE_MS
        ) {
          assistEscalated.current = true;
          setHintPillPulsing(true);
          setTimeout(() => setHintPillPulsing(false), 1400);
        }
        return;
      }
      const threshold = tutorialRef.current?.assistAfterSeconds() ?? 25;
      const stuck =
        engine.consecutiveBlockedTaps >= 4 ||
        engine.secondsSinceLastMove >= threshold ||
        engine.elapsedSeconds > 2.5 * engine.level.parTime;
      if (!stuck) {
        return;
      }
      const suggestion = hintsRef.current.suggest(engine.detector);
      if (suggestion < 0) {
        return;
      }
      // No modal, no text, no sound, no score penalty (§3.3).
      assistUsed.current = true;
      patchVisual(suggestion, {pulsing: true});
      setTimeout(
        () => patchVisual(suggestion, {pulsing: false}),
        ASSIST_PULSE_MS,
      );
    }, IDLE_POLL_MS);
    return () => clearInterval(timer);
  }, [engine, complete, paused, patchVisual]);

  // ------------------------------------------------------------------ tap

  const finishLevel = useCallback(() => {
    if (!engine) {
      return;
    }
    const breakdown = computeScore({
      n: engine.level.arrows.length,
      blockedTaps: engine.blockedTaps,
      hintsUsed: engine.hintsUsed,
      elapsedSeconds: engine.elapsedSeconds,
      parTime: engine.level.parTime,
    });
    const isHigh = SaveStore.isNewHighScore(engine.level.id, breakdown.total);
    SaveStore.recordCompletion(
      engine.level.id,
      breakdown.stars,
      breakdown.total,
    );
    // §15 — always flushed on level complete, never left to the debounce.
    void SaveStore.flush();

    setNewHighScore(isHigh);
    setComplete(breakdown);
    setCoachMark(tutorialRef.current?.onWin() ?? null);

    // §9.4 — the viewport springs back to fit as the final arrow exits.
    viewportRef.current?.reset();
    particlesRef.current?.burst(metrics.size / 2, metrics.size / 2, 60);
  }, [engine, metrics.size]);

  // Only once the arrow is fully clear of the board does it stop being drawn at all,
  // and only then does an emptied board count as a win — so the completion sequence
  // never fires over an arrow still in flight.
  const onEscapeComplete = useCallback(
    (index: number) => {
      patchVisual(index, {state: 'escaped'});
      if (engine && engine.activeCount === 0) {
        finishLevel();
      }
    },
    [engine, patchVisual, finishLevel],
  );

  const onShakeComplete = useCallback(
    (index: number) => {
      patchVisual(index, {shaking: false});
    },
    [patchVisual],
  );

  const handleTap = useCallback(
    (boardX: number, boardY: number, scale: number) => {
      // Stamped first, before anything else in this handler can cost time. This is
      // the instant the player means by "when I tap", and the flight is measured
      // from it.
      const tappedAt = Date.now();
      trace('handleTap entered');
      if (!engine || complete || paused) {
        return;
      }
      if (coachMark) {
        // §6 — a coach mark is dismissible by tapping anywhere, and the overlay never
        // blocks the target, so the same tap also plays.
        tutorialRef.current?.dismiss();
        setCoachMark(null);
      }

      const index = engine.hitTest(
        boardX / metrics.cellSize,
        boardY / metrics.cellSize,
        metrics.cellSize,
        scale,
      );
      trace('hitTest done');
      const outcome = engine.resolveTap(index);
      trace('resolveTap done');

      if (outcome.kind === 'escaped') {
        const arrow = engine.level.arrows[outcome.arrowIndex];
        // 'escaping' hands the arrow to MovingArrow, which flies it off the board and
        // only then reports back. The engine has already cleared its cells, so the
        // arrow cannot be tapped again and whatever it was blocking is free to tap
        // immediately rather than waiting out the flight.
        patchVisual(outcome.arrowIndex, {
          state: 'escaping',
          escapeStartedAt: tappedAt,
        });
        trace('setState escaping dispatched');
        // Tick, move, buzz — all three answer the same tap, and all three now land
        // within a frame or two of the arrow actually leaving. That timing is the
        // whole reason they are here: the haptic was pulled at one point because the
        // arrow took the better part of a second to start moving, so the buzz arrived
        // a third of a second before the thing it was confirming and read as the game
        // stalling. With the tap answered in roughly a tenth of that, the cue and the
        // motion are simultaneous, which is what makes a tap feel like it connected.
        Audio.playTap();
        Audio.playArrowMove(arrow.cells.length);
        Haptics.light();
        trace('tick, move and haptic returned');
        // No particle trail behind the escaping arrow. The arrow's own motion is the
        // feedback; the field of sparks behind it was decoration on top of that, and
        // filling it cost tens of milliseconds of marshalling between the JS and UI
        // runtimes on the frame right after the tap. The completion burst (§9.4) is
        // untouched — that one is the reward, not a per-tap flourish.
        trace('handleTap done, React now owns the time');
        return;
      }

      if (outcome.kind === 'blocked') {
        Audio.playBlocked();
        Haptics.selection();
        // §9.3 — the shake is a transform, so it runs in the moving layer too.
        patchVisual(outcome.arrowIndex, {shaking: true});
        // §2.2 — flash the *blocker*. On a dense board "why didn't that move?" is
        // otherwise unanswerable, and this is the single highest-value cue here.
        patchVisual(outcome.blockerIndex, {highlighted: true});
        setTimeout(
          () => patchVisual(outcome.blockerIndex, {highlighted: false}),
          BLOCKER_HIGHLIGHT_MS,
        );

        // §9.3 — if the blocker is off-screen while zoomed, point at it.
        if (scale > 1.05) {
          const blocker = buildArrowGeometry(
            engine.level.arrows[outcome.blockerIndex],
            metrics.cellSize,
          );
          setOffscreenBlocker({
            x: blocker.headCentre.x,
            y: blocker.headCentre.y,
          });
          setTimeout(
            () => setOffscreenBlocker(null),
            BLOCKER_HIGHLIGHT_MS + 200,
          );
        }

        if (!firstBlockSeen.current) {
          firstBlockSeen.current = true;
          if (engine.livesEnabled) {
            setHeartsVisible(true);
          }
          const mark = tutorialRef.current?.onFirstBlocked(
            outcome.blockerIndex,
          );
          if (mark) {
            setCoachMark(mark);
          }
        }

        if (outcome.heartLost) {
          Audio.play('life_lost');
          Haptics.medium();
          setHearts(engine.hearts);
          setHeartsVisible(true);
          if (engine.hearts === 0) {
            Audio.play('game_over');
            setOutOfLives(true);
          }
        }
      }
    },
    [engine, complete, paused, coachMark, metrics.cellSize, patchVisual],
  );

  // ------------------------------------------------------------------ hint

  const useHint = useCallback(() => {
    if (!engine) {
      return;
    }
    setHintModal(false);
    if (!hintsRef.current.consume()) {
      return;
    }
    const index = hintsRef.current.suggest(engine.detector);
    if (index < 0) {
      return;
    }
    // §3.4 — using a hint forfeits three stars and the Perfect bonus. Nothing else.
    engine.hintsUsed++;
    setHintsRemaining(hintsRef.current.remaining);
    Audio.play('hint');
    Haptics.selection();

    const reveal = (): void => {
      patchVisual(index, {pulsing: true});
      setTimeout(() => patchVisual(index, {pulsing: false}), ASSIST_PULSE_MS);
    };

    // §3.4 — on boards of 40+ arrows the hint first brings its target on-screen.
    // Without this, a hint on a zoomed-in 14x14 board can point off-screen.
    if (engine.level.arrows.length >= HINT_AUTOFOCUS_ARROWS) {
      const geometry = buildArrowGeometry(
        engine.level.arrows[index],
        metrics.cellSize,
      );
      viewportRef.current?.focusOn(
        geometry.headCentre.x,
        geometry.headCentre.y,
        HINT_FOCUS_SCALE,
      );
      setTimeout(reveal, 320);
    } else {
      reveal();
    }
  }, [engine, metrics.cellSize, patchVisual]);

  // ------------------------------------------------------------------ controls

  const restart = useCallback(() => {
    if (!engine || !level) {
      return;
    }
    engine.restart();
    hintsRef.current.reset();
    setVisuals(level.arrows.map(freshVisual));
    setHearts(engine.hearts);
    setHintsRemaining(hintsRef.current.remaining);
    setHeartsVisible(engine.livesEnabled && firstBlockSeen.current);
    setPaused(false);
    setOutOfLives(false);
    setComplete(null);
    assistUsed.current = false;
    assistEscalated.current = false;
    viewportRef.current?.reset();
  }, [engine, level]);

  const goToNextLevel = useCallback(() => {
    if (!level) {
      return;
    }
    const next = level.id + 1;
    setComplete(null);
    setSummary(false);
    // §16 — the only interstitial seam in the game, and it sits *between* levels:
    // never during play, never during an animation, never during the win sequence.
    // NoopAdService is the only binding in v1, so this resolves immediately.
    void Ads.maybeShowInterstitial(level.id);
    if (next > TOTAL_LEVELS) {
      navigation.navigate('Home');
      return;
    }
    navigation.replace('Game', {levelId: next});
  }, [level, navigation]);

  const onCompleteNext = useCallback(() => {
    // §5.8 — the summary is shown on milestones and new high scores, and otherwise
    // NEXT LEVEL goes straight through.
    const milestone =
      FEATURES.scoreSummaryOnMilestones &&
      level &&
      level.id % FEATURES.milestoneEvery === 0;
    if (milestone || newHighScore) {
      setSummary(true);
      return;
    }
    goToNextLevel();
  }, [level, newHighScore, goToNextLevel]);

  if (!level || !engine) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>
          Level {levelId} is not available.
        </Text>
        <Pressable onPress={() => navigation.navigate('Home')}>
          <Text style={styles.missingLink}>BACK TO HOME</Text>
        </Pressable>
      </View>
    );
  }

  const modalOpen = paused || hintModal || outOfLives || complete !== null;
  const activeIndices = engine.detector.activeIndices();

  return (
    <View
      style={[
        styles.root,
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}>
      {/* §5.4 — hearts, level, gear. No score, no move counter, no timer, no ad. */}
      <View style={styles.header}>
        <Hearts hearts={hearts} visible={heartsVisible} />
        <Text style={styles.levelLabel}>LEVEL {level.id}</Text>
        <Pressable
          onPress={() => {
            engine.pause();
            setPaused(true);
          }}
          // §8.7 — developer mode is never reachable by a normal user in release:
          // __DEV__ is compiled away, so in a release build this is an ordinary gear.
          onLongPress={__DEV__ ? () => setDevOpen(true) : undefined}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          style={styles.gear}>
          <Text style={styles.gearGlyph}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.boardArea}>
        <FitButton
          visible={zoomed}
          onPress={() => viewportRef.current?.reset()}
        />
        <BoardViewport
          ref={viewportRef}
          boardSize={metrics.size}
          viewportWidth={width}
          viewportHeight={availableHeight}
          onTap={handleTap}
          locked={modalOpen}
          onScaleSettled={scale => {
            setRenderScale(scale);
            setZoomed(scale > 1.01);
            setLiveScale(scale);
          }}>
          <View style={styles.boardStack}>
            <Board
              level={level}
              cellSize={metrics.cellSize}
              arrowStates={visuals}
              renderScale={renderScale}
            />

            {/* Arrows in motion, each in its own layer above the board. An escaping
                arrow deforms like a rope being pulled out; a blocked one keeps its
                shape and bumps. Either way nothing still on the board shifts. */}
            {visuals.map((visual, index) => {
              if (visual.state === 'escaping') {
                return (
                  <EscapingArrow
                    key={`${level.arrows[index].id}-escape`}
                    arrow={level.arrows[index]}
                    index={index}
                    gridSize={level.gridSize}
                    cellSize={metrics.cellSize}
                    tier={tier}
                    clearance={clearance[level.arrows[index].direction]}
                    startedAt={visual.escapeStartedAt}
                    onComplete={onEscapeComplete}
                  />
                );
              }
              if (visual.shaking) {
                return (
                  <ShakingArrow
                    key={`${level.arrows[index].id}-shake`}
                    arrow={level.arrows[index]}
                    index={index}
                    gridSize={level.gridSize}
                    cellSize={metrics.cellSize}
                    tier={tier}
                    onComplete={onShakeComplete}
                  />
                );
              }
              return null;
            })}

            <ParticleSystem ref={particlesRef} size={metrics.size} />
          </View>
        </BoardViewport>

        {offscreenBlocker && (
          <View style={styles.chevron} pointerEvents="none">
            <Text style={styles.chevronGlyph}>›</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <HintPill
          remaining={hintsRemaining}
          pulsing={hintPillPulsing}
          disabled={modalOpen}
          onPress={() => setHintModal(true)}
        />
        <Pressable
          onPress={restart}
          accessibilityRole="button"
          accessibilityLabel="Restart level"
          style={styles.restart}>
          <Text style={styles.restartGlyph}>↻</Text>
        </Pressable>
      </View>

      {coachMark && (
        <CoachMark
          mark={coachMark}
          spotlight={spotlightFor(
            coachMark,
            engine,
            metrics,
            insets.top + HEADER_HEIGHT,
          )}
          targetInTopHalf={
            coachMark.arrowIndex >= 0
              ? level.arrows[coachMark.arrowIndex].cells[0].y <
                level.gridSize / 2
              : true
          }
          onDismiss={() => {
            tutorialRef.current?.dismiss();
            setCoachMark(null);
          }}
          onSkip={
            tutorialRef.current?.canSkip
              ? () => {
                  tutorialRef.current?.skip();
                  setCoachMark(null);
                  navigation.replace('Game', {levelId: 11});
                }
              : undefined
          }
        />
      )}

      <HintModal
        visible={hintModal}
        level={level}
        activeIndices={activeIndices}
        remaining={hintsRemaining}
        onConfirm={useHint}
        onCancel={() => setHintModal(false)}
      />

      <PauseOverlay
        visible={paused}
        hintsRemaining={hintsRemaining}
        onResume={() => {
          engine.resume();
          setPaused(false);
        }}
        onRestart={restart}
        onQuit={() => {
          setPaused(false);
          navigation.navigate('Home');
        }}
        onHint={() => {
          engine.resume();
          setPaused(false);
          setHintModal(true);
        }}
      />

      <OutOfLivesOverlay
        visible={outOfLives}
        onWatchVideo={() => {
          // §3.2 / §16 — the rewarded seam. NoopAdService grants immediately, so the
          // button reads CONTINUE +1 LIFE and costs the player nothing.
          void Ads.showRewarded('extra-life').then(granted => {
            if (granted) {
              engine.grantExtraLife();
              setHearts(engine.hearts);
            }
            setOutOfLives(false);
          });
        }}
        onRetry={restart}
      />

      {complete && (
        <LevelCompleteOverlay
          visible={complete !== null && !summary}
          breakdown={complete}
          newHighScore={newHighScore}
          onNext={onCompleteNext}
          onHome={() => navigation.navigate('Home')}
          onOpenSummary={() => setSummary(true)}
        />
      )}

      {__DEV__ && devOpen && (
        <DevOverlay
          engine={engine}
          scale={liveScale}
          onJump={id => {
            setDevOpen(false);
            navigation.replace('Game', {levelId: id});
          }}
          onRestart={() => {
            setDevOpen(false);
            restart();
          }}
          onRevealSolution={order => {
            setDevOpen(false);
            // Pulse the canonical solve order in sequence, 220ms apart.
            order.forEach((index, step) => {
              if (index < 0) {
                return;
              }
              setTimeout(() => {
                patchVisual(index, {pulsing: true});
                setTimeout(() => patchVisual(index, {pulsing: false}), 400);
              }, step * 220);
            });
          }}
          onClose={() => setDevOpen(false)}
        />
      )}

      {complete && (
        <ScoreSummaryOverlay
          visible={summary}
          breakdown={complete}
          bestScore={SaveStore.data.bestScore}
          onContinue={goToNextLevel}
        />
      )}
    </View>
  );
}

/** Where the coach-mark spotlight sits, in screen dp. */
function spotlightFor(
  mark: ActiveCoachMark,
  engine: GameEngine,
  metrics: {size: number; cellSize: number; originX: number; originY: number},
  boardTop: number,
): {x: number; y: number; radius: number} | null {
  if (mark.step.target.kind === 'hearts') {
    return {x: 46, y: boardTop - 28, radius: 44};
  }
  if (mark.arrowIndex < 0) {
    return null;
  }
  const geometry = buildArrowGeometry(
    engine.level.arrows[mark.arrowIndex],
    metrics.cellSize,
  );
  return {
    x: metrics.originX + geometry.headCentre.x,
    y: boardTop + metrics.originY + geometry.headCentre.y,
    radius: Math.max(38, metrics.cellSize * 1.4),
  };
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg.base},
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
  },
  levelLabel: {
    ...typography.ui(16),
    flex: 1,
    textAlign: 'center',
    letterSpacing: 2,
  },
  gear: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  gearGlyph: {fontSize: 20, color: theme.text.secondary},
  boardArea: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  // Sized by the board, but never clipping it: the exit animation lives here.
  boardStack: {overflow: 'visible'},
  footer: {
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xl,
  },
  restart: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.bg.panelAlt,
    borderWidth: 1,
    borderColor: theme.bg.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartGlyph: {fontSize: 20, color: theme.text.primary},
  chevron: {
    position: 'absolute',
    right: 4,
    top: '50%',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.bg.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  chevronGlyph: {fontSize: 18, color: theme.text.primary},
  missing: {
    flex: 1,
    backgroundColor: theme.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
  },
  missingText: {...typography.body(15)},
  missingLink: {
    ...typography.ui(13),
    color: theme.brand.tagline,
    letterSpacing: 2,
  },
});
