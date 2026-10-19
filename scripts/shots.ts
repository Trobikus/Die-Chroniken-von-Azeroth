/**
 * Erzeugt Screenshots des veröffentlichten Spiels für die README.
 *
 * Startet Edge headless über das DevTools-Protokoll, spielt sich bis zum
 * gewünschten Bildschirm durch und legt PNGs unter docs/ ab.
 *
 * Aufruf:
 *   npx esbuild scripts/shots.ts --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=.smoke/shots.cjs --log-level=warning && node .smoke/shots.cjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { reducer, type Action } from '../src/game/engine';
import { ITEMS } from '../src/game/data/items';
import { RECIPES } from '../src/game/data/recipes';
import { ENEMIES, ZONES } from '../src/game/data/zones';
import { EQUIP_SLOTS, itemScore } from '../src/game/selectors';
import { createInitialState } from '../src/game/state';
import type { GameState } from '../src/game/types';

const SITE = process.env.SHOT_URL ?? 'https://trobikus.github.io/Die-Chroniken-von-Azeroth/';
const OUT_DIR = 'docs';
const VIEWPORT = { width: 1600, height: 900 };
const DEBUG_PORT = 9333;

// Wichtig: Der Profilpfad darf keine Leerzeichen enthalten, sonst zerlegt
// Chromium die Argumentliste und startet gar nicht erst.
const PROFILE = join(tmpdir(), 'chroniken-edge-profile');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findBrowser(): string {
  for (const path of EDGE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error('Kein Chromium-Browser gefunden.');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Minimaler CDP-Client über die eingebaute WebSocket-Unterstützung      */
/* ------------------------------------------------------------------ */

class Cdp {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private handlers = new Map<string, ((p: any) => void)[]>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (event: MessageEvent) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const handler of this.handlers.get(msg.method) ?? []) handler(msg.params);
      }
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('WebSocket-Fehler')), { once: true });
    });
    return new Cdp(socket);
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    const payload: Record<string, unknown> = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Zeitüberschreitung bei ${method}`));
        }
      }, 30_000);
    });
  }

  once(method: string, timeoutMs = 20_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Ereignis ${method} nicht erhalten`)), timeoutMs);
      const handler = (p: any) => {
        clearTimeout(timer);
        void p;
        resolve();
      };
      const list = this.handlers.get(method) ?? [];
      list.push(handler);
      this.handlers.set(method, list);
    });
  }

  close(): void {
    this.socket.close();
  }
}

/* ------------------------------------------------------------------ */
/* Spielstand für die Ingame-Bilder                                     */
/* ------------------------------------------------------------------ */

