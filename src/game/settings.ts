export interface Settings {
  /** CSS-Animationen und Übergänge abschalten. */
  reduceMotion: boolean;
  /** Spielstand alle 10 Sekunden und beim Verlassen der Seite sichern. */
  autoSave: boolean;
  /** Beim Zurückkommen Betriebe und Handwerk nachholen. */
  offlineProgress: boolean;
  /** Auch gewöhnliche Treffer ins Kampfprotokoll schreiben (nicht nur Kritische). */
  showDamageNumbers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  reduceMotion: false,
  autoSave: true,
  offlineProgress: true,
  showDamageNumbers: false,
};

const KEY = 'wow-incremental-settings';

function read(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: Settings = read();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* Speicher blockiert – Einstellung gilt dann nur für diese Sitzung. */
  }
  emit();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
