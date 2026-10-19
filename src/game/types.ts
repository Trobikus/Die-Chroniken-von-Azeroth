export type MaterialId = 'holz' | 'leder' | 'schwamm' | 'stein';
export type ResourceKey = MaterialId | 'geld';

export type EquipSlot = 'waffe' | 'brust' | 'beine' | 'ring' | 'amulett';
export type ItemSlot = EquipSlot | 'material';

export type Quality = 'gewoehnlich' | 'ungewoehnlich' | 'selten' | 'episch' | 'legendaer';

export interface Stats {
  /** Stärke: +Schadensbonus pro Angriff */
  staerke: number;
  /** Agilität: +Krit-Chance, +Angriffsgeschwindigkeit */
  agilitaet: number;
  /** Vitalität: +Maximale Lebenspunkte */
  vitalitaet: number;
}

export type StatKey = keyof Stats;

export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  icon: string;
  baseStats: Partial<Stats>;
  /** negativ = schneller, positiv = langsamer (Sekunden pro Angriff) */
  attackTime?: number;
  /** Prozentpunkte */
  crit?: number;
  /** Für Tränke */
  use?: {
    heal?: number;
    healPercent?: number;
    buff?: { stats: Partial<Stats>; attackTime?: number; crit?: number; duration: number };
    description: string;
  };
  sellPrice: number;
  reqLevel: number;
}

export interface ItemInstance {
  uid: string;
  defId: string;
  quality: Quality;
  stats: Partial<Stats>;
  attackTime: number;
  crit: number;
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
  color: string;
}

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  profession: 'schmiedekunst' | 'lederverarbeitung' | 'alchemie';
  cost: Partial<Record<MaterialId, number>>;
  goldCost: number;
  /** Optionaler Gold-Ertrag pro Handwerk (Verkauf des Handwerks) */
  yieldGold?: number;
  craftTime: number;
  results: { defId: string; count: number }[];
}

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  produces: MaterialId;
  baseProduction: number;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export type EnemyId =
  | 'kobold'
  | 'kobold_berserker'
  | 'wildschwein'
  | 'raeuber'
  | 'nachtwolf'
  | 'alpha_nachtwolf';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  icon: string;
  minLevel: number;
  maxLevel: number;
  hp: number;
  damage: number;
  attackTime: number;
  xp: number;
  gold: [number, number];
  /** Drop-Chancen pro Kill: materialId -> Wahrscheinlichkeit */
  drops: Partial<Record<MaterialId, number>>;
  /** Chance auf ein Beute-Item (zufällig aus dieser Liste) */
  itemDrop?: { chance: number; pool: string[] };
  elite?: boolean;
  flavor: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  icon: string;
  minLevel: number;
  recommendedLevel: number;
  description: string;
  enemies: EnemyId[];
  unlockLevel: number;
}

export type ObjectiveKind = 'kill' | 'craft' | 'level' | 'gather';

export interface QuestObjective {
  kind: ObjectiveKind;
  targetId: string;
  count: number;
  label: string;
}

export interface QuestDef {
  id: string;
  name: string;
  icon: string;
  giver: string;
  minLevel: number;
  zoneId?: string;
  objectives: QuestObjective[];
  rewards: { gold: number; xp: number; items?: { defId: string; quality: Quality }[] };
  flavor: string;
}

export type QuestStatus = 'aktiv' | 'abgeschlossen' | 'belohnt';

export interface QuestState {
  status: QuestStatus;
  progress: number[];
  turnedInAt?: number;
}

export interface ActiveBuff {
  name: string;
  icon: string;
  stats: Partial<Stats>;
  attackTime: number;
  crit: number;
  remaining: number;
}

export interface CombatState {
  zoneId: string;
  enemyId: EnemyId;
  enemyHp: number;
  enemyMaxHp: number;
  enemyLevel: number;
  enemyAttackTimer: number;
  playerAttackTimer: number;
  kills: number;
  deaths: number;
  startedAt: number;
  sessionKills: number;
  sessionGold: number;
  sessionXp: number;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: 'kampf' | 'loot' | 'system' | 'tod' | 'level' | 'quest';
  at: number;
}

export interface CraftJob {
  recipeId: string;
  remaining: number;
  queued: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  savedAt: number;
  playTime: number;

  charName: string;
  classId: string;

  gold: number;
  xp: number;
  level: number;
  hp: number;

  materials: Record<MaterialId, number>;

  buildings: Record<string, number>;

  inventory: ItemInstance[];
  equipped: Partial<Record<EquipSlot, string>>;
  crafting: CraftJob | null;
  buff: ActiveBuff | null;
  campCooldown: number;

  combat: CombatState | null;

  quests: Record<string, QuestState>;
  completedQuests: string[];

  zoneId: string;
  log: LogEntry[];
  logCounter: number;

  stats: {
    kills: number;
    deaths: number;
    crafted: number;
    questsDone: number;
    goldEarned: number;
    offlineSeconds: number;
    killsByEnemy: Record<string, number>;
    craftedByRecipe: Record<string, number>;
    gatheredBy: Record<string, number>;
  };

  rngSeed: number;
  uidCounter: number;
}

export interface OfflineReport {
  seconds: number;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  levelsGained: number;
}
