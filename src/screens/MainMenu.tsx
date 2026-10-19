import { useState } from 'react';
import { GameLogo } from '../components/GameLogo';
import { getClass } from '../game/classes';
import { ZONES } from '../game/data/zones';
import { importSave, type SaveSummary } from '../game/save';
import type { GameState } from '../game/types';
import { MenuBackdrop, RealmFooter } from './chrome';

export interface MainMenuProps {
  summary: SaveSummary | null;
  onContinue: () => void;
  onNewGame: () => void;
  onOptions: () => void;
  onAbout: () => void;
  onLoadImported: (state: GameState) => void;
}

type View = 'root' | 'import' | 'exit';

export function MainMenu({
  summary,
  onContinue,
  onNewGame,
  onOptions,
  onAbout,
  onLoadImported,
}: MainMenuProps) {
  const [view, setView] = useState<View>('root');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<SaveSummary | null>(null);

  const handleImport = () => {
    const loaded = importSave(code, Date.now());
    if (!loaded) {
      setError(
        'Dieser Code lässt sich nicht lesen. Bitte prüfen, ob er vollständig kopiert wurde.',
      );
      return;
    }
    setError(null);
    setImported(summarize(loaded));
  };

  const startImported = () => {
    const loaded = importSave(code, Date.now());
    if (loaded) onLoadImported(loaded);
  };

  return (
    <div className="menu-screen">
      <MenuBackdrop />

      <div className="menu-content">
        <GameLogo />

        {view === 'root' && (
          <nav className="main-menu">
            <button className="menu-item primary" onClick={onContinue} disabled={!summary}>
              <span className="menu-item-label">Spiel fortsetzen</span>
              {summary && (
                <span className="menu-item-hint">
                  {summary.charName} · Stufe {summary.level}
                </span>
              )}
            </button>

            <button className="menu-item primary" onClick={onNewGame}>
              <span className="menu-item-label">Neues Spiel</span>
            </button>

            <button className="menu-item" onClick={() => setView('import')}>
              <span className="menu-item-label">Spielstand importieren</span>
            </button>

            <button className="menu-item" onClick={onOptions}>
              <span className="menu-item-label">Optionen</span>
            </button>

            <button className="menu-item" onClick={onAbout}>
              <span className="menu-item-label">Über das Spiel</span>
            </button>

            <button className="menu-item" onClick={() => setView('exit')}>
              <span className="menu-item-label">Beenden</span>
            </button>
          </nav>
        )}

        {view === 'import' && (
          <div className="menu-dialog">
            <h2>Spielstand importieren</h2>
            <p>
              Füge den Exportcode ein, den du in der Chronik deines Helden gefunden hast. Der
              bestehende Stand auf diesem Gerät wird dabei überschrieben.
            </p>
            <textarea
              className="import-area"
              placeholder="Exportcode hier einfügen …"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setImported(null);
                setError(null);
              }}
              rows={4}
            />
            {error && <p className="menu-error">{error}</p>}
            {imported && (
              <p className="menu-preview">
                Gefunden: <b>{imported.charName}</b> ({getClass(imported.classId).name}), Stufe{' '}
                {imported.level}, {imported.zoneName}.
              </p>
            )}
            <div className="menu-dialog-actions">
              <button className="menu-button" onClick={handleImport} disabled={!code.trim()}>
                Code prüfen
              </button>
              <button className="menu-button" onClick={startImported} disabled={!imported}>
                Spielstand laden
              </button>
              <button className="menu-button ghost" onClick={() => setView('root')}>
                Zurück
              </button>
            </div>
          </div>
        )}

        {view === 'exit' && (
          <div className="menu-dialog">
            <h2>Azeroth ist gerettet.</h2>
            <p>
              Der Browser bleibt offen, aber das Spiel wird beendet. Dein Fortschritt wurde
              gespeichert.
            </p>
            <div className="menu-dialog-actions">
              <button className="menu-button" onClick={() => setView('root')}>
                Zurück zum Menü
              </button>
            </div>
          </div>
        )}
      </div>

      <RealmFooter />
    </div>
  );
}

function summarize(state: GameState): SaveSummary {
  return {
    charName: state.charName,
    classId: getClass(state.classId).id,
    level: state.level,
    gold: Math.floor(state.gold),
    zoneName: ZONES.find((z) => z.id === state.zoneId)?.name ?? '—',
    playTime: state.playTime,
    savedAt: state.savedAt,
    awaySeconds: 0,
  };
}
