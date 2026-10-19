import { ENEMIES, ZONES } from '../game/data/zones';
import { ITEMS } from '../game/data/items';
import { CAMP_COOLDOWN } from '../game/engine';
import { fmt, fmtDuration, fmtInt } from '../game/format';
import { computePlayerStats } from '../game/selectors';
import { useGame } from '../game/gameContext';
import { Bar, Panel } from './Panel';

export function HuntPanel() {
  const { state, dispatch } = useGame();
  const player = computePlayerStats(state);
  const zone = ZONES.find((z) => z.id === state.zoneId) ?? ZONES[0];
  const combat = state.combat;
  const enemyDef = combat ? ENEMIES[combat.enemyId] : null;

  const potions = state.inventory.filter((i) => ITEMS[i.defId]?.use?.healPercent);

  return (
    <Panel
      title="Jagdgebiet"
      icon={zone.icon}
      subtitle={zone.description}
      action={
        <div className="zone-tabs">
          {ZONES.map((z) => {
            const locked = state.level < z.unlockLevel;
            return (
              <button
                key={z.id}
                className={`zone-tab ${z.id === zone.id ? 'active' : ''}`}
                disabled={locked}
                title={locked ? `Ab Stufe ${z.unlockLevel} erreichbar` : z.name}
                onClick={() => dispatch({ type: 'travel', zoneId: z.id })}
              >
                {locked ? '🔒' : z.icon} {z.name}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="enemy-list">
        {zone.enemies.map((id) => {
          const def = ENEMIES[id];
          const hunting = combat?.enemyId === id;
          const tooHigh = state.level < def.minLevel;
          const tooLow = state.level > def.maxLevel + 3;
          const tag = tooHigh ? 'Zu gefährlich' : tooLow ? 'Trivial' : def.elite ? 'Elite' : 'Passend';
          const tagClass = tooHigh ? 'danger' : tooLow ? 'dim' : def.elite ? 'elite' : 'good';

          return (
            <div
              key={id}
              className={`nameplate ${hunting ? 'targeted' : ''} ${def.elite ? 'elite' : ''}`}
            >
              <div className="plate-portrait">
                <span>{def.icon}</span>
              </div>

              <div className="plate-body">
                <div className="plate-title">
                  <span className="plate-name">{def.name}</span>
                  <span className="plate-level">Stufe {def.minLevel}–{def.maxLevel}</span>
                  <span className={`tag tag-${tagClass}`}>{tag}</span>
                </div>

                <Bar
                  value={def.hp}
                  max={def.hp}
                  compact
                  color="linear-gradient(180deg,#ff5b52,#c41e1e 55%,#6e0d0d)"
                />

                <div className="plate-stats">
                  <span title="Lebenspunkte">❤ {fmtInt(def.hp)}</span>
                  <span title="Schaden pro Treffer">⚔ {def.damage}</span>
                  <span title="Erfahrung">✦ {def.xp}</span>
                  <span title="Gold">◈ {def.gold[0]}–{def.gold[1]}</span>
                </div>

                <div className="plate-flavor">{def.flavor}</div>
              </div>

              <button
                className="btn btn-hunt"
                disabled={!!combat && !hunting}
                onClick={() => dispatch({ type: 'hunt', enemyId: id })}
              >
                {hunting ? 'Im Kampf' : 'Jagen'}
              </button>
            </div>
          );
        })}
      </div>

      <div className={`battlefield ${combat ? 'in-combat' : ''}`}>
        {combat && enemyDef ? (
          <>
            <div className="unit-frame player-frame">
              <div className="unit-portrait">
                <span>🧝</span>
                <span className="unit-level">{state.level}</span>
              </div>
              <div className="unit-body">
                <div className="unit-name">{state.charName}</div>
                <Bar
                  value={state.hp}
                  max={player.maxHp}
                  color="linear-gradient(180deg,#ff5b52,#c41e1e 55%,#6e0d0d)"
                />
                <div className="unit-meta">
                  {Math.ceil(player.damage)} Schaden / {player.attackTime.toFixed(2)}s ·{' '}
                  {fmt(player.crit)}% Krit · {fmt(player.dps)} DPS
                </div>
              </div>
            </div>

            <div className="versus">⚔</div>

            <div className={`unit-frame enemy-frame ${enemyDef.elite ? 'elite' : ''}`}>
              <div className="unit-portrait">
                <span>{enemyDef.icon}</span>
                <span className="unit-level">{combat.enemyLevel}</span>
              </div>
              <div className="unit-body">
                <div className="unit-name">
                  {enemyDef.name}
                  {enemyDef.elite && <span className="elite-mark">★</span>}
                </div>
                <Bar
                  value={combat.enemyHp}
                  max={combat.enemyMaxHp}
                  color="linear-gradient(180deg,#ff5b52,#c41e1e 55%,#6e0d0d)"
                />
                <div className="unit-meta">
                  {Math.ceil(combat.enemyHp)} / {combat.enemyMaxHp} LP ·{' '}
                  {enemyDef.attackTime.toFixed(2)}s pro Schlag
                </div>
              </div>
            </div>

            <div className="session-stats">
              <span>
                <b className="gold-text">{fmtInt(combat.sessionKills)}</b> erledigt
              </span>
              <span>
                <b className="gold-text">{fmt(combat.sessionGold)}</b> Gold
              </span>
              <span>
                <b className="xp-text">{fmt(combat.sessionXp)}</b> EP
              </span>
              <span className="muted">{fmtDuration((Date.now() - combat.startedAt) / 1000)}</span>
              <button className="btn btn-stop" onClick={() => dispatch({ type: 'stopHunt' })}>
                Jagd beenden
              </button>
            </div>
          </>
        ) : (
          <div className="battlefield-idle">
            <p>Wähle ein Ziel aus der Liste, um die Jagd zu beginnen.</p>
            <p className="hint">
              Deine Betriebe produzieren auch im Kampf weiter. Wer steht, verliert.
            </p>
          </div>
        )}
      </div>

      <div className="utility-row">
        <button
          className="btn btn-camp"
          disabled={!!combat || state.campCooldown > 0 || state.hp >= player.maxHp}
          onClick={() => dispatch({ type: 'camp' })}
          title={`Heilt sofort 30% der Lebenspunkte. Abklingzeit ${CAMP_COOLDOWN}s. Außerhalb des Kampfes heilst du ohnehin langsam.`}
        >
          🏕 Lager aufschlagen
          {state.campCooldown > 0 && ` (${Math.ceil(state.campCooldown)}s)`}
        </button>

        {potions.length > 0 ? (
          potions.slice(0, 3).map((p) => (
            <button
              key={p.uid}
              className="btn btn-potion"
              disabled={state.hp >= player.maxHp}
              onClick={() => dispatch({ type: 'use', uid: p.uid })}
            >
              {ITEMS[p.defId].icon} Trinken
            </button>
          ))
        ) : (
          <span className="hint">Keine Heiltränke — herstellbar unter Alchemie.</span>
        )}
      </div>
    </Panel>
  );
}
