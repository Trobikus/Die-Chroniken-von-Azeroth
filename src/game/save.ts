import { getClass, type ClassId } from './classes';
import { applyOffline, buildOfflineReport } from './engine';
import { computePlayerStats } from './selectors';
import { ZONES } from './data/zones';
import { getSettings } from './settings';
import { createInitialState, SAVE_VERSION } from './state';
import type { GameState, OfflineReport } from './types';

const SAVE_KEY = 'wow-incremental-save';
const BACKUP_KEY = 'wow-incremental-save-backup';

export interface LoadResult {  state: GameState;
  offline: OfflineReport | null;
  hadSave: boolean;
}

export interface SaveSummary {
  charName: string;
  classId: ClassId;
  level: number;
  gold: number;
  zoneName: string;
  playTime: number;
  savedAt: number;
  awaySeconds: number;
}

export function saveGame(state: GameState): void {
  try {
    const payload = JSON.stringify({ ...state, savedAt: Date.now() });
    const existing = window.localStorage.getItem(SAVE_KEY);
    if (existing) window.localStorage.setItem(BACKUP_KEY, existing);
    window.localStorage.setItem(SAVE_KEY, payload);
  } catch {
    /* Speicher voll oder blockiert – Spiel läuft trotzdem weiter. */
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignorieren */
  }
}

/** Liest den Spielstand nur zum Anzeigen – ohne Offline-Fortschritt zu verbuchen. */
export function peekSave(now: number): SaveSummary | null {
  const raw = readSave();
  if (!raw) return null;

  const merged = normalize(raw, createInitialState(now, getClass(raw.classId).id));
  const klass = getClass(merged.classId);
  const zone = ZONES.find((z) => z.id === merged.zoneId);

  return {
    charName: merged.charName,
    classId: klass.id,
    level: merged.level,
    gold: Math.floor(merged.gold),
    zoneName: zone?.name ?? 'Unbekannt',
    playTime: merged.playTime,
    savedAt: merged.savedAt,
    awaySeconds: Math.max(0, (now - merged.savedAt) / 1000),
  };
}

export function loadGame(now: number): LoadResult {
  const fresh = createInitialState(now);
  const raw = readSave();
  if (!raw) return { state: fresh, offline: null, hadSave: false };

  const merged = normalize(raw, fresh);
  const elapsedSeconds = Math.max(0, (now - merged.savedAt) / 1000);

  if (!getSettings().offlineProgress) {
    return { state: merged, offline: null, hadSave: true };
  }

  const withOffline = applyOffline(merged, elapsedSeconds);
  const offline =
    elapsedSeconds >= 30 ? buildOfflineReport(merged, withOffline, elapsedSeconds) : null;

  return { state: withOffline, offline, hadSave: true };
}

function readSave(): GameState | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<GameState>;
      if (parsed && typeof parsed.level === 'number') return parsed as GameState;
    } catch {
      /* defekter Spielstand: Backup versuchen */
    }
  }
  return null;
}

/** Fehlende Felder aus älteren Spielständen auffüllen. */
function normalize(raw: GameState, fresh: GameState): GameState {
  const klass = getClass(raw.classId);

  return {
    ...fresh,
    ...raw,
    version: SAVE_VERSION,
    charName: raw.charName || fresh.charName,
    classId: klass.id,
    materials: { ...fresh.materials, ...(raw.materials ?? {}) },
    buildings: { ...fresh.buildings, ...(raw.buildings ?? {}) },
    equipped: { ...(raw.equipped ?? {}) },
    crafting: normalizeCrafting(raw.crafting),
    quests: { ...(raw.quests ?? {}) },
    completedQuests: Array.isArray(raw.completedQuests) ? [...raw.completedQuests] : [],
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    log: Array.isArray(raw.log) ? raw.log : [],
    logCounter: typeof raw.logCounter === 'number' ? raw.logCounter : 0,
    combat: null,
    buff: null,
    hp: Math.min(raw.hp ?? 0, computePlayerStats({ ...raw, ...fresh }).maxHp) || fresh.hp,
    stats: {
      ...fresh.stats,
      ...(raw.stats ?? {}),
      killsByEnemy: { ...(raw.stats?.killsByEnemy ?? {}) },
      craftedByRecipe: { ...(raw.stats?.craftedByRecipe ?? {}) },
      gatheredBy: { ...(raw.stats?.gatheredBy ?? {}) },
    },
    rngSeed: typeof raw.rngSeed === 'number' ? raw.rngSeed : fresh.rngSeed,
    uidCounter: typeof raw.uidCounter === 'number' ? raw.uidCounter : 0,
  };
}

/** Alte Spielstände hatten `crafting` als Record; neue als einzelnen Auftrag. */
function normalizeCrafting(raw: GameState['crafting']): GameState['crafting'] {
  if (!raw) return null;

  if ('recipeId' in raw) {
    return raw.recipeId ? { ...raw } : null;
  }

  const first = Object.entries(
    raw as unknown as Record<string, { remaining?: number; queued?: number }>,
  )[0];
  if (!first) return null;

  const recipeId = first[0];
  const data = first[1] ?? {};
  if (!recipeId || typeof data.remaining !== 'number') return null;

  return { recipeId, remaining: data.remaining, queued: data.queued ?? 0 };
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(encoded: string, now: number): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json) as Partial<GameState>;
    if (!parsed || typeof parsed.level !== 'number') return null;
    return normalize(parsed as GameState, createInitialState(now));
  } catch {
    return null;
  }
}
