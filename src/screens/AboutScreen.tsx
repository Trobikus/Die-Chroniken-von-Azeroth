import { GameLogo } from '../components/GameLogo';
import { MAX_LEVEL, xpToNext } from '../game/data/level';
import { RECIPES } from '../game/data/recipes';
import { ZONES, ENEMIES } from '../game/data/zones';
import { fmtDuration } from '../game/format';
import { MenuBackdrop, RealmFooter } from './chrome';

export interface AboutScreenProps {
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="menu-screen">
      <MenuBackdrop variant="plain" />

      <div className="menu-content narrow">
        <GameLogo size="small" />
        <h2 className="screen-title">Über das Spiel</h2>

        <div className="about-body">
          <p>
            <b>Die Chroniken von Azeroth</b> ist ein inkrementelles Fantasy-RPG für einen
            einzelnen Helden. Du jägst, sammelst und handwerkst, während deine Betriebe im Hintergrund
            weiterarbeiten — auch dann, wenn du die Seite längst geschlossen hast.
          </p>

          <h3>Wie der Kreislauf läuft</h3>
          <ul>
            <li>
              <b>Jagen</b> bringt Erfahrung, Gold und Materialien. Der Kampf läuft in Echtzeit weiter,
              solange du im Kampfgebiet bist.
            </li>
            <li>
              <b>Handwerk</b> würfelt bei jedem Stück die Qualität neu. Gewöhnlich bis Legendär —
              mehrmals herstellen lohnt sich.
            </li>
            <li>
              <b>Betriebe</b> erzeugen Materialien ohne Zutun. Ausbauen kostet Gold, und die Preise
              steigen mit jeder Stufe.
            </li>
            <li>
              <b>Aufträge</b> werden automatisch angenommen und abgerechnet, sobald ihre Ziele erfüllt
              sind.
            </li>
          </ul>

          <h3>Umfang dieser Version</h3>
          <ul>
            <li>{ZONES.length} Zonen mit {Object.keys(ENEMIES).length} Gegnern</li>
            <li>{RECIPES.length} Rezepte in drei Berufen</li>
            <li>{MAX_LEVEL} Stufen, XP-Kurve beginnt bei {xpToNext(1)} EP</li>
            <li>
              Offline-Fortschritt bis {fmtDuration(8 * 3600)}, darüber greift der Deckel
            </li>
          </ul>

          <h3>Hinweis</h3>
          <p>
            Dies ist ein Fan-Projekt zu World of Warcraft. Es verwendet keine Originalgrafiken,
            -Texte oder Audio der Blizzard Entertainment. World of Warcraft ist eine eingetragene
            Marke von Blizzard Entertainment.
          </p>
        </div>

        <button className="menu-button" onClick={onBack}>
          Zurück
        </button>
      </div>

      <RealmFooter />
    </div>
  );
}
