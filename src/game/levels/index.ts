import type {Level} from '../models/types';
import {FEATURES} from '../../app/featureFlags';
import type {LevelPack} from './codec';
import {unpackLevel} from './codec';
import {PACK_LOADERS} from './packLoaders';

/** 25 levels per pack, aligned to the level-select pager (§8.5). */
export const PACK_SIZE = FEATURES.levelsPerPack;
export const TOTAL_LEVELS = FEATURES.totalLevels;
export const TOTAL_PACKS = Math.ceil(TOTAL_LEVELS / PACK_SIZE);

export const packIndexForLevel = (levelId: number): number =>
  Math.floor((levelId - 1) / PACK_SIZE);

/** Current pack plus two neighbours stay resident; the rest are dropped (§8.5). */
const cache = new Map<number, LevelPack>();
const RESIDENT_PACKS = 3;
const residency: number[] = [];

function loadPack(packIndex: number): LevelPack | null {
  const cached = cache.get(packIndex);
  if (cached) {
    return cached;
  }
  const loader = PACK_LOADERS[packIndex];
  if (!loader) {
    return null;
  }
  const pack = loader() as LevelPack;
  cache.set(packIndex, pack);
  residency.push(packIndex);
  while (residency.length > RESIDENT_PACKS) {
    const evicted = residency.shift();
    if (evicted !== undefined && evicted !== packIndex) {
      cache.delete(evicted);
    }
  }
  return pack;
}

export function getLevel(levelId: number): Level | null {
  if (levelId < 1 || levelId > TOTAL_LEVELS) {
    return null;
  }
  const pack = loadPack(packIndexForLevel(levelId));
  if (!pack) {
    return null;
  }
  const packed = pack.levels.find(l => l.id === levelId);
  return packed ? unpackLevel(packed) : null;
}

/** Warms the pack for `levelId` and its neighbours, called during Splash and on entry. */
export function preloadAround(levelId: number): void {
  const index = packIndexForLevel(levelId);
  loadPack(index);
  if (index + 1 < TOTAL_PACKS) {
    loadPack(index + 1);
  }
  if (index - 1 >= 0) {
    loadPack(index - 1);
  }
}

/** Lightweight rows for the level-select pager — never unpacks the arrows. */
export interface LevelSummary {
  id: number;
  gridSize: number;
  band: string;
  theme: string;
  difficulty: number;
  arrowCount: number;
}

export function getPageSummaries(pageIndex: number): LevelSummary[] {
  const pack = loadPack(pageIndex);
  if (!pack) {
    return [];
  }
  return pack.levels.map(l => ({
    id: l.id,
    gridSize: l.g,
    band: l.b,
    theme: l.t,
    difficulty: l.d,
    arrowCount: l.a.length,
  }));
}

export function bandForPage(pageIndex: number): string {
  const summaries = getPageSummaries(pageIndex);
  return summaries.length > 0 ? summaries[0].band : '';
}
