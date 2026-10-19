import { getClass, type ClassId } from './classes';
import { applyOffline, buildOfflineReport } from './engine';
import { MAX_LEVEL } from './data/level';
import { ZONES } from './data/zones';
import { computePlayerStats } from './selectors';
import { getSettings } from './settings';
import { createInitialState, SAVE_VERSION } from './state';
import type { GameState, OfflineReport } from './types';

/**
 * Drei gleichwertige Ablagen statt einer. Fällt eine aus — durch einen
 * halb geschriebenen Wert, eine Speichergrenze oder eine manuell
 * gelöschte Seite — bleiben die beiden anderen lesbar.
 */
export const SAVE_SLOTS = [
  'wow-incremental-save',
  'wow-incremental-save-b',
  'wow-incremental-save-c',
] as const;

/** Kurzzeitiger Lese-Cache, damit das Menü nicht bei jedem Takt liest. */
const cacheKey = 'wow-incremental-cached';

export interface LoadResult {
  state: GameState;
  offline: OfflineReport | null;
  hadSave: boolean;
  /** true, wenn der Hauptspielstand unlesbar war und ein Backup geholfen hat. */
  recovered: boolean;
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

export type SaveReason = 'quota' | 'blocked' | 'unknown';

export interface SaveHealth {
  status: 'ok' | 'error';
  reason: SaveReason | null;
  lastOkAt: number | null;
  /** true, wenn wir wissen, dass in diesem Browser nicht gesichert werden kann. */
  volatile: boolean;
  consecutiveErrors: number;
}

const INITIAL_HEALTH: SaveHealth = {
  status: 'ok',
  reason: null,
  lastOkAt: null,
  volatile: false,
  consecutiveErrors: 0,
};

export const INITIAL_HEALTH_FOR_UI = INITIAL_HEALTH;

let health: SaveHealth = { ...INITIAL_HEALTH };
const healthListeners = new Set<() => void>();

export function getSaveHealthSnapshot(): SaveHealth {
  return health;
}

export function saveHealth(): SaveHealth {
  return health;
}

export function subscribeSaveHealth(listener: () => void): () => void {
  healthListeners.add(listener);
  return () => healthListeners.delete(listener);
}

function setHealth(next: Partial<SaveHealth>): void {
  health = { ...health, ...next };
  for (const listener of healthListeners) listener();
}

export function resetSaveHealth(): void {
  setHealth({ ...INITIAL_HEALTH });
}

/* ------------------------------------------------------------------ */
/* Prüfsumme                                                          */
/* ------------------------------------------------------------------ */

interface Envelope {
  v: number;
  sum: string;
  data: GameState;
}

/** FNV-1a über den Text. Kein Krypto, aber es findet abgeschnittene Daten. */
function checksum(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function encode(state: GameState, savedAt: number): string {
  const data = { ...state, savedAt };
  const json = JSON.stringify(data);
  const envelope: Envelope = { v: SAVE_VERSION, sum: checksum(json), data };
  return JSON.stringify(envelope);
}

function decode(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Neues Format mit Prüfsumme …
  if (parsed && typeof parsed === 'object' && 'data' in parsed && 'sum' in parsed) {
    const envelope = parsed as Envelope;
    const json = JSON.stringify(envelope.data);
    if (envelope.sum !== checksum(json)) return null;
    return isPlayable(envelope.data) ? envelope.data : null;
  }

  // … oder ein alter Spielstand im Klartext.
  const legacy = parsed as GameState;
  return isPlayable(legacy) ? legacy : null;
}

/** Fängt Werte ab, die zwar JSON sind, aber kein Spielstand sein können. */
function isPlayable(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;

  if (typeof state.level !== 'number' || !Number.isFinite(state.level)) return false;
  if (state.level < 1 || state.level > MAX_LEVEL + 5) return false;
  if (typeof state.gold !== 'number' || !Number.isFinite(state.gold)) return false;
  if (!state.materials || typeof state.materials !== 'object') return false;

  for (const value of Object.values(state.materials)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  }

  if (state.inventory && !Array.isArray(state.inventory)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                          */
/* ------------------------------------------------------------------ */

function classify(error: unknown): SaveReason {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'blocked';
  return 'unknown';
}

/**
 * Schreibt den Stand in den ältesten der drei Ablageplätze, damit bei
 * einem Absturz mitten im Schreiben immer zwei intakte Fassungen stehen.
 */
export function saveGame(state: GameState): SaveHealth {
  const payload = encode(state, Date.now());

  try {
    const oldest = SAVE_SLOTS[2];
    window.localStorage.setItem(oldest, payload);
    window.localStorage.setItem(SAVE_SLOTS[0], payload);
    window.localStorage.setItem(SAVE_SLOTS[1], payload);
    window.localStorage.setItem(cacheKey, payload);
  } catch (error) {
    setHealth({
      status: 'error',
      reason: classify(error),
      volatile: true,
      consecutiveErrors: health.consecutiveErrors + 1,
    });
    return saveHealth();
  }

  setHealth({ status: 'ok', reason: null, lastOkAt: Date.now(), consecutiveErrors: 0 });
  return saveHealth();
}

export function clearSave(): void {
  try {
    for (const key of [...SAVE_SLOTS, cacheKey]) window.localStorage.removeItem(key);
  } catch {
    /* nicht kritisch */
  }
}

/* ------------------------------------------------------------------ */
/* Lesen                                                              */
/* ------------------------------------------------------------------ */

interface ReadResult {
  raw: GameState | null;
  recovered: boolean;
}

function readSave(): ReadResult {
  for (const [index, key] of SAVE_SLOTS.entries()) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;

    const state = decode(raw);
    if (state) return { raw: state, recovered: index > 0 };
  }
  return { raw: null, recovered: false };
}

/** Liest den Spielstand nur zum Anzeigen — ohne Offline-Fortschritt zu verbuchen. */
export function peekSave(now: number): SaveSummary | null {
  const { raw } = readSave();
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
  const { raw, recovered } = readSave();
  if (!raw) return { state: fresh, offline: null, hadSave: false, recovered: false };

  const merged = normalize(raw, fresh);
  const elapsedSeconds = Math.max(0, (now - merged.savedAt) / 1000);

  if (!getSettings().offlineProgress) {
    return { state: merged, offline: null, hadSave: true, recovered };
  }

  const withOffline = applyOffline(merged, elapsedSeconds);
  const offline =
    elapsedSeconds >= 30 ? buildOfflineReport(merged, withOffline, elapsedSeconds) : null;

  return { state: withOffline, offline, hadSave: true, recovered };
}

/* ------------------------------------------------------------------ */
/* Normalisieren                                                      */
/* ------------------------------------------------------------------ */

/** Fehlende oder unbrauchbare Felder aus älteren Spielständen auffüllen. */
function normalize(raw: GameState, fresh: GameState): GameState {
  const merged: GameState = {
    ...fresh,
    ...raw,
    version: SAVE_VERSION,
    charName: raw.charName || fresh.charName,
    classId: getClass(raw.classId).id,
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

  // Erst jetzt stehen Ausrüstung und Stufe fest — erst dann darf die
  // Lebenspunktezahl gegen das tatsächliche Maximum geprüft werden.
  const maxHp = computePlayerStats(merged).maxHp;
  const stored = Number.isFinite(merged.hp) ? (merged.hp as number) : maxHp;
  merged.hp = Math.max(0, Math.min(stored, maxHp));

  return merged;
}

/** Alte Spielstände hatten `crafting` als Record; neue als einzelnen Auftrag. */
function normalizeCrafting(raw: GameState['crafting']): GameState['crafting'] {
  if (!raw) return null;

  if ('recipeId' in raw) {
    return raw.recipeId && Number.isFinite(raw.remaining) ? { ...raw } : null;
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

/* ------------------------------------------------------------------ */
/* Export und Import                                                  */
/* ------------------------------------------------------------------ */

export function exportSave(state: GameState): string {
  const json = JSON.stringify({ ...state, savedAt: Date.now() });
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(encoded: string, now: number): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json) as Partial<GameState>;
    if (!isPlayable(parsed)) return null;
    return normalize(parsed as GameState, createInitialState(now));
  } catch {
    return null;
  }
}
