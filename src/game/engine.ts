import { getClass, type ClassId } from './classes';
import { QUALITIES, QUALITY_ORDER } from './data/materials';
import { ITEMS } from './data/items';
import { RECIPES_BY_ID } from './data/recipes';
import { QUESTS } from './data/quests';
import { BUILDINGS, buildingCost, buildingProduction } from './data/buildings';
import { ENEMIES, ZONES_BY_ID } from './data/zones';
import { MAX_LEVEL, enemyDamageAt, xpToNext } from './data/level';
import { random, weightedPick } from './rng';
import { computePlayerStats } from './selectors';
import { getSettings } from './settings';
import { LOG_LIMIT, MAX_INVENTORY, createInitialState } from './state';
import type {
  EnemyId,
  EquipSlot,
  GameState,  ItemInstance,
  LogEntry,
  MaterialId,
  OfflineReport,
  Quality,
  QuestObjective,
} from './types';

export const OFFLINE_CAP_SECONDS = 8 * 3600;
export const OFFLINE_EFFICIENCY = 0.5;
export const CAMP_HEAL_PERCENT = 0.3;
export const CAMP_COOLDOWN = 45;
export const OUT_OF_COMBAT_REGEN = 0.04;
export const DEATH_GOLD_LOSS = 0.05;
export const MAX_QUEUE = 20;

export type Action =
  | { type: 'tick'; dt: number }
  | { type: 'craft'; recipeId: string; count?: number }
  | { type: 'cancelCraft' }
  | { type: 'equip'; uid: string }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'sell'; uid: string }
  | { type: 'use'; uid: string }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'hunt'; enemyId: string }
  | { type: 'stopHunt' }
  | { type: 'travel'; zoneId: string }
  | { type: 'camp' }
  | { type: 'applyOffline'; seconds: number }
  | { type: 'replace'; state: GameState }
  | { type: 'newGame'; now: number; classId: ClassId; charName: string }
  | { type: 'reset'; now: number };

/* ------------------------------------------------------------------ */
/* Log                                                                 */
/* ------------------------------------------------------------------ */

function addLog(s: GameState, text: string, kind: LogEntry['kind']): void {
  s.logCounter += 1;
  s.log.unshift({ id: s.logCounter, text, kind, at: Date.now() });
  if (s.log.length > LOG_LIMIT) s.log.length = LOG_LIMIT;
}

/* ------------------------------------------------------------------ */
/* Materialien                                                         */
/* ------------------------------------------------------------------ */

function grantMaterial(s: GameState, id: MaterialId, amount: number): void {
  s.materials[id] = (s.materials[id] ?? 0) + amount;
  s.stats.gatheredBy[id] = (s.stats.gatheredBy[id] ?? 0) + amount;
}

export function canAffordMaterials(s: GameState, cost: Partial<Record<MaterialId, number>>): boolean {
  return (Object.entries(cost) as [MaterialId, number][]).every(([id, n]) => s.materials[id] >= n);
}

export function consumeMaterials(
  s: GameState,
  cost: Partial<Record<MaterialId, number>>,
): boolean {
  if (!canAffordMaterials(s, cost)) return false;
  for (const [id, n] of Object.entries(cost) as [MaterialId, number][]) {
    s.materials[id] -= n;
  }
  return true;
}

