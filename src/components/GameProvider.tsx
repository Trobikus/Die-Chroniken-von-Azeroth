import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { reducer } from '../game/engine';
import { GameContext } from '../game/gameContext';
import { loadGame, saveGame, type LoadResult } from '../game/save';
import { getSettings } from '../game/settings';
import type { GameState, OfflineReport } from '../game/types';

const TICK_MS = 100;
const AUTOSAVE_MS = 10_000;

interface GameProviderProps {
  children: ReactNode;
  /** Wenn gesetzt, wird nicht geladen, sondern genau dieser Zustand verwendet. */
  initialState?: GameState;
}

export function GameProvider({ children, initialState }: GameProviderProps) {
  const bootRef = useRef<LoadResult | null>(null);
  if (bootRef.current === null) {
    bootRef.current = initialState
      ? { state: initialState, offline: null, hadSave: false }
      : loadGame(Date.now());
  }

  const [state, dispatch] = useReducer(reducer, bootRef.current.state);
  const [offline, setOffline] = useState<OfflineReport | null>(bootRef.current.offline);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', dt: TICK_MS / 1000 });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const persist = () => saveGame(stateRef.current);

    if (!getSettings().autoSave) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };

    const timer = window.setInterval(persist, AUTOSAVE_MS);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onVisibility);
      persist();
    };
  }, []);

  const dismissOffline = useCallback(() => setOffline(null), []);

  const value = useMemo(
    () => ({ state, dispatch, offline, dismissOffline }),
    [state, offline, dismissOffline],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
