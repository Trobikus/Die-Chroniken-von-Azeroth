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
      ? { state: initialState, offline: null, hadSave: false, recovered: false }
      : loadGame(Date.now());
  }

  const [state, dispatch] = useReducer(reducer, bootRef.current.state);
  const [offline, setOffline] = useState<OfflineReport | null>(bootRef.current.offline);
  const [recovered] = useState(bootRef.current.recovered);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', dt: TICK_MS / 1000 });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const persist = () => {
      const result = saveGame(stateRef.current);
      if (result.status === 'ok') setLastSavedAt(result.lastOkAt);
      return result;
    };

    // Diese drei Sicherungen laufen immer. Die Einstellung "Automatisch
    // speichern" betrifft nur den Takt — wer sie ausschaltet, darf seinen
    // Fortschritt beim Schließen der Seite trotzdem nicht verlieren.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    const onPageHide = () => persist();
    const onBeforeUnload = () => persist();

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);

    let timer = 0;
    if (getSettings().autoSave) {
      timer = window.setInterval(persist, AUTOSAVE_MS);
    }

    return () => {
      if (timer) window.clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      persist();
    };
  }, []);

  const dismissOffline = useCallback(() => setOffline(null), []);

  const value = useMemo(
    () => ({ state, dispatch, offline, dismissOffline, recovered, lastSavedAt }),
    [state, offline, dismissOffline, recovered, lastSavedAt],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
