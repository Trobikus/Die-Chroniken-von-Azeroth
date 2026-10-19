import { getClass } from './classes';
import { ITEMS } from './data/items';
import { levelBonus } from './data/level';
import type { EquipSlot, GameState, ItemInstance, Stats } from './types';
import { ZERO_STATS } from './data/materials';

export const EQUIP_SLOTS: EquipSlot[] = ['waffe', 'brust', 'beine', 'ring', 'amulett'];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  waffe: 'Waffe',
  brust: 'Brust',
  beine: 'Beine',
  ring: 'Ring',
  amulett: 'Amulett',
};

export interface PlayerStats {
  maxHp: number;
  damage: number;
  attackTime: number;
  crit: number;
  stats: Stats;
  dps: number;
  /** 0..1 – Anteil des erlittenen Schadens, den die Klasse abmildert. */
  damageReduction: number;
  /** Zusätzliche Regeneration pro Sekunde in Prozentpunkten der Max-LP. */
  regenBonus: number;
}

export interface GearPiece {
  uid: string;
  instance: ItemInstance;
  def: (typeof ITEMS)[string];
}

export function equippedItems(state: GameState): Partial<Record<EquipSlot, GearPiece>> {
  const out: Partial<Record<EquipSlot, GearPiece>> = {};
  for (const slot of EQUIP_SLOTS) {
    const uid = state.equipped[slot];
    if (!uid) continue;
    const instance = state.inventory.find((i) => i.uid === uid);
    if (!instance) continue;
    const def = ITEMS[instance.defId];
    if (!def || def.slot !== slot) continue;
    out[slot] = { uid, instance, def };
  }
  return out;
}

export function computePlayerStats(state: GameState): PlayerStats {
  const level = levelBonus(state.level);
  const klass = getClass(state.classId);
  const gear = equippedItems(state);

  let str = klass.startingStats.staerke ?? 0;
  let agi = klass.startingStats.agilitaet ?? 0;
  let vit = klass.startingStats.vitalitaet ?? 0;
  let attackTime = 0;
  let crit = klass.critBonus;

  for (const piece of Object.values(gear)) {
    if (!piece) continue;
    str += piece.instance.stats.staerke ?? 0;
    agi += piece.instance.stats.agilitaet ?? 0;
    vit += piece.instance.stats.vitalitaet ?? 0;
    attackTime += piece.instance.attackTime;
    crit += piece.instance.crit;
  }

  const buff = state.buff;
  if (buff) {
    str += buff.stats.staerke ?? 0;
    agi += buff.stats.agilitaet ?? 0;
    vit += buff.stats.vitalitaet ?? 0;
    attackTime += buff.attackTime;
    crit += buff.crit;
  }

  const stats: Stats = {
    staerke: Math.round(str),
    agilitaet: Math.round(agi),
    vitalitaet: Math.round(vit),
  };

  const maxHp = Math.round(level.maxHp + vit * 2.4);
  const damage = level.damage + str * 1.35;
  const finalAttackTime = Math.max(
    0.45,
    level.attackTime + attackTime + klass.attackTimeBonus - agi * 0.004,
  );
  const finalCrit = Math.min(75, level.crit + crit + agi * 0.12);

  return {
    maxHp,
    damage,
    attackTime: finalAttackTime,
    crit: finalCrit,
    stats,
    dps: damage / finalAttackTime,
    damageReduction: klass.damageReduction,
    regenBonus: klass.regenBonus,
  };
}

export function inventoryDef(instance: ItemInstance) {
  return ITEMS[instance.defId];
}

export function emptyStats(): Stats {
  return { ...ZERO_STATS };
}

/** Differenz der Werte eines Items gegenüber dem aktuell ausgerüsteten. */
export function statDelta(
  state: GameState,
  candidate: ItemInstance,
): { staerke: number; agilitaet: number; vitalitaet: number; attackTime: number; crit: number } {
  const def = ITEMS[candidate.defId];
  const slot = def?.slot;
  const equipped = slot && slot !== 'material' ? state.equipped[slot] : undefined;
  const current = equipped ? state.inventory.find((i) => i.uid === equipped) : undefined;

  const pick = (inst: ItemInstance | undefined, key: 'staerke' | 'agilitaet' | 'vitalitaet') =>
    inst?.stats[key] ?? 0;

  return {
    staerke: pick(candidate, 'staerke') - pick(current, 'staerke'),
    agilitaet: pick(candidate, 'agilitaet') - pick(current, 'agilitaet'),
    vitalitaet: pick(candidate, 'vitalitaet') - pick(current, 'vitalitaet'),
    attackTime: candidate.attackTime - (current?.attackTime ?? 0),
    crit: candidate.crit - (current?.crit ?? 0),
  };
}

/** Grobe Bewertung eines Items, um den "Besser oder schlechter?"-Pfeil zu bestimmen. */
export function itemScore(instance: ItemInstance): number {
  return (
    (instance.stats.staerke ?? 0) * 14 +
    (instance.stats.agilitaet ?? 0) * 9 +
    (instance.stats.vitalitaet ?? 0) * 4 -
    instance.attackTime * 120 +
    instance.crit * 6
  );
}
