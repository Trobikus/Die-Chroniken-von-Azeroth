import { MATERIALS, MATERIAL_ORDER } from '../game/data/materials';
import { OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY } from '../game/engine';
import { fmt, fmtDuration } from '../game/format';
import { useGame } from '../game/gameContext';

export function OfflineModal() {
  const { offline, dismissOffline } = useGame();
  if (!offline) return null;

  const capped = offline.seconds >= OFFLINE_CAP_SECONDS - 1;

  return (
    <div className="modal-backdrop" onClick={dismissOffline}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🌙 Willkommen zurück</h2>
        <p className="modal-sub">
          Du warst {fmtDuration(offline.seconds)} abwesend. Deine Betriebe haben zu{' '}
          {Math.round(OFFLINE_EFFICIENCY * 100)}% weitergearbeitet
          {capped && ' (auf 8 Stunden gedeckelt)'}.
        </p>

        <ul className="offline-list">
          {offline.levelsGained > 0 && (
            <li>
              <span>⬆️ Stufen</span>
              <b>+{offline.levelsGained}</b>
            </li>
          )}
          {offline.gold > 0 && (
            <li>
              <span>🪙 Gold</span>
              <b>+{fmt(offline.gold)}</b>
            </li>
          )}
          {MATERIAL_ORDER.filter((id) => (offline.materials[id] ?? 0) > 0).map((id) => (
            <li key={id}>
              <span>
                {MATERIALS[id].icon} {MATERIALS[id].name}
              </span>
              <b>+{fmt(offline.materials[id] ?? 0)}</b>
            </li>
          ))}
        </ul>

        <button className="btn btn-primary" onClick={dismissOffline}>
          Weiter
        </button>
      </div>
    </div>
  );
}
