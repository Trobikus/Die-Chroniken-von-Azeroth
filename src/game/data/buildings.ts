import type { BuildingDef, MaterialId } from '../types';

export const BUILDINGS: Record<string, BuildingDef> = {
  saegewerk: {
    id: 'saegewerk',
    name: 'Sägewerk',
    icon: '🏚️',
    description: 'Ein Waldarbeiter hackt pausenlos Herzenholz für die Werkstatt.',
    produces: 'holz',
    baseProduction: 0.25,
    baseCost: 20,
    costGrowth: 1.55,
    maxLevel: 50,
  },
  gerberei: {
    id: 'gerberei',
    name: 'Gerberei',
    icon: '🏭',
    description: 'Felle werden gegerbt und zu Leder für Rüstungen.',
    produces: 'leder',
    baseProduction: 0.15,
    baseCost: 35,
    costGrowth: 1.6,
    maxLevel: 50,
  },
  pilzfarm: {
    id: 'pilzfarm',
    name: 'Pilzfarm',
    icon: '🪴',
    description: 'Feuchte Schwämme wachsen im Dunkeln der Höhlen.',
    produces: 'schwamm',
    baseProduction: 0.2,
    baseCost: 28,
    costGrowth: 1.58,
    maxLevel: 50,
  },
  steinbruch: {
    id: 'steinbruch',
    name: 'Steinbruch',
    icon: '⛰️',
    description: 'Bruchstein für Waffen und Bauwerke.',
    produces: 'stein',
    baseProduction: 0.1,
    baseCost: 55,
    costGrowth: 1.65,
    maxLevel: 50,
  },
};

export const BUILDING_ORDER = ['saegewerk', 'gerberei', 'pilzfarm', 'steinbruch'];

export const BUILDING_FOR_MATERIAL: Record<MaterialId, string> = {
  holz: 'saegewerk',
  leder: 'gerberei',
  schwamm: 'pilzfarm',
  stein: 'steinbruch',
};

export function buildingCost(def: BuildingDef, currentLevel: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export function buildingProduction(def: BuildingDef, level: number): number {
  return def.baseProduction * level;
}
