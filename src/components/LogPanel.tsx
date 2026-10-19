import { useGame } from '../game/gameContext';

export function LogPanel() {
  const { state } = useGame();

  return (
    <section className="log-panel">
      <header className="panel-head">
        <h2>
          <span className="panel-icon">📜</span>Kampfprotokoll
        </h2>
      </header>
      <div className="log-body">
        {state.log.length === 0 ? (
          <p className="hint">Noch nichts passiert. Ein Anfang ist gemacht.</p>
        ) : (
          <ul>
            {state.log.map((entry) => (
              <li key={entry.id} className={`log-line log-${entry.kind}`}>
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
