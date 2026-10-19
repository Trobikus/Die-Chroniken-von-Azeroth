import {
  BUILDINGS,
  BUILDING_ORDER,
  buildingCost,
  buildingProduction,
} from '../game/data/buildings';
import { MATERIALS } from '../game/data/materials';
import { fmt, fmtPercent, fmtSigned } from '../game/format';
import { useGame } from '../game/gameContext';
import { Panel } from './Panel';

export function BuildingsPanel() {
  const { state, dispatch } = useGame();

  return (
    <Panel
      title="Gebietsbetriebe"
      icon="🏰"
      subtitle="Diese Betriebe arbeiten rund um die Uhr weiter — auch im Kampf, im Schlaf und offline (zu 50%)."
    >
      <div className="building-grid">
        {BUILDING_ORDER.map((id) => {
          const def = BUILDINGS[id];
          const level = state.buildings[id] ?? 0;
          const cost = buildingCost(def, level);
          const production = buildingProduction(def, level);
          const nextProduction = buildingProduction(def, level + 1);
          const maxed = level >= def.maxLevel;
          const affordable = state.gold >= cost;

          return (
            <div key={id} className={`building-card ${level === 0 ? 'inactive' : ''}`}>
              <div className="building-head">
                <span className="building-icon">{def.icon}</span>
                <div className="building-title">
                  <div>
                    {def.name} <span className="building-level">Stufe {level}</span>
                  </div>
                  <div className="building-produces">
                    {MATERIALS[def.produces].icon} {MATERIALS[def.produces].name}:{' '}
                    <b>{fmt(production, 2)}/s</b>
                    {!maxed && (
                      <span className="gain">
                        {' '}
                        → {fmt(nextProduction, 2)}/s ({fmtSigned(nextProduction - production, 2)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="building-desc">{def.description}</p>

              <button
                className="btn btn-upgrade"
                disabled={maxed || !affordable}
                onClick={() => dispatch({ type: 'upgrade', buildingId: id })}
              >
                {maxed ? 'Maximal' : `Ausbauen · 🪙 ${fmt(cost)}`}
              </button>

              {level === 0 && <p className="hint">Nicht gebaut — kein Output.</p>}

              {level > 0 && !maxed && (
                <p className="hint">
                  Nächste Stufe kostet 🪙 {fmt(buildingCost(def, level + 1))} (
                  {fmtPercent((buildingCost(def, level + 1) / cost) * 100 - 100)} mehr)
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="produktion-gesamt">
        <h4>Gesamtproduktion</h4>
        {BUILDING_ORDER.map((id) => {
          const def = BUILDINGS[id];
          const production = buildingProduction(def, state.buildings[id] ?? 0);
          return (
            <div key={id} className="produktion-row">
              <span>
                {MATERIALS[def.produces].icon} {MATERIALS[def.produces].name}
              </span>
              <span>{fmt(production, 2)}/s</span>
              <span className="muted">= {fmt(production * 60)}/min</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
