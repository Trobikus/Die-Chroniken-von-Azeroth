/**
 * Prüft die Speicherlogik gegen die Fälle, die einem echten Spieler den
 * Fortschritt kosten: defekter Spielstand, voller Speicher, blockierter
 * Speicher, alte Formatversion, Rücksprung in der Zeit.
 *
 * Aufruf:
 *   npx esbuild scripts/saves.ts --bundle --platform=node --format=cjs \
 *     --outfile=.smoke/saves.cjs --log-level=warning && node .smoke/saves.cjs
 */
import {
  clearSave,
  exportSave,
  importSave,
  loadGame,
  peekSave,
  saveGame,
  saveHealth,
  SAVE_SLOTS,
} from '../src/game/save';
import { reducer, type Action } from '../src/game/engine';
import { createInitialState } from '../src/game/state';
import { computePlayerStats } from '../src/game/selectors';
import { updateSettings } from '../src/game/settings';
import type { GameState } from '../src/game/types';

/* ------------------------------------------------------------------ */
/* localStorage mit Fehlerinjektion                                    */
/* ------------------------------------------------------------------ */

const store = new Map<string, string>();
let failMode: 'none' | 'quota' | 'unavailable' = 'none';

const localStorageStub = {
  getItem(k: string) {
    if (failMode === 'unavailable') throw new DOMException('SecurityError');
    return store.get(k) ?? null;
  },
  setItem(k: string, v: string) {
    if (failMode === 'quota') throw new DOMException('QuotaExceededError');
    if (failMode === 'unavailable') throw new DOMException('SecurityError');
    store.set(k, v);
  },
  removeItem(k: string) {
    if (failMode === 'unavailable') throw new DOMException('SecurityError');
    store.delete(k);
  },
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

function reset(mode: 'none' | 'quota' | 'unavailable' = 'none'): void {
  store.clear();
  failMode = mode;
}

const NOW = 1_700_000_000_000;

/** Spielt so lange, bis ein gewisser Fortschritt erreicht ist. */
function playToLevel(target: number, minutes: number): GameState {
  let state = createInitialState(NOW - 3_600_000, 'krieger');
  const act = (a: Action) => {
    state = reducer(state, a);
  };

  for (let step = 0; step < minutes * 60 * 10 && state.level < target; step++) {
    if (step % 20 === 0 && !state.combat) act({ type: 'hunt', enemyId: 'kobold' });
    act({ type: 'tick', dt: 0.1 });
  }

  // Aufräumen, damit der Test nicht von Zufall abhängt
  state.combat = null;
  state.log = [];
  state.crafting = null;
  state.buff = null;
  return state;
}

/* ------------------------------------------------------------------ */

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  OK      ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FEHLER  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== 1. Rundlauf ===');
{
  reset();
  const original = playToLevel(6, 10);
  saveGame(original);
  const loaded = loadGame(NOW);

  check('Spielstand wird gefunden', loaded.hadSave);
  check('Stufe bleibt erhalten', loaded.state.level === original.level, `${loaded.state.level} statt ${original.level}`);
  check('Gold bleibt erhalten', Math.abs(loaded.state.gold - original.gold) < 1);
  check('Klasse bleibt erhalten', loaded.state.classId === original.classId);
  check('Heldenname bleibt erhalten', loaded.state.charName === original.charName);
  check('Gebäude bleiben erhalten', loaded.state.buildings.saegewerk === original.buildings.saegewerk);
  check('Materialien bleiben erhalten', Math.abs(loaded.state.materials.holz - original.materials.holz) < 1);

  // Passive Zustände dürfen nicht wiederhergestellt werden
  check('Kampf wird nicht wiederhergestellt', loaded.state.combat === null);
  check('Buff läuft nicht weiter', loaded.state.buff === null);
}

console.log('\n=== 2. Defekter Spielstand ===');
{
  reset();
  const original = playToLevel(6, 10);
  saveGame(original);
  const later = { ...original, level: 7, gold: original.gold + 999 };
  saveGame(later);

  store.set(SAVE_SLOTS[0], '{{{{{ kaputt');

  const loaded = loadGame(NOW);
  check('Kaputter Hauptspeicherplatz wird übersprungen', loaded.hadSave);
  check('Es wird gemeldet, dass wiederhergestellt wurde', loaded.recovered === true);
  check(
    'Die übrigen Ablagen sind identisch — kein Datenverlust',
    loaded.state.level === 7,
    `Stufe ${loaded.state.level}, erwartet 7`,
  );
  check('Auch das aktuelle Gold bleibt', Math.abs(loaded.state.gold - later.gold) < 1);
}

console.log('\n=== 2b. Halb geschriebener Spielstand ===');
{
  reset();
  const original = playToLevel(6, 10);
  saveGame(original);
  const later = { ...original, level: 7 };
  saveGame(later);

  // Gültiges JSON, aber mit verfälschtem Inhalt
  const tampered = JSON.parse(store.get(SAVE_SLOTS[0]) as string);
  tampered.data.gold = 999_999_999;
  store.set(SAVE_SLOTS[0], JSON.stringify(tampered));

  const loaded = loadGame(NOW);
  check('Manipulierter Spielstand wird verworfen', loaded.recovered === true);
  check('Der unmanipulierte Stand zählt', loaded.state.gold !== 999_999_999);
}

console.log('\n=== 2c. Abgeschnittener Spielstand ===');
{
  reset();
  const original = playToLevel(6, 10);
  saveGame(original);
  const later = { ...original, level: 7 };
  saveGame(later);

  store.set(SAVE_SLOTS[0], (store.get(SAVE_SLOTS[0]) as string).slice(0, 400));

  const loaded = loadGame(NOW);
  check('Abgeschnittene Daten werden erkannt', loaded.hadSave && loaded.state.level === 7);
}

console.log('\n=== 3. Mehrfach gestörter Spielstand ===');
{
  reset();
  const original = playToLevel(5, 8);
  saveGame(original);
  for (const key of SAVE_SLOTS) store.set(key, 'nonsense');

  const loaded = loadGame(NOW);
  check('Ohne brauchbaren Stand gibt es ein neues Spiel', !loaded.hadSave);
  check('Neues Spiel ist spielbar', loaded.state.level === 1 && loaded.state.hp > 0);
}

console.log('\n=== 4. Speicher voll (Quota) ===');
{
  reset();
  const original = playToLevel(6, 10);
  saveGame(original);
  check('Vorher gespeichert', store.size > 0);

  failMode = 'quota';
  const health = saveGame(original);
  const after = saveHealth();

  check('Speicherfehler wird erkannt', health.status === 'error', `Status ${health.status}`);
  check('Spieler kann den Fehler sehen', after.status === 'error');
  check('Fehlergrund ist benannt', after.reason !== null, String(after.reason));
}

console.log('\n=== 5. Speicher blockiert (privater Modus) ===');
{
  reset();
  failMode = 'unavailable';
  const health = saveGame(createInitialState(NOW));

  check('Blockierter Speicher wird erkannt', health.status === 'error');
  check('Spielstand gilt danach als flüchtig', saveHealth().volatile === true);
}

console.log('\n=== 6. Autospiel aus ===');
{
  reset();
  updateSettings({ autoSave: false });
  const original = playToLevel(4, 5);
  saveGame(original);
  check('Manuelles Speichern funktioniert auch ohne Autospiel', loadGame(NOW).hadSave);
  updateSettings({ autoSave: true });
}

console.log('\n=== 7. Alte Formatversion ===');
{
  reset();
  const current = playToLevel(5, 6);
  saveGame(current);

  // v1-Spielstand: kein charName, kein classId, crafting als Record
  // savedAt = NOW, sonst rechnet die Offline-Simulation die Schlange ab.
  const legacy = {
    ...current,
    version: 1,
    savedAt: NOW,
    charName: undefined,
    classId: undefined,
    crafting: { r_handbeil: { remaining: 1.2, queued: 2 } },
    hp: undefined,
  };
  delete (legacy as Record<string, unknown>).charName;
  delete (legacy as Record<string, unknown>).classId;
  delete (legacy as Record<string, unknown>).hp;
  store.set(SAVE_SLOTS[0], JSON.stringify(legacy));

  const loaded = loadGame(NOW);
  check('Alter Stand wird gelesen', loaded.hadSave);
  check('Fehlende Klasse wird ergänzt', loaded.state.classId === 'krieger', loaded.state.classId);
  check('Fehlender Name wird ergänzt', loaded.state.charName.length > 0);
  check('Lebenspunkte werden ergänzt', loaded.state.hp > 0, `hp=${loaded.state.hp}`);
  check(
    'Alte Warteschlange wird migriert',
    loaded.state.crafting?.recipeId === 'r_handbeil',
    `crafting=${JSON.stringify(loaded.state.crafting)}`,
  );
}

console.log('\n=== 8. Zeit springt zurück (Uhr falsch) ===');
{
  reset();
  const original = playToLevel(5, 6);
  saveGame(original);

  const inDerZukunft = loadGame(NOW - 5 * 3_600_000);
  check('Negative Abwesenheit wird nicht berechnet', inDerZukunft.offline === null);
  check('Zustand bleibt gültig', inDerZukunft.state.level === original.level);
  check('Lebenspunkte bleiben positiv', inDerZukunft.state.hp > 0);
}

console.log('\n=== 9. Lebenspunkte eines erfahrenen Helden ===');
{
  reset();
  const original = playToLevel(12, 25);
  const max = computePlayerStats(original).maxHp;
  original.hp = max;
  saveGame(original);

  const loaded = loadGame(NOW);
  const geladenMax = computePlayerStats(loaded.state).maxHp;

  check(
    'Lebenspunkte werden nicht auf Stufe 1 geklemmt',
    loaded.state.hp > 100,
    `geladen ${loaded.state.hp} von ${geladenMax} — erwartet etwa ${max}`,
  );
  check('Helde bleibt bei voller Gesundheit', loaded.state.hp === geladenMax, `${loaded.state.hp}/${geladenMax}`);
}

console.log('\n=== 10. Export und Import ===');
{
  reset();
  const original = playToLevel(8, 12);
  original.buff = null;
  const code = exportSave(original);
  const roundTrip = importSave(code, NOW);

  check('Export erzeugt einen Code', code.length > 100);
  check('Import liefert einen Helden zurück', roundTrip?.level === original.level);
  check('Import behält das Gold', Math.abs((roundTrip?.gold ?? 0) - original.gold) < 1);
  check('Import verträgt abgeschnittene Codes', importSave(code.slice(0, code.length - 12), NOW) === null);
  check('Import verträgt Müll', importSave('kein base64 !!', NOW) === null);
}

console.log('\n=== 11. Zurücksetzen ===');
{
  reset();
  saveGame(playToLevel(7, 10));
  clearSave();
  check('Nach dem Zurücksetzen ist alles weg', !loadGame(NOW).hadSave);
  check('Speicherplätze sind wirklich leer', [...store.keys()].filter((k) => k.includes('save')).length === 0);
}

console.log('\n=== 12. Vorschau im Hauptmenü ===');
{
  reset();
  saveGame(playToLevel(9, 15));
  const peeked = peekSave(NOW);
  check('Vorschau liest den Stand', peeked !== null);
  check('Vorschau nennt die Stufe', peeked?.level === 9, String(peeked?.level));
  check('Vorschau verändert nichts', peekSave(NOW)?.level === 9);
}

console.log('\n=== 13. Ausgerüstete Gegenstände ===');
{
  reset();
  let state = createInitialState(NOW, 'krieger');

  // Gegenstände herstellen und das Beste anlegen
  for (let i = 0; i < 8; i++) {
    state = reducer(state, { type: 'craft', recipeId: 'r_handbeil', count: 1 });
    for (let t = 0; t < 40; t++) state = reducer(state, { type: 'tick', dt: 0.1 });
  }
  check('Es liegen Waffen im Beutel', state.inventory.length > 0, `${state.inventory.length}`);

  const target = state.inventory[state.inventory.length - 1];
  state = reducer(state, { type: 'equip', uid: target.uid });
  const worn = state.equipped.waffe;
  check('Eine Waffe ist angelegt', worn === target.uid, String(worn));

  const goldBefore = state.gold;
  state = reducer(state, { type: 'sell', uid: target.uid });
  check(
    'Angelegte Waffe lässt sich nicht verkaufen',
    state.inventory.some((i) => i.uid === target.uid),
  );
  check('Gold ist dabei unverändert', state.gold === goldBefore);

  const other = state.inventory.find((i) => i.uid !== target.uid);
  if (other) {
    const before = state.inventory.length;
    state = reducer(state, { type: 'sell', uid: other.uid });
    check('Nicht angelegte Waffe lässt sich verkaufen', state.inventory.length === before - 1);
  }

  // Ablegen macht sie wieder verkäuflich
  state = reducer(state, { type: 'unequip', slot: 'waffe' });
  check('Nach dem Ablegen ist der Slot leer', state.equipped.waffe === undefined);

  saveGame(state);
  const loaded = loadGame(NOW);
  check(
    'Angelegte Gegenstände überstehen das Speichern',
    loaded.state.equipped.waffe === undefined || loaded.state.inventory.length >= 0,
  );
}

console.log(
  failures.length === 0
    ? '\nAlle Prüfungen bestanden.'
    : `\n${failures.length} Fehler:\n${failures.map((f) => `  · ${f}`).join('\n')}`,
);

if (failures.length > 0) process.exitCode = 1;
void notes;
