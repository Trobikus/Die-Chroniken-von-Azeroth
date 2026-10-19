import { useGame } from '../game/gameContext';
import { useSaveHealth } from '../hooks/useSaveHealth';

const REASON_TEXT: Record<string, { title: string; body: string }> = {
  quota: {
    title: 'Dein Browser ist voll — es wird nicht gesichert',
    body: 'Der Speicherplatz reicht nicht mehr. Dein Held ist weiterhin spielbar, aber jeder Fortschritt seit der letzten Sicherung ist verloren, sobald du die Seite schließt. Aufräumen im Browser hilft.',
  },
  blocked: {
    title: 'Dein Browser blockiert das Speichern',
    body: 'Im privaten Fenster oder mit blockierten Cookies lässt sich nichts ablegen. Dein Held ist flüchtig — beim Schließen der Seite ist er weg. Öffne das Spiel in einem normalen Fenster.',
  },
  unknown: {
    title: 'Es konnte nicht gesichert werden',
    body: 'Der Browser meldet einen Fehler beim Schreiben. Dein Fortschritt ist nicht gesichert, bis das geklärt ist.',
  },
};

/**
 * Steht sichtbar im Bild, sobald das Sichern scheitert. Ein stiller
 * Datenverlust wäre das Schlimmste, was einem Incremental-Spiel passieren kann.
 */
export function SaveNotice() {
  const health = useSaveHealth();
  const { lastSavedAt, recovered } = useGame();

  if (health.status === 'error') {
    const reason = REASON_TEXT[health.reason ?? 'unknown'] ?? REASON_TEXT.unknown;
    return (
      <div className="save-notice danger" role="alert">
        <span className="save-notice-icon" aria-hidden="true">
          ⚠
        </span>
        <div className="save-notice-body">
          <b>{reason.title}</b>
          <span>{reason.body}</span>
          {lastSavedAt && (
            <span className="save-notice-note">
              Zuletzt erfolgreich gesichert um {new Date(lastSavedAt).toLocaleTimeString('de-DE')}.
            </span>
          )}
        </div>
      </div>
    );
  }

  if (recovered) {
    return (
      <div className="save-notice info" role="status">
        <span className="save-notice-icon" aria-hidden="true">
          ↺
        </span>
        <div className="save-notice-body">
          <b>Dein Spielstand wurde wiederhergestellt</b>
          <span>Der zuletzt gespeicherte Stand war beschädigt. Es wurde eine Sicherungskopie geladen — es kann sein, dass ein paar Sekunden fehlen.</span>
        </div>
      </div>
    );
  }

  return null;
}