export function scaleCost(
  cost: Partial<Record<MaterialId, number>>,
  factor: number,
): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(cost) as [MaterialId, number][]) {
    out[id] = n * factor;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

function rollQuality(s: GameState): Quality {
  const [roll] = random(s);
  return weightedPick(
    roll,
    QUALITY_ORDER.map((q) => [q, QUALITIES[q].weight] as [Quality, number]),
  );
}

function makeInstance(s: GameState, defId: string, forcedQuality?: Quality): ItemInstance {
  const def = ITEMS[defId];
  const quality = forcedQuality ?? rollQuality(s);
  const mult = QUALITIES[quality].mult;

  const jitter = () => {
    const [r] = random(s);
    return 0.95 + r * 0.1;
  };

  const scale = (v: number | undefined) =>
    v ? Math.max(1, Math.round(v * mult * jitter())) : 0;

  s.uidCounter += 1;

  return {
    uid: `${defId}-${s.uidCounter}-${(s.rngSeed & 0xffff).toString(36)}`,
    defId,
    quality,
    stats: {
      staerke: scale(def.baseStats.staerke),
      agilitaet: scale(def.baseStats.agilitaet),
      vitalitaet: scale(def.baseStats.vitalitaet),
    },
    attackTime: Math.round((def.attackTime ?? 0) * mult * 100) / 100,
    crit: Math.round((def.crit ?? 0) * mult * 10) / 10,
  };
}

function grantItem(s: GameState, defId: string, forcedQuality?: Quality): ItemInstance | null {
  if (s.inventory.length >= MAX_INVENTORY) {
    addLog(s, `Inventar voll — ${ITEMS[defId].name} wurde verkauft.`, 'loot');
    s.gold += ITEMS[defId].sellPrice;
    return null;
  }
  const instance = makeInstance(s, defId, forcedQuality);
  s.inventory.push(instance);
  addLog(
    s,
    `Beute: ${QUALITIES[instance.quality].label} ${ITEMS[defId].name}`,
    'loot',
  );
  return instance;
}

/* ------------------------------------------------------------------ */
/* Erfahrung & Level                                                   */
/* ------------------------------------------------------------------ */

function grantXp(s: GameState, amount: number): void {
  if (s.level >= MAX_LEVEL) return;
  s.xp += amount;

  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    const player = computePlayerStats(s);
    s.hp = player.maxHp;
    addLog(s, `Level ${s.level} erreicht!`, 'level');
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
}

/* ------------------------------------------------------------------ */
/* Quests                                                              */
/* ------------------------------------------------------------------ */

function objectiveValue(s: GameState, obj: QuestObjective): number {
  switch (obj.kind) {
    case 'kill':
      return s.stats.killsByEnemy[obj.targetId] ?? 0;
    case 'craft':
      return s.stats.craftedByRecipe[obj.targetId] ?? 0;
    case 'gather':
      return s.stats.gatheredBy[obj.targetId as MaterialId] ?? 0;
    case 'level':
      return s.level;
  }
}

function syncQuests(s: GameState): void {
  for (const quest of QUESTS) {
    let entry = s.quests[quest.id];

    if (!entry) {
      if (s.level < quest.minLevel) continue;
      entry = { status: 'aktiv', progress: quest.objectives.map(() => 0) };
      s.quests[quest.id] = entry;
      addLog(s, `Quest angenommen: ${quest.name}`, 'quest');
    }

    quest.objectives.forEach((obj, i) => {
      entry.progress[i] = objectiveValue(s, obj);
    });

    const done = quest.objectives.every((obj, i) => entry.progress[i] >= obj.count);
    if (entry.status === 'aktiv' && done) {
      entry.status = 'belohnt';
      entry.turnedInAt = Date.now();
      s.gold += quest.rewards.gold;
      s.stats.goldEarned += quest.rewards.gold;
      grantXp(s, quest.rewards.xp);
      for (const reward of quest.rewards.items ?? []) {
        grantItem(s, reward.defId, reward.quality);
      }
      s.completedQuests.push(quest.id);
      s.stats.questsDone += 1;
      addLog(s, `Quest abgeschlossen: ${quest.name}`, 'quest');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Idle-Produktion                                                     */
/* ------------------------------------------------------------------ */

function tickProduction(s: GameState, dt: number, efficiency = 1): Record<MaterialId, number> {
  const gained: Record<MaterialId, number> = { holz: 0, leder: 0, schwamm: 0, stein: 0 };
  for (const def of Object.values(BUILDINGS)) {
    const level = s.buildings[def.id] ?? 0;
    if (level <= 0) continue;
    const amount = buildingProduction(def, level) * dt * efficiency;
    if (amount <= 0) continue;
    grantMaterial(s, def.produces, amount);
    gained[def.produces] += amount;
  }
  return gained;
}

/* ------------------------------------------------------------------ */
/* Kampf                                                               */
/* ------------------------------------------------------------------ */

function spawnEnemy(s: GameState, enemyId: EnemyId, keepSession: boolean) {
  const def = ENEMIES[enemyId];
  const level = clampInt(s.level, def.minLevel, def.maxLevel);
  s.combat = {
    zoneId: s.zoneId,
    enemyId,
    enemyHp: def.hp,
    enemyMaxHp: def.hp,
    enemyLevel: level,
    enemyAttackTimer: def.attackTime * 0.6,
    playerAttackTimer: 0,
    kills: 0,
    deaths: 0,
    startedAt: Date.now(),
    sessionKills: keepSession && s.combat ? s.combat.sessionKills : 0,
    sessionGold: keepSession && s.combat ? s.combat.sessionGold : 0,
    sessionXp: keepSession && s.combat ? s.combat.sessionXp : 0,
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function onEnemyDefeated(s: GameState): void {
  const combat = s.combat;
  if (!combat) return;
  const def = ENEMIES[combat.enemyId];

  const [goldRoll] = random(s);
  const gold = Math.round(def.gold[0] + goldRoll * (def.gold[1] - def.gold[0]));
  s.gold += gold;
  s.stats.goldEarned += gold;
  combat.sessionGold += gold;

  const xp = def.xp;
  grantXp(s, xp);
  combat.sessionXp += xp;

  s.stats.kills += 1;
  combat.kills += 1;
  combat.sessionKills += 1;
  s.stats.killsByEnemy[def.id] = (s.stats.killsByEnemy[def.id] ?? 0) + 1;

  const lootLines: string[] = [];
  for (const [id, chance] of Object.entries(def.drops) as [MaterialId, number][]) {
    const [roll] = random(s);
    if (roll < chance) {
      const amount = 1 + Math.floor(random(s)[0] * 2);
      grantMaterial(s, id, amount);
      lootLines.push(`+${amount} ${id}`);
    }
  }

  if (def.itemDrop) {
    const [roll] = random(s);
    if (roll < def.itemDrop.chance) {
      const [pickRoll] = random(s);
      const pool = def.itemDrop.pool;
      const defId = pool[Math.min(pool.length - 1, Math.floor(pickRoll * pool.length))];
      grantItem(s, defId);
    }
  }

  const loot = lootLines.length ? ` (${lootLines.join(', ')})` : '';
  addLog(s, `${def.icon} ${def.name} besiegt: +${xp} EP, +${gold} Gold${loot}`, 'kampf');

  syncQuests(s);
  spawnEnemy(s, def.id, true);
}

function onPlayerDeath(s: GameState): void {
  const combat = s.combat;
  const def = combat ? ENEMIES[combat.enemyId] : null;
  const lost = Math.floor(s.gold * DEATH_GOLD_LOSS);

  s.stats.deaths += 1;
  s.gold -= lost;
  s.combat = null;
  s.zoneId = 'elwynn';

  const player = computePlayerStats(s);
  s.hp = player.maxHp;

  addLog(
    s,
    `Du wurdest von ${def?.name ?? 'etwas'} getötet. ${lost} Gold verloren.`,
    'tod',
  );
}

function tickCombat(s: GameState, dt: number): void {
  if (!s.combat) return;
  const combat = s.combat;
  const def = ENEMIES[combat.enemyId];
  const player = computePlayerStats(s);

  combat.playerAttackTimer -= dt;
  if (combat.playerAttackTimer <= 0) {
    combat.playerAttackTimer += player.attackTime;
    const [critRoll] = random(s);
    const isCrit = critRoll < player.crit / 100;
    const [variance] = random(s);
    const amount = Math.max(1, Math.round(player.damage * (0.9 + variance * 0.2) * (isCrit ? 2 : 1)));
    combat.enemyHp -= amount;
    if (isCrit || getSettings().showDamageNumbers) {
      addLog(
        s,
        `${isCrit ? 'Kritischer Treffer! ' : ''}${amount} Schaden an ${def.name}.`,
        'kampf',
      );
    }
    if (combat.enemyHp <= 0) {
      onEnemyDefeated(s);
      return;
    }
  }

  combat.enemyAttackTimer -= dt;
  if (combat.enemyAttackTimer <= 0) {
    combat.enemyAttackTimer += def.attackTime;
    const [variance] = random(s);
    const raw = enemyDamageAt(def, combat.enemyLevel) * (0.85 + variance * 0.3);
    const amount = Math.max(1, Math.round(raw * (1 - player.damageReduction)));
    s.hp -= amount;
    if (s.hp <= 0) {
      s.hp = 0;
      onPlayerDeath(s);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Herstellung                                                         */
/* ------------------------------------------------------------------ */

function finishCraft(s: GameState, recipeId: string): void {
  const recipe = RECIPES_BY_ID[recipeId];
  if (!recipe) return;

  s.stats.crafted += 1;
  s.stats.craftedByRecipe[recipeId] = (s.stats.craftedByRecipe[recipeId] ?? 0) + 1;

  if (recipe.yieldGold) {
    s.gold += recipe.yieldGold;
    s.stats.goldEarned += recipe.yieldGold;
  }

  for (const result of recipe.results) {
    const def = ITEMS[result.defId];
    if (def.slot === 'material') {
      for (let i = 0; i < result.count; i++) grantItem(s, result.defId);
    } else {
      grantItem(s, result.defId);
    }
  }

  syncQuests(s);
}

const MAX_CRAFTS_PER_TICK = 200;

function tickCrafting(s: GameState, dt: number): void {
  const job = s.crafting;
  if (!job) return;

  const recipe = RECIPES_BY_ID[job.recipeId];
  if (!recipe || recipe.craftTime <= 0) {
    s.crafting = null;
    return;
  }

  let remaining = job.remaining - dt;
  let queued = job.queued;
  let completions = 0;

  while (remaining <= 0 && completions < MAX_CRAFTS_PER_TICK) {
    finishCraft(s, job.recipeId);
    completions++;

    if (queued > 0) {
      queued -= 1;
      remaining += recipe.craftTime;
    } else {
      s.crafting = null;
      return;
    }
  }

  s.crafting = { recipeId: job.recipeId, remaining: Math.max(0, remaining), queued };
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'tick':
      return tick(state, action.dt);

    case 'craft': {
      const s = clone(state);
      const recipe = RECIPES_BY_ID[action.recipeId];
      if (!recipe) return state;

      // Nur ein Handwerksplatz: Ein anderes Rezept verdrängt keins, es wird blockiert.
      const job = s.crafting;
      if (job && job.recipeId !== recipe.id) return state;

      const repeats = Math.max(1, Math.min(MAX_QUEUE, action.count ?? 1));
      const totalGold = recipe.goldCost * repeats;
      const totalCost = scaleCost(recipe.cost, repeats);

      if (s.gold < totalGold) return state;
      if (!canAffordMaterials(s, totalCost)) return state;

      s.gold -= totalGold;
      consumeMaterials(s, totalCost);

      s.crafting = job
        ? { recipeId: job.recipeId, remaining: job.remaining, queued: Math.min(MAX_QUEUE, job.queued + repeats) }
        : { recipeId: recipe.id, remaining: recipe.craftTime, queued: repeats - 1 };

      return s;
    }

    case 'cancelCraft': {
      if (!state.crafting) return state;
      const s = clone(state);
      s.crafting = null;
      return s;
    }

    case 'equip': {
      const s = clone(state);
      const instance = s.inventory.find((i) => i.uid === action.uid);
      if (!instance) return state;
      const def = ITEMS[instance.defId];
      if (!def || def.slot === 'material') return state;
      // Erneut anklicken ändert nichts — und soll das Protokoll nicht fluten.
      if (s.equipped[def.slot] === instance.uid) return state;
      s.equipped[def.slot] = instance.uid;
      addLog(s, `${def.name} ausgerüstet.`, 'system');
      return s;
    }

    case 'unequip': {
      const s = clone(state);
      if (!s.equipped[action.slot]) return state;
      delete s.equipped[action.slot];
      return s;
    }

    case 'sell': {
      const s = clone(state);
      const index = s.inventory.findIndex((i) => i.uid === action.uid);
      if (index < 0) return state;

      // Ausgerüstete Gegenstände gehören dem Helden und lassen sich nicht verkaufen.
      if (Object.values(s.equipped).includes(action.uid)) return state;

      const instance = s.inventory[index];
      const def = ITEMS[instance.defId];
      const mult = QUALITIES[instance.quality].mult;
      const price = Math.max(1, Math.round(def.sellPrice * mult));
      s.inventory.splice(index, 1);
      s.gold += price;
      addLog(s, `${def.name} verkauft für ${price} Gold.`, 'system');
      return s;
    }

    case 'use': {
      const s = clone(state);
      const index = s.inventory.findIndex((i) => i.uid === action.uid);
      if (index < 0) return state;
      const instance = s.inventory[index];
      const def = ITEMS[instance.defId];
      if (!def?.use) return state;

      if (def.use.healPercent) {
        const player = computePlayerStats(s);
        if (s.hp >= player.maxHp) return state;
        s.hp = Math.min(player.maxHp, s.hp + player.maxHp * def.use.healPercent);
        addLog(s, `${def.name} getrunken.`, 'system');
      } else if (def.use.buff) {
        if (s.buff) return state;
        const b = def.use.buff;
        s.buff = {
          name: def.name,
          icon: def.icon,
          stats: b.stats,
          attackTime: b.attackTime ?? 0,
          crit: b.crit ?? 0,
          remaining: b.duration,
        };
        addLog(s, `${def.name} wirkt.`, 'system');
      }

      s.inventory.splice(index, 1);
      return s;
    }

    case 'upgrade': {
      const s = clone(state);
      const def = BUILDINGS[action.buildingId];
      if (!def) return state;
      const current = s.buildings[def.id] ?? 0;
      if (current >= def.maxLevel) return state;
      const cost = buildingCost(def, current);
      if (s.gold < cost) return state;
      s.gold -= cost;
      s.buildings[def.id] = current + 1;
      addLog(s, `${def.name} auf Stufe ${current + 1} ausgebaut.`, 'system');
      return s;
    }

    case 'hunt': {
      const s = clone(state);
      const def = ENEMIES[action.enemyId];
      if (!def) return state;
      const zone = ZONES_BY_ID[s.zoneId];
      if (!zone || !zone.enemies.includes(def.id)) return state;
      s.hp = Math.max(s.hp, 1);
      spawnEnemy(s, def.id, false);
      addLog(s, `Du jagst ${def.icon} ${def.name}.`, 'system');
      return s;
    }

    case 'stopHunt': {
      if (!state.combat) return state;
      const s = clone(state);
      s.combat = null;
      return s;
    }

    case 'travel': {
      const s = clone(state);
      const zone = ZONES_BY_ID[action.zoneId];
      if (!zone || s.level < zone.unlockLevel) return state;
      s.zoneId = zone.id;
      s.combat = null;
      addLog(s, `Du reist nach ${zone.name}.`, 'system');
      return s;
    }

    case 'camp': {
      const s = clone(state);
      if (s.combat || s.campCooldown > 0) return state;
      const player = computePlayerStats(s);
      if (s.hp >= player.maxHp) return state;
      s.hp = Math.min(player.maxHp, s.hp + player.maxHp * CAMP_HEAL_PERCENT);
      s.campCooldown = CAMP_COOLDOWN;
      addLog(s, 'Du schlägst dein Lager auf und ruhst dich.', 'system');
      return s;
    }

    case 'applyOffline':
      return applyOffline(state, action.seconds);

    case 'replace':
      return action.state;

    case 'newGame': {
      const s = createInitialState(action.now, action.classId);
      s.charName = action.charName.trim() || s.charName;
      addLog(s, `Willkommen in Azeroth, ${s.charName}.`, 'system');
      return s;
    }

    case 'reset':
      return createInitialState(action.now, getClass(state.classId).id);

    default:
      return state;
  }
}

function tick(state: GameState, dt: number): GameState {
  const s = clone(state);

  s.playTime += dt;

  if (s.campCooldown > 0) s.campCooldown = Math.max(0, s.campCooldown - dt);
  if (s.buff) {
    s.buff.remaining -= dt;
    if (s.buff.remaining <= 0) s.buff = null;
  }

  tickProduction(s, dt);
  tickCrafting(s, dt);
  tickCombat(s, dt);

  const player = computePlayerStats(s);
  if (s.combat) {
    s.hp = Math.min(s.hp, player.maxHp);
  } else if (s.hp < player.maxHp) {
    const regen = OUT_OF_COMBAT_REGEN + player.regenBonus;
    s.hp = Math.min(player.maxHp, s.hp + player.maxHp * regen * dt);
  }

  return s;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    materials: { ...state.materials },
    buildings: { ...state.buildings },
    inventory: state.inventory.map((i) => ({ ...i, stats: { ...i.stats } })),
    equipped: { ...state.equipped },
    crafting: state.crafting ? { ...state.crafting } : null,
    buff: state.buff ? { ...state.buff, stats: { ...state.buff.stats } } : null,
    combat: state.combat ? { ...state.combat } : null,
    quests: Object.fromEntries(
      Object.entries(state.quests).map(([id, q]) => [id, { ...q, progress: [...q.progress] }]),
    ),
    completedQuests: [...state.completedQuests],
    log: state.log,
    stats: {
      ...state.stats,
      killsByEnemy: { ...state.stats.killsByEnemy },
      craftedByRecipe: { ...state.stats.craftedByRecipe },
      gatheredBy: { ...state.stats.gatheredBy },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Offline-Fortschritt                                                 */
/* ------------------------------------------------------------------ */

export function applyOffline(state: GameState, rawSeconds: number): GameState {
  const seconds = Math.min(Math.max(0, rawSeconds), OFFLINE_CAP_SECONDS);
  if (seconds < 5) return state;

  const s = clone(state);
  const beforeMaxHp = computePlayerStats(s).maxHp;

  tickProduction(s, seconds, OFFLINE_EFFICIENCY);
  tickCrafting(s, seconds);

  s.stats.offlineSeconds += seconds;
  s.playTime += seconds;

  const afterMaxHp = computePlayerStats(s).maxHp;
  if (afterMaxHp > beforeMaxHp) s.hp = Math.min(afterMaxHp, s.hp + (afterMaxHp - beforeMaxHp));

  syncQuests(s);

  addLog(
    s,
    `Während ${Math.round(seconds / 60)} Minuten Abwesenheit haben deine Betriebe gearbeitet.`,
    'system',
  );

  return s;
}

export function buildOfflineReport(
  before: GameState,
  after: GameState,
  seconds: number,
): OfflineReport {
  const materials: Partial<Record<MaterialId, number>> = {};
  for (const id of Object.keys(after.materials) as MaterialId[]) {
    const diff = after.materials[id] - before.materials[id];
    if (diff > 0.5) materials[id] = diff;
  }
  return {
    seconds: Math.min(seconds, OFFLINE_CAP_SECONDS),
    gold: Math.max(0, after.gold - before.gold),
    materials,
    levelsGained: after.level - before.level,
  };
}
