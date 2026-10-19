import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  subscribeSettings,
  updateSettings,
  type Settings,
} from '../game/settings';

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
}

export { updateSettings };
export type { Settings };
