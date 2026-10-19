/**
 * Smoke-Test der Spiellogik ohne Browser.
 * Startet mit einem frischen Spielstand, simuliert 30 Minuten Spielzeit
 * und spielt dabei so, wie ein Mensch es täte: jagen, herstellen, ausbauen.
 *
 * Aufruf:
 *   npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm --outfile=.smoke/smoke.mjs
 *   node .smoke/smoke.mjs
 */
import { applyOffline, buildOfflineReport, reducer, type Action } from '../src/game/engine';
import { CLASSES, CLASS_ORDER } from '../src/game/classes';
import { BUILDINGS, BUILDING_FOR_MATERIAL, BUILDING_ORDER } from '../src/game/data/buildings';
import { ITEMS } from '../src/game/data/items';
import { RECIPES } from '../src/game/data/recipes';
import { ENEMIES, ZONES } from '../src/game/data/zones';
import { EQUIP_SLOTS, computePlayerStats, itemScore } from '../src/game/selectors';
import { createInitialState } from '../src/game/state';
import type { EquipSlot, GameState, MaterialId } from '../src/game/types';

const DT = 0.1;
const MINUTES = 30;
const STEPS = MINUTES * 60 * 10;

let state: GameState = createInitialState(Date.now());

function act(action: Action): void {
  state = reducer(state, action);
}

/** Zieht das beste Teil pro Ausrüstungsplatz an. */
function equipBest(): void {
  for (const slot of EQUIP_SLOTS) {
    const best = state.inventory
      .filter((i) => ITEMS[i.defId]?.slot === slot)
      .sort((a, b) => itemScore(b) - itemScore(a))[0];
    if (!best || state.equipped[slot] === best.uid) continue;
    act({ type: 'equip', uid: best.uid });
  }
}

/** Herstellt das passende Rezept im 5er-Pack – es gibt nur einen Handwerksplatz. */
function craftSomething(): boolean {
  const order = [...RECIPES];
  const maxHp = computePlayerStats(state).maxHp;

  // Wer verletzt ist, braucht erstmal einen Heiltrank.
  if (state.hp < maxHp * 0.85) {
    const potionIndex = order.findIndex((r) => r.id === 'r_heiltrank');
    if (potionIndex >= 0) order.unshift(...order.splice(potionIndex, 1));
  }

  for (const recipe of order) {
    if (state.crafting && state.crafting.recipeId !== recipe.id) return false;
    if (state.crafting && state.crafting.queued >= 15) return false;

    const reqLevel = ITEMS[recipe.results[0].defId]?.reqLevel ?? 1;
    if (state.level < reqLevel) continue;

    for (const count of [5, 1]) {
      const before = state.crafting;
      act({ type: 'craft', recipeId: recipe.id, count });
      if (state.crafting !== before && state.crafting?.recipeId === recipe.id) return true;
    }
  }
  return false;
}

/** Baut den Betrieb aus, dessen Material dem Bot am fehlenden. */
function upgradeSomething(): boolean {
  const scarce = (Object.entries(BUILDING_FOR_MATERIAL) as [MaterialId, string][])
    .filter(([material]) => (state.materials[material] ?? 0) < 25)
    .sort((a, b) => (state.materials[a[0]] ?? 0) - (state.materials[b[0]] ?? 0));

  const order = [
    ...scarce.map(([, building]) => building),
    ...BUILDING_ORDER.filter((id) => !scarce.some(([, b]) => b === id)),
  ];

  for (const id of order) {
    const before = state.gold;
    act({ type: 'upgrade', buildingId: id });
    if (state.gold !== before) return true;
  }
  return false;
}

/** Reiset in die höchste freigeschaltete Zone und jagt dort das beste erreichbare Ziel. */
function huntSomething(): void {
  const reachable = ZONES.filter((z) => state.level >= z.unlockLevel);
  const zone = reachable.at(-1) ?? ZONES[0];
  if (state.zoneId !== zone.id) act({ type: 'travel', zoneId: zone.id });

  const target = zone.enemies
    .map((id) => ENEMIES[id])
    .filter((e) => state.level >= e.minLevel && state.level <= e.maxLevel + 2)
    .sort((a, b) => b.xp - a.xp)[0];

  if (target && state.combat?.enemyId !== target.id) {
    act({ type: 'hunt', enemyId: target.id });
  }
}

