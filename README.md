# Die Chroniken von Azeroth

Ein inkrementelles Fantasy-RPG im Stil von World of Warcraft — für einen einzelnen Helden, im Browser,
ohne Server, ohne Account.

Du jägst, sammelst und handwerkst, während deine Betriebe im Hintergrund weiterarbeiten. Auch dann,
wenn du die Seite längst geschlossen hast.

## Spielen

```bash
npm install
npm run dev
```

Danach auf <http://localhost:5173/> öffnen. Es gibt nichts zu installieren außer den
Abhängigkeiten — der Spielstand liegt im `localStorage` des Browsers.

## Wie der Kreislauf läuft

| Baustein | Was er tut |
| --- | --- |
| **Jagen** | Echtzeitkampf gegen Gegner in drei Zonen. Bringt Erfahrung, Gold und Materialien. |
| **Handwerk** | Zehn Rezepte auf *einem* Handwerksplatz mit Warteschlange. Jedes Stück würfelt seine Qualität neu — von Gewöhnlich bis Legendär. |
| **Betriebe** | Vier Betriebe erzeugen Materialien ohne Zutun. Der Ausbau kostet Gold, die Preise steigen mit jeder Stufe. |
| **Aufträge** | Werden automatisch angenommen und abgerechnet, sobald die Ziele erfüllt sind. |
| **Klassen** | Krieger, Waldläufer und Paladin unterscheiden sich in Startwerten und dauerhaften Vorteilen. |

Der Fortschritt wird alle zehn Sekunden und beim Verlassen der Seite gespeichert. Wer länger weg ist,
bekommt beim Zurückkommen eine Abrechnung: die Betriebe und das laufende Handwerk arbeiten zu 50 %
weiter, gedeckelt auf acht Stunden.

## Weitere Skripte

```bash
npm run build       # Produktions-Build nach dist/
npm run typecheck   # TypeScript prüfen
npm run smoke       # 30 Minuten Spielverlauf simulieren und Invarianten prüfen
npm run render      # alle Bildschirme serverseitig rendern, auch mit kaputten Spielständen
npm test            # typecheck + smoke + render
```

`smoke` und `render` brauchen kein `npm install`-Rundum: sie bündeln sich mit dem mitgelieferten
esbuild und laufen direkt in Node.

## Aufbau

```
src/
  game/          Spiellogik ohne React — deterministic und im Node testbar
    data/        Items, Rezepte, Betriebe, Zonen, Aufträge, Level-Kurve
    engine.ts    Reducer: Kampf, Handwerk, Produktion, Aufträge
    save.ts      Serialisierung, Offline-Fortschritt, Import/Export
  components/    Panels der Ingame-Ansicht
  screens/       Hauptmenü, Charaktererstellung, Optionen
  hooks/         React-Bindings
scripts/         Simulations- und Render-Tests
```

Die Spiellogik kennt React nicht. Deshalb lässt sich derselbe Code im Browser *und* in einem
Node-Prozess gegen echte Spielstände laufen lassen — das nutzen die beiden Testläufe.

## Stand

Vertikaler Schnitt: drei Zonen, sechs Gegner, zehn Rezepte, vier Betriebe, zehn Aufträge, drei
Klassen, bis Stufe 20. Alles speichert lokal, es gibt keine Serverkomponente.

## Hinweis

Fan-Projekt zu World of Warcraft. Es verwendet keine Originalgrafiken, -Texte oder -Audio von
Blizzard Entertainment. World of Warcraft ist eine eingetragene Marke von Blizzard Entertainment.
Dieses Projekt steht in keiner Verbindung zu Blizzard.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
