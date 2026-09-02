/**
 * §15 — one namespaced key holding a versioned blob plus a migration function.
 * Corrupt data falls back to defaults without crashing and never discards a
 * recoverable bestScore.
 */

export const SAVE_KEY = 'arrow-escape/save/v1';
export const CURRENT_SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: 1;
  currentLevel: number;
  completedLevels: number[];
  levelStars: Record<number, 1 | 2 | 3>;
  levelScores: Record<number, number>;
  bestScore: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  tutorialCompleted: boolean;
  tutorialStepsSeen: number[];
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentLevel: 1,
    completedLevels: [],
    levelStars: {},
    levelScores: {},
    bestScore: 0,
    soundEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true,
    tutorialCompleted: false,
    tutorialStepsSeen: [],
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v),
      )
    : [];
}

function numberRecord(
  value: unknown,
  min: number,
  max: number,
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!isPlainObject(value)) {
    return out;
  }
  for (const [key, entry] of Object.entries(value)) {
    const id = Number(key);
    if (
      Number.isInteger(id) &&
      typeof entry === 'number' &&
      entry >= min &&
      entry <= max
    ) {
      out[id] = entry;
    }
  }
  return out;
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Rebuilds a SaveData from whatever is on disk, field by field.
 *
 * Salvage is deliberately per-field rather than all-or-nothing: a save whose
 * levelStars map has been corrupted should still keep its bestScore and its unlocked
 * progress. Anything unreadable falls back to the default for that field alone.
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isPlainObject(raw)) {
    return base;
  }

  const stars = numberRecord(raw.levelStars, 1, 3) as Record<number, 1 | 2 | 3>;
  const scores = numberRecord(raw.levelScores, 0, Number.MAX_SAFE_INTEGER);

  // bestScore is the one number a player would genuinely mourn, so it is recovered
  // from the per-level totals when the stored field itself is unusable.
  const storedBest =
    typeof raw.bestScore === 'number' &&
    Number.isFinite(raw.bestScore) &&
    raw.bestScore >= 0
      ? raw.bestScore
      : 0;
  const derivedBest = Object.values(scores).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentLevel:
      typeof raw.currentLevel === 'number' && raw.currentLevel >= 1
        ? Math.floor(raw.currentLevel)
        : base.currentLevel,
    completedLevels: numberArray(raw.completedLevels),
    levelStars: stars,
    levelScores: scores,
    bestScore: Math.max(storedBest, derivedBest),
    soundEnabled: bool(raw.soundEnabled, base.soundEnabled),
    musicEnabled: bool(raw.musicEnabled, base.musicEnabled),
    vibrationEnabled: bool(raw.vibrationEnabled, base.vibrationEnabled),
    tutorialCompleted: bool(raw.tutorialCompleted, base.tutorialCompleted),
    tutorialStepsSeen: numberArray(raw.tutorialStepsSeen),
  };
}
