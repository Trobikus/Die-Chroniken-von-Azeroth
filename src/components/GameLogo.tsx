interface GameLogoProps {
  /** Größere Variante für das Hauptmenü, kleinere als Wasserzeichen im Spiel. */
  size?: 'large' | 'small';
}

export function GameLogo({ size = 'large' }: GameLogoProps) {
  return (
    <div className={`game-logo game-logo-${size}`}>
      <div className="logo-line logo-world">
        <span className="logo-bar" />
        World
        <span className="logo-bar" />
      </div>
      <h1 className="logo-line logo-warcraft">Warcraft</h1>
      <div className="logo-subtitle">Die Chroniken von Azeroth</div>
    </div>
  );
}
