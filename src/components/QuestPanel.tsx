import { QUESTS } from '../game/data/quests';
import { ENEMIES } from '../game/data/zones';
import { ITEMS } from '../game/data/items';
import { fmt } from '../game/format';
import { useGame } from '../game/gameContext';
import { Panel } from './Panel';

export function QuestPanel() {
  const { state } = useGame();

  const active = QUESTS.filter((q) => state.quests[q.id]?.status === 'aktiv');
  const done = QUESTS.filter((q) => state.quests[q.id]?.status === 'belohnt');
  const upcoming = QUESTS.filter((q) => !state.quests[q.id]);

  return (
    <Panel
      title="Aufträge"
      icon="📜"
      subtitle={`${done.length}/${QUESTS.length} abgeschlossen · Aufträge werden automatisch angenommen und abgerechnet.`}
    >
      {active.length > 0 && (
        <>
          <h3 className="section-title">Laufend</h3>
          <div className="quest-list">
            {active.map((quest) => {
              const entry = state.quests[quest.id];
              return (
                <div key={quest.id} className="quest-card">
                  <div className="quest-head">
                    <span className="quest-icon">{quest.icon}</span>
                    <div>
                      <div className="quest-name">{quest.name}</div>
                      <div className="quest-giver">{quest.giver} · Stufe {quest.minLevel}</div>
                    </div>
                    <div className="quest-rewards">
                      <span>🪙 {fmt(quest.rewards.gold)}</span>
                      <span>✨ {fmt(quest.rewards.xp)}</span>
                    </div>
                  </div>

                  <div className="quest-objectives">
                    {quest.objectives.map((obj, i) => {
                      const progress = Math.min(obj.count, entry.progress[i] ?? 0);
                      const done = progress >= obj.count;
                      return (
                        <div key={i} className={`objective ${done ? 'done' : ''}`}>
                          <span className="objective-icon">{done ? '✔' : '○'}</span>
                          <span className="objective-label">{obj.label}</span>
                          <span className="objective-progress">
                            {fmt(progress)} / {fmt(obj.count)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="quest-flavor">{quest.flavor}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <h3 className="section-title">Abgeschlossen</h3>
          <div className="quest-list compact">
            {done.map((quest) => (
              <div key={quest.id} className="quest-card done">
                <span className="quest-icon">{quest.icon}</span>
                <span className="quest-name">{quest.name}</span>
                <span className="quest-reward-done">
                  🪙 {fmt(quest.rewards.gold)} · ✨ {fmt(quest.rewards.xp)}
                  {quest.rewards.items?.map((r) => (
                    <span key={r.defId} className="reward-item">
                      {ITEMS[r.defId]?.icon} {ITEMS[r.defId]?.name}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h3 className="section-title">Noch nicht verfügbar</h3>
          <div className="quest-list compact">
            {upcoming.map((quest) => {
              const enemy = ENEMIES[quest.objectives[0]?.targetId];
              return (
                <div key={quest.id} className="quest-card locked">
                  <span className="quest-icon">{quest.icon}</span>
                  <span className="quest-name">{quest.name}</span>
                  <span className="quest-lock">
                    Stufe {quest.minLevel} · {enemy ? enemy.name : quest.giver}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
