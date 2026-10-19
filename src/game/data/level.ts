export function xpToNext(level: number): number {
  return Math.round(90 * Math.pow(level, 1.8));
}

export const MAX_LEVEL = 20;

export interface LevelCurveEntry {
  maxHp: number;
  damage: number;
  attackTime: number;
  crit: number;
}

const BASE_HP = 62;
const BASE_DAMAGE = 8;
const BASE_ATTACK_TIME = 1.6;
const BASE_CRIT = 2;

export function levelBonus(level: number): LevelCurveEntry {
  const n = Math.max(0, level - 1);
  return {
    maxHp: BASE_HP + n * 19,
    damage: BASE_DAMAGE + n * 2.1,
    attackTime: Math.max(0.7, BASE_ATTACK_TIME - n * 0.035),
    crit: BASE_CRIT + n * 0.3,
  };
}

/** Einheiten-Schaden pro Sekunde, den ein Gegner mit `damage` gegen `level` verursacht. */
export function enemyDamageAt(def: { damage: number; minLevel: number; maxLevel: number }, level: number): number {
  const span = def.maxLevel - def.minLevel;
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (level - def.minLevel) / span));
  return def.damage * (1 - t * 0.25);
}
