export interface MenuScreenProps {
  onBack: () => void;
}

export interface BackgroundProps {
  /** Legt eine Variante dergemalten Kulisse dar. */
  variant?: 'menu' | 'character' | 'plain';
}

export function MenuBackdrop({ variant = 'menu' }: BackgroundProps) {
  return (
    <div className={`menu-backdrop menu-backdrop-${variant}`} aria-hidden="true">
      <div className="backdrop-sky" />
      <div className="backdrop-mountains" />
      <div className="backdrop-embers" />
      <div className="backdrop-vignette" />
    </div>
  );
}

export function RealmFooter({ note }: { note?: string }) {
  return (
    <footer className="realm-footer">
      <span>Version 1.0.0</span>
      <span className="realm-dot">•</span>
      <span>Realm: Azeroth (Einzelspieler)</span>
      {note && (
        <>
          <span className="realm-dot">•</span>
          <span className="realm-note">{note}</span>
        </>
      )}
    </footer>
  );
}
