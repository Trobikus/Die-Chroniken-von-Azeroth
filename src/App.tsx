import { useCallback, useEffect, useState } from 'react';
import { BuildingsPanel } from './components/BuildingsPanel';
import { CraftingPanel } from './components/CraftingPanel';
import { HuntPanel } from './components/HuntPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { LogPanel } from './components/LogPanel';
import { OfflineModal } from './components/OfflineModal';
import { QuestPanel } from './components/QuestPanel';
import { SaveNotice } from './components/SaveNotice';
import { StatsPanel } from './components/StatsPanel';
import { TopBar } from './components/TopBar';
import { GameProvider } from './components/GameProvider';
import { suggestName, type ClassId } from './game/classes';
import { useGame } from './game/gameContext';
import { createInitialState } from './game/state';
import { clearSave, peekSave, saveGame, type SaveSummary } from './game/save';
import type { GameState } from './game/types';
import { useSettings } from './hooks/useSettings';
import { AboutScreen } from './screens/AboutScreen';
import { CharacterSelect } from './screens/CharacterSelect';
import { MainMenu } from './screens/MainMenu';
import { OptionsScreen } from './screens/OptionsScreen';

const TABS = [
  { id: 'jagd', label: 'Jagd', icon: '⚔️', render: () => <HuntPanel /> },
  { id: 'herstellung', label: 'Handwerk', icon: '🔨', render: () => <CraftingPanel /> },
  { id: 'betriebe', label: 'Betriebe', icon: '🏰', render: () => <BuildingsPanel /> },
  { id: 'tasche', label: 'Tasche', icon: '🎒', render: () => <InventoryPanel /> },
  { id: 'auftraege', label: 'Aufträge', icon: '📜', render: () => <QuestPanel /> },
  { id: 'chronik', label: 'Chronik', icon: '📖', render: () => <StatsPanel /> },
] as const;

type TabId = (typeof TABS)[number]['id'];
type Screen = 'menu' | 'character' | 'options' | 'about' | 'game';

function Shell({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<TabId>('jagd');
  const { state } = useGame();
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  const openQuests = Object.values(state.quests).filter((q) => q.status === 'aktiv').length;

  return (
    <div className="app">
      <TopBar onExit={onExit} />

      <div className="app-body">
        <main className="app-main">
          <SaveNotice />

          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${t.id === tab ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon">{t.icon}</span>
                {t.label}
                {t.id === 'auftraege' && openQuests > 0 && (
                  <span className="tab-badge">{openQuests}</span>
                )}
              </button>
            ))}
          </nav>

          {active.render()}
        </main>

        <aside className="app-side">
          <LogPanel />
        </aside>
      </div>

      <OfflineModal />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [summary, setSummary] = useState<SaveSummary | null>(() => peekSave(Date.now()));
  const [freshState, setFreshState] = useState<GameState | null>(null);
  const settings = useSettings();

  const refreshSummary = useCallback(() => setSummary(peekSave(Date.now())), []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.reduceMotion]);

  const startNewGame = (classId: ClassId, name: string) => {
    clearSave();
    const state = createInitialState(Date.now(), classId);
    state.charName = name.trim() || suggestName(classId);
    saveGame(state);
    setFreshState(state);
    setScreen('game');
  };

  const startImported = (state: GameState) => {
    clearSave();
    saveGame(state);
    setFreshState(state);
    setScreen('game');
  };

  const enterGame = () => {
    setFreshState(null);
    setScreen('game');
  };

  const leaveGame = () => {
    setFreshState(null);
    setScreen('menu');
    refreshSummary();
  };

  if (screen === 'game') {
    return (
      <GameProvider initialState={freshState ?? undefined} key={freshState ? 'fresh' : 'loaded'}>
        <Shell onExit={leaveGame} />
      </GameProvider>
    );
  }

  return (
    <div className="app-root">
      {screen === 'menu' && (
        <MainMenu
          summary={summary}
          onContinue={enterGame}
          onNewGame={() => setScreen('character')}
          onOptions={() => setScreen('options')}
          onAbout={() => setScreen('about')}
          onLoadImported={startImported}
        />
      )}
      {screen === 'character' && (
        <CharacterSelect
          existing={summary}
          onCreate={startNewGame}
          onCancel={() => setScreen('menu')}
        />
      )}
      {screen === 'options' && <OptionsScreen onBack={() => setScreen('menu')} />}
      {screen === 'about' && <AboutScreen onBack={() => setScreen('menu')} />}
    </div>
  );
}
