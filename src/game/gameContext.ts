import { createContext, useContext, type Dispatch } from 'react';
import type { Action } from './engine';
import type { GameState, OfflineReport } from './types';

export interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<Action>;
  offline: OfflineReport | null;
  dismissOffline: () => void;
  /** true, wenn ein Spielstand aus einer Notablage wiederhergestellt wurde. */
  recovered: boolean;
  /** Zeitpunkt der letzten erfolgreichen Sicherung. */
  lastSavedAt: number | null;
}

/**
 * Bewusst ohne Component-Export: React Fast Refresh kann Dateien nur
 * zuverlässig aktualisieren, wenn sie ausschließlich Komponenten oder
 * ausschließlich Nicht-Komponenten exportieren.
 */
export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame muss innerhalb von <GameProvider> verwendet werden.');
  return ctx;
}
