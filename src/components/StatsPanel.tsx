import { useState } from 'react';
import { getClass } from '../game/classes';
import { clearSave, exportSave, importSave, saveGame } from '../game/save';
import { fmt, fmtDuration, fmtInt } from '../game/format';
import { useGame } from '../game/gameContext';
import { useSaveHealth } from '../hooks/useSaveHealth';
import { Panel } from './Panel';

export function StatsPanel() {
  const { state, dispatch, lastSavedAt } = useGame();
  const health = useSaveHealth();
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

  /** Lädt den Exportcode als Datei — die einzige Sicherung, die ein Browser nicht wegräumt. */
  const downloadSave = () => {
    const code = exportSave(state);
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `chroniken-${state.charName.replace(/[^\w-]/g, '')}-${stamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback('Datei heruntergeladen — lege sie an einem sicheren Ort ab.');
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

      <h3 className="section-title">Sicherung</h3>
      <div className={`backup-state ${health.status}`}>
        <span className="backup-dot" aria-hidden="true" />
        <div>
          <b>
            {health.status === 'error'
              ? 'Es wird derzeit nicht gesichert'
              : 'Dein Fortschritt wird laufend gesichert'}
          </b>
          <span>
            {health.status === 'error'
              ? health.reason === 'quota'
                ? 'Der Speicher des Browsers ist voll. Aufräumen oder in einem anderen Fenster weiterspielen.'
                : 'Der Browser blockiert das Schreiben. Im privaten Fenster geht das nicht.'
              : `Zuletzt erfolgreich: ${lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString('de-DE') : 'gerade eben'}. Der Stand liegt dreifach im Browser.`}
          </span>
        </div>
      </div>

      <div className="backup-warning">
        <b>Browserdaten können verschwinden.</b> Wer den Zwischenspeicher leert oder die Seite aus
        den Browserdaten entfernt, verliert den Helden. Bewahre deshalb ab und zu deinen
        Exportcode auf — im privaten Fenster nützt er dir allerdings nichts.
      </div>

      <div className="save-actions">
        <button
          className="btn"
          onClick={() => {
            const result = saveGame(state);
            setFeedback(
              result.status === 'ok'
                ? `Gesichert um ${new Date(result.lastOkAt ?? Date.now()).toLocaleTimeString('de-DE')}.`
                : 'Fehlgeschlagen — siehe Hinweis oben.',
            );
          }}
        >
          💾 Jetzt speichern
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            const code = exportSave(state);
            try {
              await navigator.clipboard.writeText(code);
              setFeedback('Exportcode in die Zwischenablage kopiert — jetzt irgendwo aufbewahren.');
            } catch {
              setImportText(code);
              setFeedback('Kopieren nicht möglich — der Code steht jetzt im Feld darunter.');
            }
          }}
        >
          📤 Sicherungskopie erstellen
        </button>
        <button className="btn btn-camp" onClick={downloadSave}>
          💾 Als Datei sichern
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
