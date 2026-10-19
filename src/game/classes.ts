import type { MaterialId, Stats } from './types';

export type ClassId = 'krieger' | 'waldlaeufer' | 'paladin';

export interface ClassDef {
  id: ClassId;
  name: string;
  race: string;
  color: string;
  colorSoft: string;
  /** Attribute, mit denen der Charakter startet. */
  startingStats: Partial<Stats>;
  startingMaterials: Partial<Record<MaterialId, number>>;
  startingGold: number;
  /** Prozentpunkte weniger erlittener Schaden. */
  damageReduction: number;
  /** Sekunden zusätzliche Angriffszeit – schwere Waffen sind langsamer. */
  attackTimeBonus: number;
  /** Prozentpunkte extra Krit-Chance. */
  critBonus: number;
  /** Zusätzliche Regeneration pro Sekunde, in Prozentpunkten der Max-LP. */
  regenBonus: number;
  role: string;
  tagline: string;
  description: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  krieger: {
    id: 'krieger',
    name: 'Krieger',
    race: 'Mensch',
    color: '#c0392b',
    colorSoft: 'rgba(192, 57, 43, 0.18)',
    startingStats: { staerke: 3, vitalitaet: 2 },
    startingMaterials: { stein: 4, holz: 3 },
    startingGold: 10,
    damageReduction: 0.06,
    attackTimeBonus: 0.15,
    critBonus: 0,
    regenBonus: 0,
    role: 'Nahkampf · Tank',
    tagline: 'Ein Schild, ein Schwert, keine Fragen.',
    description:
      'Der Krieger hält die Linie. Jeder Schlag wiegt schwerer, doch die Waffe kommt langsam: viel Schaden pro Treffer, weniger Schaden pro Sekunde. Sechs Prozent des eingehenden Schadens schluckt seine Haltung.',
  },
  waldlaeufer: {
    id: 'waldlaeufer',
    name: 'Waldläufer',
    race: 'Mensch',
    color: '#5b8c3a',
    colorSoft: 'rgba(91, 140, 58, 0.18)',
    startingStats: { agilitaet: 4 },
    startingMaterials: { leder: 4, holz: 4 },
    startingGold: 10,
    damageReduction: 0,
    attackTimeBonus: 0,
    critBonus: 4,
    regenBonus: 0.005,
    role: 'Fernkampf · Treffer',
    tagline: 'Ein Pfeil. Sehr schnell.',
    description:
      'Der Waldläufer lebt vom Präzisionsschuss. Seine Agilität verkürzt die Angriffsfolge und verschafft ihm vier Prozentpunkte extra Krit-Chance.',
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    race: 'Mensch',
    color: '#d4a017',
    colorSoft: 'rgba(212, 160, 23, 0.18)',
    startingStats: { vitalitaet: 4, agilitaet: 1 },
    startingMaterials: { schwamm: 4, leder: 2 },
    startingGold: 15,
    damageReduction: 0.02,
    attackTimeBonus: 0,
    critBonus: 1,
    regenBonus: 0.012,
    role: 'Unterstützung · Heilung',
    tagline: 'Das Licht schließt die Wunden.',
    description:
      'Der Paladin trägt das Licht. Er startet mit dem höchsten Vitalitätswert, heilt sich außerhalb des Kampfes merklich schneller und hält einen Teil der Angriffe ab.',
  },
};

export const CLASS_ORDER: ClassId[] = ['krieger', 'waldlaeufer', 'paladin'];

export function getClass(id: string | undefined): ClassDef {
  return CLASSES[(id ?? 'krieger') as ClassId] ?? CLASSES.krieger;
}

const NAME_FIRST = [
  'Thalion',
  'Bran',
  'Kess',
  'Varok',
  'Muru',
  'Hild',
  'Gunnar',
  'Elda',
  'Torvald',
  'Sif',
];

export function suggestName(classId: ClassId, index = 0): string {
  const base = NAME_FIRST[index % NAME_FIRST.length];
  return `${base}, ${CLASSES[classId].name}`;
}
