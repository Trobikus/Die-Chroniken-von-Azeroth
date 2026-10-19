/**
 * Rendert jedes Panel der Oberfläche mit einem "erfahrenen" Spielstand.
 * Fängt Abstürze im Render-Pfad ab, die der Logik-Smoke-Test nicht sieht.
 *
 * Aufruf:
 *   npx esbuild scripts/render.tsx --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=.smoke/render.cjs --log-level=warning && node .smoke/render.cjs
 */
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';
import { BuildingsPanel } from '../src/components/BuildingsPanel';
import { CraftingPanel } from '../src/components/CraftingPanel';
import { HuntPanel } from '../src/components/HuntPanel';
import { InventoryPanel } from '../src/components/InventoryPanel';
import { QuestPanel } from '../src/components/QuestPanel';
import { StatsPanel } from '../src/components/StatsPanel';
import { reducer, type Action } from '../src/game/engine';
import { ITEMS } from '../src/game/data/items';
import { RECIPES } from '../src/game/data/recipes';
import { ENEMIES, ZONES } from '../src/game/data/zones';
import { EQUIP_SLOTS } from '../src/game/selectors';
import { createInitialState } from '../src/game/state';
import { peekSave } from '../src/game/save';
import { AboutScreen } from '../src/screens/AboutScreen';
import { CharacterSelect } from '../src/screens/CharacterSelect';
import { MainMenu } from '../src/screens/MainMenu';
import { OptionsScreen } from '../src/screens/OptionsScreen';
import { GameProvider } from '../src/components/GameProvider';
import type { GameState } from '../src/game/types';

const SAVE_KEY = 'wow-incremental-save';
const store = new Map<string, string>();

const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

(globalThis as Record<string, unknown>).window = {
  localStorage: localStorageStub,
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
(globalThis as Record<string, unknown>).document = {
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    ...(globalThis as Record<string, unknown>).navigator,
    clipboard: { writeText: async () => {} },
  },
});

/* ------------------------------------------------------------------ */
/* Spielstand erzeugen, damit alle Panels echte Daten sehen            */
/* ------------------------------------------------------------------ */

function buildRichSave(): GameState {
  let state = createInitialState(Date.now() - 45 * 60 * 1000, 'waldlaeufer');
  const act = (action: Action) => {
    state = reducer(state, action);
  };

  for (let step = 0; step < 12 * 60 * 10; step++) {
    if (step % 20 === 0) {
      for (const recipe of RECIPES) {
        if (state.crafting && state.crafting.recipeId !== recipe.id) break;
        const before = state.crafting;
        act({ type: 'craft', recipeId: recipe.id, count: 3 });
        if (state.crafting !== before) break;
      }
      for (const slot of EQUIP_SLOTS) {
        const best = state.inventory
          .filter((i) => ITEMS[i.defId]?.slot === slot)
          .sort((a, b) => (b.stats.staerke ?? 0) - (a.stats.staerke ?? 0))[0];
        if (best) act({ type: 'equip', uid: best.uid });
      }
      const zone = ZONES.filter((z) => state.level >= z.unlockLevel).at(-1);
      if (zone && state.zoneId !== zone.id) act({ type: 'travel', zoneId: zone.id });
      const target = zone?.enemies
        .map((id) => ENEMIES[id])
        .filter((e) => state.level >= e.minLevel)
        .sort((a, b) => b.xp - a.xp)[0];
      if (target && state.combat?.enemyId !== target.id) {
        act({ type: 'hunt', enemyId: target.id });
      }
    }
    act({ type: 'tick', dt: 0.1 });
  }

  // Guarantee a few things the panels must survive: a full bag, a buff, a depleted
  // combat state and an empty quest log entry.
  state.buff = {
    name: 'Trank der Wildnis',
    icon: '🍺',
    stats: { staerke: 4, agilitaet: 4, vitalitaet: 10 },
    attackTime: -0.08,
    crit: 3,
    remaining: 42,
  };
  state.campCooldown = 12;
  state.savedAt = Date.now() - 5 * 60 * 1000;

  return state;
}

const rich = buildRichSave();
store.set(SAVE_KEY, JSON.stringify(rich));

/* ------------------------------------------------------------------ */

let failures = 0;

function check(label: string, node: () => unknown): void {
  try {
    const html = renderToStaticMarkup(node() as never);
    if (html.length < 200) throw new Error('Verdächtig leeres Markup');
    console.log(`  OK      ${label} (${html.length} Zeichen)`);
  } catch (error) {
    failures++;
    console.log(`  FEHLER  ${label}: ${(error as Error).message}`);
  }
}

console.log(`=== Oberfläche (Stufe ${rich.level}, ${rich.inventory.length} Gegenstände) ===`);

const withProvider = (node: () => unknown) => () => h(GameProvider, null, node() as never);
const noop = () => {};

check('komplette App', () => h(App));
check('Hauptmenü (mit Charakter)', () =>
  h(MainMenu, {
    summary: peekSave(Date.now()),
    onContinue: noop,
    onNewGame: noop,
    onOptions: noop,
    onAbout: noop,
    onLoadImported: noop,
  }),
);
check('Hauptmenü (ohne Charakter)', () =>
  h(MainMenu, {
    summary: null,
    onContinue: noop,
    onNewGame: noop,
    onOptions: noop,
    onAbout: noop,
    onLoadImported: noop,
  }),
);
check('Charaktererstellung', () =>
  h(CharacterSelect, { existing: null, onCreate: noop, onCancel: noop }),
);
check('Charaktererstellung (mit Überschreiben)', () =>
  h(CharacterSelect, { existing: peekSave(Date.now()), onCreate: noop, onCancel: noop }),
);
check('Optionen', () => h(OptionsScreen, { onBack: noop }));
check('Über das Spiel', () => h(AboutScreen, { onBack: noop }));
check('Jagd', withProvider(() => h(HuntPanel)));
check('Handwerk', withProvider(() => h(CraftingPanel)));
check('Betriebe', withProvider(() => h(BuildingsPanel)));
check('Tasche', withProvider(() => h(InventoryPanel)));
check('Aufträge', withProvider(() => h(QuestPanel)));
check('Chronik', withProvider(() => h(StatsPanel)));

// Grenzfälle
console.log('\n=== Grenzfälle ===');

store.clear();
check('App mit frischem Spielstand', () => h(App));

const stripped: GameState = { ...rich, inventory: [], equipped: {}, combat: null, quests: {} };
store.set(SAVE_KEY, JSON.stringify(stripped));
check('App ohne Gegenstände und Queste', () => h(App));

const broken = JSON.parse(JSON.stringify(rich)) as Record<string, unknown>;
delete broken.materials;
delete broken.stats;
delete broken.buildings;
store.set(SAVE_KEY, JSON.stringify(broken));
check('App mit unvollständigem Spielstand', () => h(App));

store.set(SAVE_KEY, '{{{ kaputt');
check('App mit zerstörtem Spielstand', () => h(App));

store.set(SAVE_KEY, JSON.stringify({ ...rich, savedAt: Date.now() - 40 * 3600 * 1000 }));
check('App nach 40 Stunden Abwesenheit', () => h(App));

console.log(failures === 0 ? '\nOK – Oberfläche rendert fehlerfrei' : `\n${failures} Fehler`);
if (failures > 0) process.exitCode = 1;