function buildSave(): GameState {
  let state = createInitialState(Date.now() - 40 * 60 * 1000, 'waldlaeufer');
  const act = (a: Action) => {
    state = reducer(state, a);
  };

  const equipBest = () => {
    for (const slot of EQUIP_SLOTS) {
      const best = state.inventory
        .filter((i) => ITEMS[i.defId]?.slot === slot)
        .sort((a, b) => itemScore(b) - itemScore(a))[0];
      if (best) act({ type: 'equip', uid: best.uid });
    }
  };

  // Runde 1: Nur jagen, bis eine ordentliche Stufe erreicht ist. Kein Handwerk,
  // damit der Held nicht an unbrauchbarer Grundausrüstung juckt.
  for (let step = 0; step < 30 * 60 * 10; step++) {
    if (step % 20 === 0) {
      const zone = ZONES.filter((z) => state.level >= z.unlockLevel).at(-1) ?? ZONES[0];
      if (state.zoneId !== zone.id) act({ type: 'travel', zoneId: zone.id });
      const target = zone.enemies
        .map((id) => ENEMIES[id])
        .filter((e) => state.level >= e.minLevel && state.level <= e.maxLevel)
        .sort((a, b) => a.damage - b.damage)[0];
      if (target && state.combat?.enemyId !== target.id) {
        act({ type: 'hunt', enemyId: target.id });
      }
    }
    act({ type: 'tick', dt: 0.1 });
  }

  // Runde 2: Ausrüstung herstellen und das Beste anziehen.
  for (const recipe of RECIPES) {
    if (state.level < (ITEMS[recipe.results[0].defId]?.reqLevel ?? 1)) continue;
    for (let round = 0; round < 6; round++) {
      const before = state.crafting;
      act({ type: 'craft', recipeId: recipe.id, count: 3 });
      if (state.crafting === before) break;
      let guard = 0;
      while (state.crafting && guard++ < 200) act({ type: 'tick', dt: 0.1 });
    }
    equipBest();
  }

  // Runde 3: Endzustand für die Bilder — Zone passend zur Stufe, laufender Kampf.
  const zone = ZONES.filter((z) => state.level >= z.unlockLevel).at(-1) ?? ZONES[0];
  act({ type: 'travel', zoneId: zone.id });
  equipBest();

  const target = zone.enemies
    .map((id) => ENEMIES[id])
    .filter((e) => state.level >= e.minLevel && state.level <= e.maxLevel)
    .sort((a, b) => b.hp - a.hp)[0];

  if (target) {
    act({ type: 'hunt', enemyId: target.id });
    // Genug Ticks, damit beide Lebensbalken halb voll sind.
    for (let i = 0; i < 90; i++) act({ type: 'tick', dt: 0.1 });
  }

  state.log = state.log.slice(0, 12);
  state.savedAt = Date.now();
  return state;
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(PROFILE, { recursive: true, force: true });

  const browser = findBrowser();
  const child = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--force-device-scale-factor=1.5',
      // Kein URL-Argument: "--headless=new" verträgt keine weiteren Targets.
    ],
    { stdio: 'ignore' },
  );

  let version: any;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) {
    child.kill();
    throw new Error('Browser antwortet nicht auf dem Debug-Port.');
  }

  const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { ...VIEWPORT, deviceScaleFactor: 1.5, mobile: false },
    sessionId,
  );

  const evaluate = (expression: string) =>
    cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);

  async function shoot(file: string, waitMs = 900): Promise<void> {
    await sleep(waitMs);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(OUT_DIR, file), Buffer.from(data, 'base64'));
    console.log(`  gespeichert  docs/${file}`);
  }

  // Spielstand hinterlegen. localStorage braucht erst die richtige Origin.
  console.log(`Lade ${SITE}`);
  await cdp.send('Page.navigate', { url: SITE }, sessionId);
  await sleep(3500);

  const fresh = createInitialState(Date.now(), 'krieger');
  await evaluate(`localStorage.setItem('wow-incremental-save', ${JSON.stringify(JSON.stringify(fresh))})`);
  await sleep(400);

  // 1 – Hauptmenü ohne Charakter
  await shoot('01-hauptmenue.png', 1200);

  // 2 – Charaktererstellung
  await evaluate(`document.querySelectorAll('.main-menu .menu-item')[1].click(); true`);
  await shoot('02-charaktererstellung.png', 1100);

  // 3 – Mit gespieltem Stand durchstarten
  const save = buildSave();
  await evaluate(`localStorage.setItem('wow-incremental-save', ${JSON.stringify(JSON.stringify(save))})`);
  await cdp.send('Page.reload', {}, sessionId);
  await sleep(2500);
  await evaluate(`document.querySelector('.main-menu .menu-item').click(); true`);
  await sleep(2000);

  // Ein Kampf überlebt das Speichern absichtlich nicht, also hier starten.
  await evaluate(`document.querySelectorAll('.nameplate .btn-hunt')[1].click(); true`);
  await shoot('03-jagd.png', 3200);

  // 4 – Handwerk
  await evaluate(`document.querySelectorAll('.tabs .tab')[1].click(); true`);
  await shoot('04-handwerk.png', 900);

  // 5 – Tasche
  await evaluate(`document.querySelectorAll('.tabs .tab')[3].click(); true`);
  await shoot('05-tasche.png', 900);

  // 6 – Aufträge
  await evaluate(`document.querySelectorAll('.tabs .tab')[4].click(); true`);
  await shoot('06-auftraege.png', 900);

  cdp.close();
  child.kill();
  await sleep(600);
  rmSync(PROFILE, { recursive: true, force: true });
  console.log(`\nFertig — ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error('Fehlgeschlagen:', (error as Error).message);
  process.exitCode = 1;
});
