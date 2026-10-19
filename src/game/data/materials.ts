import type { MaterialDef, MaterialId, Quality, Stats } from '../types';

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  holz: { id: 'holz', name: 'Herzenholz', icon: '🪵', color: '#8b5a2b' },
  leder: { id: 'leder', name: 'Gerbtes Leder', icon: '🟫', color: '#a9743f' },
  schwamm: { id: 'schwamm', name: 'Feuchter Schwamm', icon: '🍄', color: '#9b59b6' },
  stein: { id: 'stein', name: 'Bruchstein', icon: '🪨', color: '#7f8c8d' },
};

export const MATERIAL_ORDER: MaterialId[] = ['holz', 'leder', 'schwamm', 'stein'];

/** Farben entsprechen den Item-Qualitätsstufen aus World of Warcraft. */
export const QUALITIES: Record<Quality, { label: string; mult: number; weight: number; color: string }> = {
  gewoehnlich: { label: 'Gewöhnlich', mult: 1.0, weight: 60, color: '#ffffff' },
  ungewoehnlich: { label: 'Ungewöhnlich', mult: 1.15, weight: 27, color: '#1eff00' },
  selten: { label: 'Selten', mult: 1.35, weight: 10, color: '#0070dd' },
  episch: { label: 'Episch', mult: 1.6, weight: 2.7, color: '#b373ff' },
  legendaer: { label: 'Legendär', mult: 1.95, weight: 0.3, color: '#ff8000' },
};

export const QUALITY_ORDER: Quality[] = ['gewoehnlich', 'ungewoehnlich', 'selten', 'episch', 'legendaer'];

export const ZERO_STATS: Stats = { staerke: 0, agilitaet: 0, vitalitaet: 0 };

export function totalStats(partial: Partial<Stats>[]): Stats {
  return partial.reduce<Stats>(
    (acc, s) => ({
      staerke: acc.staerke + (s.staerke ?? 0),
      agilitaet: acc.agilitaet + (s.agilitaet ?? 0),
      vitalitaet: acc.vitalitaet + (s.vitalitaet ?? 0),
    }),
    { ...ZERO_STATS },
  );
}
