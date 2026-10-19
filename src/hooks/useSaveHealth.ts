import { useSyncExternalStore } from 'react';
import {
  INITIAL_HEALTH_FOR_UI,
  getSaveHealthSnapshot,
  subscribeSaveHealth,
} from '../game/save';

/** Beobachtet den Zustand des Speicherns, damit die UI ihn anzeigen kann. */
export function useSaveHealth() {
  return useSyncExternalStore(subscribeSaveHealth, getSaveHealthSnapshot, () => INITIAL_HEALTH_FOR_UI);
}
