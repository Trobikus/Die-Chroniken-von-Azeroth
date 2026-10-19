import { useState } from 'react';
import { getClass } from '../game/classes';
import { clearSave, exportSave, importSave, saveGame } from '../game/save';
import { fmt, fmtDuration, fmtInt } from '../game/format';
import { useGame } from '../game/gameContext';
import { Panel } from './Panel';

export function StatsPanel() {
  const { state, dispatch } = useGame();
  const [importText, setImportText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const klass = getClass(state.classId);

  const rows: [string, string][] = [
    ['Held', state.charName],
    ['Klasse', `${klass.name} (${klass.race})`],
    ['Stufe', fmtInt(state.level)],
    ['Erfahrung', fmtInt(state.xp)],
    ['Gold insgesamt verdient', fmt(state.stats.goldEarned)],
    ['Gegner besiegt', fmtInt(state.stats.kills)],
    ['Todesfälle', fmtInt(state.stats.deaths)],
    ['Gegenstände hergestellt', fmtInt(state.stats.crafted)],
    ['Aufträge abgeschlossen', fmtInt(state.stats.questsDone)],
    ['Spielzeit', fmtDuration(state.playTime)],
    ['Abwesenheit angerechnet', fmtDuration(state.stats.offlineSeconds)],
    ['Angelegt am', new Date(state.createdAt).toLocaleString('de-DE')],
  ];

  const doImport = () => {
    const loaded = importSave(importText, Date.now());
    if (!loaded) {
      setFeedback('Import fehlgeschlagen — der Code ist ungültig.');
      return;
    }
    dispatch({ type: 'replace', state: loaded });
    saveGame(loaded);
    setFeedback('Spielstand importiert.');
    setImportText('');
  };

  const doReset = () => {
    clearSave();
    dispatch({ type: 'reset', now: Date.now() });
    setConfirmReset(false);
    setFeedback('Neues Spiel gestartet.');
  };

  return (
    <Panel title="Chronik & Spielstand" icon="📖" subtitle="Alles, was dein Charakter bisher vollbracht hat.">
      <div className="stats-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="stat-row">
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>

      <h3 className="section-title">Spielstand</h3>
      <div className="save-actions">
        <button
          className="btn"
          onClick={() => {
            saveGame(state);
            setFeedback('Spielstand gespeichert.');
          }}
        >
          💾 Jetzt speichern
        </button>
        <button
          className="btn"
          onClick={async () => {
            const code = exportSave(state);
            try {
              await navigator.clipboard.writeText(code);
              setFeedback('Exportcode in die Zwischenablage kopiert.');
            } catch {
              setFeedback(code.slice(0, 400) + ' …');
            }
          }}
        >
          📤 Exportieren
        </button>
      </div>

      <textarea
        className="import-area"
        placeholder="Exportcode hier einfügen und Import drücken …"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      />
      <button className="btn" disabled={!importText.trim()} onClick={doImport}>
        📥 Importieren
      </button>

      {feedback && <p className="feedback">{feedback}</p>}

      <div className="danger-zone">
        <h3 className="section-title">Neues Spiel</h3>
        <p className="hint">Löscht Stufe, Gegenstände, Aufträge und Betriebe unwiderruflich.</p>
        {confirmReset ? (
          <div className="confirm-row">
            <span>Wirklich alles zurücksetzen?</span>
            <button className="btn btn-danger" onClick={doReset}>
              Ja, zurücksetzen
            </button>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Abbrechen
            </button>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Spielstand zurücksetzen
          </button>
        )}
      </div>
    </Panel>
  );
}
