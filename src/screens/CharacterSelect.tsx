import { useMemo, useState } from 'react';
import { GameLogo } from '../components/GameLogo';
import { CLASSES, CLASS_ORDER, suggestName, type ClassId } from '../game/classes';
import { OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY } from '../game/engine';
import { fmt, fmtDuration } from '../game/format';
import { createInitialState } from '../game/state';
import { computePlayerStats } from '../game/selectors';
import type { SaveSummary } from '../game/save';
import { MenuBackdrop, RealmFooter } from './chrome';

export interface CharacterSelectProps {
  existing: SaveSummary | null;
  onCreate: (classId: ClassId, name: string) => void;
  onCancel: () => void;
}

const EMBLEM: Record<ClassId, string> = {
  krieger: '⚔️',
  waldlaeufer: '🏹',
  paladin: '⚜️',
};

export function CharacterSelect({ existing, onCreate, onCancel }: CharacterSelectProps) {
  const [classId, setClassId] = useState<ClassId>('krieger');
  const [name, setName] = useState(() => suggestName('krieger'));
  const [nameIndex, setNameIndex] = useState(0);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const klass = CLASSES[classId];
  const trimmed = name.trim();
  const nameValid = trimmed.length >= 2 && trimmed.length <= 24;

  // Echten Startzustand berechnen, damit die angezeigten Werte stimmen.
  const stats = useMemo(
    () => computePlayerStats(createInitialState(Date.now(), classId)),
    [classId],
  );

  const choose = (id: ClassId) => {
    setClassId(id);
    setName(suggestName(id, nameIndex));
    setConfirmOverwrite(false);
  };

  const shuffleName = () => {
    const next = nameIndex + 1;
    setNameIndex(next);
    setName(suggestName(classId, next));
  };

  const blocked = !nameValid || (!!existing && !confirmOverwrite);

  const perks: string[] = [];
  if (klass.damageReduction > 0) perks.push(`${klass.damageReduction * 100} % Schadensminderung`);
  if (klass.critBonus > 0) perks.push(`+${klass.critBonus} % Krit`);
  if (klass.regenBonus > 0)
    perks.push(`+${(klass.regenBonus * 100).toFixed(1).replace('.0', '')} % Regeneration/s`);

  return (
    <div className="menu-screen">
      <MenuBackdrop variant="character" />
      <div className="creation-vignette" aria-hidden="true" />

      <div className="creation">
        <header className="creation-head">
          <GameLogo size="small" />
        </header>

        {/* ---------- Der Held in der Mitte, im Scheinwerfer ---------- */}
        <section className="creation-stage">
          <div className="model-plate" style={{ ['--class-color' as string]: klass.color }}>
            <div className="model-halo" />
            <span className="model-emblem" aria-hidden="true">
              {EMBLEM[classId]}
            </span>
            <div className="model-dais" />
          </div>

          <h1 className="creation-class-name" style={{ color: klass.color }}>
            {klass.name}
          </h1>
          <p className="creation-role">
            {klass.race} · {klass.role}
          </p>

          <div className="creation-input-row">
            <input
              id="char-name"
              className="creation-input"
              value={name}
              maxLength={24}
              aria-label="Name des Helden"
              onChange={(e) => {
                setName(e.target.value);
                setConfirmOverwrite(false);
              }}
              onBlur={() => {
                if (!name.trim()) setName(suggestName(classId, nameIndex));
              }}
            />
            <button className="menu-button ghost" onClick={shuffleName} title="Zufälliger Name">
              Neu
            </button>
          </div>

          <dl className="creation-stats">
            <div>
              <dt>Stärke</dt>
              <dd>{stats.stats.staerke}</dd>
            </div>
            <div>
              <dt>Agilität</dt>
              <dd>{stats.stats.agilitaet}</dd>
            </div>
            <div>
              <dt>Vitalität</dt>
              <dd>{stats.stats.vitalitaet}</dd>
            </div>
            <div>
              <dt>Lebenspunkte</dt>
              <dd>{fmt(stats.maxHp)}</dd>
            </div>
            <div>
              <dt>Schaden</dt>
              <dd>{fmt(stats.damage)}</dd>
            </div>
            <div>
              <dt>DPS</dt>
              <dd>{fmt(stats.dps)}</dd>
            </div>
            <div>
              <dt>Krit</dt>
              <dd>{fmt(stats.crit)}%</dd>
            </div>
          </dl>

          {perks.length > 0 && (
            <p className="creation-perks">{perks.join('  ·  ')}</p>
          )}
        </section>

        {/* ---------- Klassenicons am unteren Rand ---------- */}
        <nav className="class-bar" role="radiogroup" aria-label="Klasse wählen">
          {CLASS_ORDER.map((id) => {
            const def = CLASSES[id];
            const selected = id === classId;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={selected}
                className={`class-slot ${selected ? 'selected' : ''}`}
                style={{ ['--class-color' as string]: def.color }}
                onClick={() => choose(id)}
              >
                <span className="class-slot-emblem" aria-hidden="true">
                  {EMBLEM[id]}
                </span>
                <span className="class-slot-name">{def.name}</span>
              </button>
            );
          })}
        </nav>

        <p className="creation-caption">{klass.tagline}</p>

        {existing && !confirmOverwrite && (
          <p className="creation-warning">
            Auf diesem Gerät lebt bereits <b>{existing.charName}</b> (Stufe {existing.level}). Ein
            neues Spiel überschreibt diesen Stand endgültig.
          </p>
        )}

        <div className="creation-actions">
          <button
            className="create-button"
            disabled={blocked}
            onClick={() => {
              if (existing && !confirmOverwrite) {
                setConfirmOverwrite(true);
                return;
              }
              onCreate(classId, trimmed);
            }}
          >
            {existing && !confirmOverwrite ? 'Stand überschreiben …' : 'Charakter erstellen'}
          </button>

          {existing && confirmOverwrite && (
            <button className="menu-button ghost" onClick={() => setConfirmOverwrite(false)}>
              Abbrechen
            </button>
          )}

          <button className="menu-button ghost" onClick={onCancel}>
            Zurück
          </button>
        </div>
      </div>

      <RealmFooter
        note={`Offline-Fortschritt zählt zu ${Math.round(OFFLINE_EFFICIENCY * 100)} %, gedeckelt auf ${fmtDuration(OFFLINE_CAP_SECONDS)}`}
      />
    </div>
  );
}