function drinkIfHurt(): void {
  const maxHp = computePlayerStats(state).maxHp;
  if (state.hp >= maxHp * 0.7) return;

  for (let i = 0; i < 12; i++) {
    const potion = state.inventory.find((i2) => ITEMS[i2.defId]?.use?.healPercent);
    if (!potion || state.hp >= maxHp * 0.95) break;
    act({ type: 'use', uid: potion.uid });
  }
}

/** Ein "Mensch" klickt alle zwei Sekunden. */
function playStep(): void {
  craftSomething();
  equipBest();
  upgradeSomething();

  const maxHp = computePlayerStats(state).maxHp;
  if (state.hp < maxHp * 0.2 && !state.inventory.some((i) => ITEMS[i.defId]?.use?.healPercent)) {
    // Kein Trank in Reichweite: Kampf abbrechen und sich draußen erholen.
    if (state.combat) act({ type: 'stopHunt' });
    if (state.campCooldown <= 0) act({ type: 'camp' });
    return;
  }

  huntSomething();
  drinkIfHurt();
}

/* ------------------------------------------------------------------ */

const levelUps: { second: number; level: number }[] = [];
let lastLevel = state.level;
let lowestHpRatio = 1;
let potionsDrunk = 0;

for (let step = 0; step < STEPS; step++) {
  if (step % 20 === 0) playStep();

  const potionsBefore = state.inventory.filter((i) => ITEMS[i.defId]?.use?.healPercent).length;
  act({ type: 'tick', dt: DT });
  const potionsAfter = state.inventory.filter((i) => ITEMS[i.defId]?.use?.healPercent).length;
  potionsDrunk += Math.max(0, potionsBefore - potionsAfter);

  const maxHp = computePlayerStats(state).maxHp;
  if (maxHp > 0) lowestHpRatio = Math.min(lowestHpRatio, state.hp / maxHp);

  if (state.level !== lastLevel) {
    lastLevel = state.level;
    levelUps.push({ second: step * DT, level: state.level });
  }
}

