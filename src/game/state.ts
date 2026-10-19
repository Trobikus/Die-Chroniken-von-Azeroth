import { getClass, suggestName } from './classes';
import { levelBonus } from './data/level';
import type { ClassId } from './classes';
import type { GameState } from './types';

export const SAVE_VERSION = 2;
export const MAX_INVENTORY = 60;
export const LOG_LIMIT = 120;

export function createInitialState(now: number, classId: ClassId = 'krieger'): GameState {
  const def = getClass(classId);

  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playTime: 0,

    charName: suggestName(classId),
    classId: def.id,

    gold: def.startingGold,
    xp: 0,
    level: 1,
    hp: levelBonus(1).maxHp + (def.startingStats.vitalitaet ?? 0) * 2.4,

    materials: {
      holz: 5 + (def.startingMaterials.holz ?? 0),
      leder: 2 + (def.startingMaterials.leder ?? 0),
      schwamm: (def.startingMaterials.schwamm ?? 0),
      stein: 3 + (def.startingMaterials.stein ?? 0),
    },

    buildings: { saegewerk: 1, gerberei: 1, pilzfarm: 0, steinbruch: 0 },

    inventory: [],
    equipped: {},
    crafting: null,
    buff: null,
    campCooldown: 0,

    combat: null,

    quests: {},
    completedQuests: [],

    zoneId: 'elwynn',
    log: [],
    logCounter: 0,

    stats: {
      kills: 0,
      deaths: 0,
      crafted: 0,
      questsDone: 0,
      goldEarned: 0,
      offlineSeconds: 0,
      killsByEnemy: {},
      craftedByRecipe: {},
      gatheredBy: {},
    },

    rngSeed: now & 0x7fffffff,
    uidCounter: 0,
  };
}
