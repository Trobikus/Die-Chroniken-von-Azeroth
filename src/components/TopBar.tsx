import { getClass } from '../game/classes';
import { BUILDINGS, BUILDING_FOR_MATERIAL, buildingProduction } from '../game/data/buildings';
import { MATERIAL_ORDER, MATERIALS } from '../game/data/materials';
import { xpToNext } from '../game/data/level';
import { fmt, fmtClock } from '../game/format';
import { useGame } from '../game/gameContext';
import { computePlayerStats } from '../game/selectors';

export function TopBar({ onExit }: { onExit: () => void }) {
  const { state } = useGame();
  const player = computePlayerStats(state);
  const needed = xpToNext(state.level);
  const klass = getClass(state.classId);

  return (
    <header className="topbar">
      <div className="player-frame-mini">
        <div className="mini-portrait">
          <span className="mini-level">{state.level}</span>
        </div>
        <div className="mini-body">
          <div className="mini-name" title={state.charName}>
            {state.charName}
          </div>
          <div className="mini-class" style={{ color: klass.color }}>
            {klass.name}
          </div>
          <div className="mini-bar xp" title={`${Math.floor(state.xp)} / ${needed} EP`}>
            <span style={{ width: `${Math.min(100, (state.xp / needed) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="topbar-vitals">
        <div className="vital-block">
          <span className="vital-label">Lebenspunkte</span>
          <div className="wow-bar health">
            <span
              className="wow-bar-fill"
              style={{ width: `${Math.min(100, (state.hp / player.maxHp) * 100)}%` }}
            />
            <b className="wow-bar-text">
              {Math.ceil(state.hp)} / {player.maxHp}
            </b>
          </div>
        </div>
      </div>

      <div className="topbar-stats">
        <div className="stat-slot gold" title="Gold">
          <span className="slot-icon">◈</span>
          <span className="slot-value">{fmt(state.gold)}</span>
        </div>
        {MATERIAL_ORDER.map((id) => {
          const buildingId = BUILDING_FOR_MATERIAL[id];
          const perSec = buildingProduction(BUILDINGS[buildingId], state.buildings[buildingId] ?? 0);
          return (
            <div
              className="stat-slot"
              key={id}
              title={`${MATERIALS[id].name}: +${fmt(perSec, 2)}/s`}
            >
              <span className="slot-icon">{MATERIALS[id].icon}</span>
              <span className="slot-value">{fmt(state.materials[id] ?? 0)}</span>
              {perSec > 0 && <span className="slot-rate">+{fmt(perSec, 2)}</span>}
            </div>
          );
        })}
      </div>

      <div className="topbar-right">
        {state.buff && (
          <div
            className="buff-chip"
            title={`${state.buff.name} — noch ${Math.ceil(state.buff.remaining)}s`}
          >
            {state.buff.icon} {Math.ceil(state.buff.remaining)}s
          </div>
        )}
        <div className="playtime" title="Spielzeit">
          {fmtClock(state.playTime)}
        </div>
        <button className="btn btn-menu-exit" onClick={onExit} title="Speichern und zum Hauptmenü">
          ☰ Hauptmenü
        </button>
      </div>
    </header>
  );
}