const player = computePlayerStats(state);
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(`=== ${MINUTES} Minuten simuliert ===`);
console.log(`Stufe        ${state.level} (${Math.floor(state.xp)} EP offen)`);
console.log(`Gold         ${Math.floor(state.gold)}`);
console.log(
  `Materialien  ` +
    Object.entries(state.materials)
      .map(([k, v]) => `${k}:${Math.floor(v)}`)
      .join('  '),
);
console.log(`Betriebe     ${Object.entries(state.buildings).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`Kills ${state.stats.kills} · Tode ${state.stats.deaths} · Hergestellt ${state.stats.crafted} · Quests ${state.stats.questsDone}`);
console.log(`Tränke getrunken ${potionsDrunk} · niedrigste LP ${(lowestHpRatio * 100).toFixed(0)}%`);
console.log(
  `Kills je Gegner  ` +
    Object.entries(state.stats.killsByEnemy)
      .map(([k, v]) => `${k}:${v}`)
      .join('  '),
);
console.log(
  `Charakter    ${Math.round(player.damage)} Schaden · ${player.dps.toFixed(1)} DPS · ${player.maxHp} LP · ${player.crit.toFixed(1)}% Krit`,
);
console.log(`Ausrüstung   ${EQUIP_SLOTS.map((s) => `${s}=${state.equipped[s as EquipSlot] ? ITEMS[state.inventory.find((i) => i.uid === state.equipped[s as EquipSlot])?.defId ?? '']?.name ?? '?' : '—'}`).join(', ')}`);
console.log(`Inventar     ${state.inventory.length} Gegenstände`);

console.log(`\n=== Levelaufstiege (${levelUps.length}) ===`);
for (const e of levelUps) console.log(`  ${clock(e.second).padStart(5)}  Stufe ${e.level}`);

console.log('\n=== Offline-Test (4 Stunden) ===');
// Damit die Warteschlange beim Offline-Test auch wirklich etwas zu tun hat.
state.materials.leder += 400;
state.materials.schwamm += 400;
act({ type: 'craft', recipeId: 'r_lederpanzer', count: 10 });
console.log(`  Warteschlange vor Offline: ${state.crafting?.queued ?? 0} Lederpanzer`);

const beforeOffline = state;
const afterOffline = applyOffline(state, 4 * 3600);
const report = buildOfflineReport(beforeOffline, afterOffline, 4 * 3600);
console.log(`  Gold       +${Math.round(report.gold)}`);
console.log(`  Stufen     +${report.levelsGained} (${beforeOffline.level} -> ${afterOffline.level})`);
console.log(
  `  Material   ` +
    Object.entries(report.materials)
      .map(([k, v]) => `${k}:+${Math.round(v ?? 0)}`)
      .join('  '),
);
console.log(`  Quests     ${beforeOffline.stats.questsDone} -> ${afterOffline.stats.questsDone}`);
console.log(`  Hergestellt ${beforeOffline.stats.crafted} -> ${afterOffline.stats.crafted}`);
console.log(`  Inventar   ${beforeOffline.inventory.length} -> ${afterOffline.inventory.length}`);
console.log(`  Handwerk   ${afterOffline.crafting ? 'läuft noch' : 'fertig'}`);

console.log('\n=== Offline-Test (25 Stunden -> gedeckelt) ===');
const cappedBefore = afterOffline;
const cappedAfter = applyOffline(afterOffline, 25 * 3600);
console.log(`  Holz       +${Math.round((cappedAfter.materials.holz ?? 0) - (cappedBefore.materials.holz ?? 0))} (Deckel: 8h)`);
console.log(`  Max 8h sind +${Math.round(BUILDINGS.saegewerk.baseProduction * cappedBefore.buildings.saegewerk * 8 * 3600 * 0.5)}`);

console.log('\n=== Klassenvergleich (Stufe 1, ohne Ausrüstung) ===');
console.log('Klasse      DPS(erw.)  Schaden   Angriffszeit   LP     Krit    Schadensminderung');
for (const id of CLASS_ORDER) {
  const s = createInitialState(Date.now(), id);
  const p = computePlayerStats(s);
  const expected = (p.damage * (1 + p.crit / 100)) / p.attackTime;
  console.log(
    `${CLASSES[id].name.padEnd(10)}  ${expected.toFixed(2).padStart(6)}   ` +
      `${p.damage.toFixed(1).padStart(6)}   ${p.attackTime.toFixed(2).padStart(6)}s   ` +
      `${String(p.maxHp).padStart(4)}   ${p.crit.toFixed(1).padStart(5)}%   ` +
      `${(p.damageReduction * 100).toFixed(0).padStart(3)}%`,
  );
}

console.log('\n=== Invarianten ===');
const problems: string[] = [];
if (state.gold < 0) problems.push(`Gold negativ: ${state.gold}`);
if (state.hp < 0 || state.hp > computePlayerStats(state).maxHp) problems.push(`HP außerhalb [0,max]: ${state.hp}`);
for (const [k, v] of Object.entries(state.materials)) {
  if (v < 0) problems.push(`Material ${k} negativ: ${v}`);
}
if (state.level < 1) problems.push('Level < 1');
if (!Number.isFinite(state.rngSeed)) problems.push('RNG-Seed nicht endlich');
if (state.stats.kills === 0) problems.push('Keine Kills — Kampf funktioniert nicht');
if (state.stats.deaths === 0 && state.level >= 10) {
  problems.push('Bis Stufe 10 nie gestorben — Gegner haben keine Zähne');
}
if (lowestHpRatio > 0.5) {
  problems.push(`Niedrigste LP ${(lowestHpRatio * 100).toFixed(0)}% — Kampf ist zu leicht`);
}
if (afterOffline.stats.crafted <= beforeOffline.stats.crafted) {
  problems.push('Offline-Crafting hat nichts fertiggestellt');
}
if (afterOffline.inventory.length < beforeOffline.inventory.length) {
  problems.push('Offline-Zustand hat Gegenstände vernichtet');
}

// Klassen müssen sich spürbar unterscheiden
{
  const stats = CLASS_ORDER.map((id) => computePlayerStats(createInitialState(Date.now(), id)));
  const damages = stats.map((p) => Math.round(p.damage));
  const hps = stats.map((p) => Math.round(p.maxHp));
  const crits = stats.map((p) => p.crit);
  if (new Set(damages).size < 2) {
    problems.push(`Alle Klassen haben identischen Schaden: ${damages.join('/')}`);
  }
  if (new Set(hps).size < 2) problems.push(`Alle Klassen haben identische LP: ${hps.join('/')}`);
  if (new Set(crits).size < 2) problems.push(`Alle Klassen haben identische Krit: ${crits.join('/')}`);
  if (stats.some((p) => p.damageReduction < 0 || p.damageReduction >= 0.5)) {
    problems.push('Schadensminderung einer Klasse liegt außerhalb des sinnvollen Bereichs');
  }
}

console.log(problems.length === 0 ? '  OK – keine Auffälligkeiten' : problems.map((p) => `  ${p}`).join('\n'));

if (problems.length > 0) process.exitCode = 1;
