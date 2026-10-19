import { GameLogo } from '../components/GameLogo';
import { OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY } from '../game/engine';
import { fmtDuration } from '../game/format';
import { updateSettings, useSettings, type Settings } from '../hooks/useSettings';
import { MenuBackdrop, RealmFooter } from './chrome';

export interface OptionsScreenProps {
  onBack: () => void;
}

const TOGGLES: {
  key: keyof Settings;
  label: string;
  hint: string;
}[] = [
  {
    key: 'autoSave',
    label: 'Automatisch speichern',
    hint: 'Sichert alle 10 Sekunden sowie beim Verlassen der Seite. Ohne diese Option geht der Fortschritt beim Schließen verloren.',
  },
  {
    key: 'offlineProgress',
    label: 'Offline-Fortschritt anrechnen',
    hint: `Betriebe und laufendes Handwerk arbeiten weiter, wenn die Seite geschlossen ist — zu ${Math.round(OFFLINE_EFFICIENCY * 100)} % Wirksamkeit, höchstens ${fmtDuration(OFFLINE_CAP_SECONDS)}.`,
  },
  {
    key: 'showDamageNumbers',
    label: 'Schadenszahlen im Protokoll',
    hint: 'Schreibt auch gewöhnliche Treffer ins Kampfprotokoll. Standardmäßig stehen dort nur kritische Treffer und Kills, damit das Protokoll lesbar bleibt.',
  },
  {
    key: 'reduceMotion',
    label: 'Ruhige Animationen',
    hint: 'Schaltet Glut, Parallaxe und Übergänge ab. Empfehlenswert bei schnellem Flimmern oder reduzierter Bewegung.',
  },
];

export function OptionsScreen({ onBack }: OptionsScreenProps) {
  const settings = useSettings();

  return (
    <div className="menu-screen">
      <MenuBackdrop variant="plain" />

      <div className="menu-content narrow">
        <GameLogo size="small" />
        <h2 className="screen-title">Optionen</h2>

        <div className="options-list">
          {TOGGLES.map(({ key, label, hint }) => (
            <label key={key} className="option-row">
              <span className="option-text">
                <span className="option-label">{label}</span>
                <span className="option-hint">{hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                className={`wow-toggle ${settings[key] ? 'on' : ''}`}
                onClick={() => updateSettings({ [key]: !settings[key] } as Partial<Settings>)}
              >
                <span className="wow-toggle-knob" />
              </button>
            </label>
          ))}
        </div>

        <button className="menu-button" onClick={onBack}>
          Zurück
        </button>
      </div>

      <RealmFooter />
    </div>
  );
}
