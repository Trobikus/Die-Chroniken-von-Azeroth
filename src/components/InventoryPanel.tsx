import { ITEMS } from '../game/data/items';
import { QUALITIES } from '../game/data/materials';
import { fmt, fmtSigned } from '../game/format';
import {
  EQUIP_SLOTS,
  SLOT_LABEL,
  computePlayerStats,
  equippedItems,
  itemScore,
  statDelta,
} from '../game/selectors';
import { useGame } from '../game/gameContext';
import { Panel } from './Panel';
import type { EquipSlot, ItemInstance } from '../game/types';

function StatLine({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  if (value === 0) return null;
  const good = value > 0;
  return (
    <span className={good ? 'stat-up' : 'stat-down'}>
      {label} {fmtSigned(value, 1)}
      {suffix}
    </span>
  );
}

export function InventoryPanel() {
  const { state, dispatch } = useGame();
  const player = computePlayerStats(state);
  const gear = equippedItems(state);

  const gearItems = state.inventory.filter((i) => ITEMS[i.defId]?.slot !== 'material');
  const consumables = state.inventory.filter((i) => ITEMS[i.defId]?.slot === 'material');

  return (
    <Panel
      title="Ausrüstung & Tasche"
      icon="🎒"
      subtitle={`${state.inventory.length}/60 Plätze · ${fmt(player.damage)} Schaden · ${fmt(player.dps)} DPS · ${fmt(player.crit)}% Krit`}
    >
      <div className="equip-row">
        {EQUIP_SLOTS.map((slot) => {
          const piece = gear[slot];
          return (
            <div key={slot} className={`equip-slot ${piece ? 'filled' : ''}`}>
              <div className="equip-slot-label">{SLOT_LABEL[slot as EquipSlot]}</div>
              {piece ? (
                <>
                  <div className="equip-item" style={{ color: QUALITIES[piece.instance.quality].color }}>
                    <span className="item-icon">{piece.def.icon}</span>
                    <span className="item-name">{piece.def.name}</span>
                    <span className="item-quality">{QUALITIES[piece.instance.quality].label}</span>
                  </div>
                  <button
                    className="btn btn-tiny"
                    onClick={() => dispatch({ type: 'unequip', slot })}
                  >
                    Ablegen
                  </button>
                </>
              ) : (
                <div className="equip-empty">— leer —</div>
              )}
            </div>
          );
        })}
      </div>

      {consumables.length > 0 && (
        <>
          <h3 className="section-title">Verbrauchsgegenstände</h3>
          <div className="bag-grid">
            {consumables.map((item) => (
              <ItemCard key={item.uid} item={item} onUse={() => dispatch({ type: 'use', uid: item.uid })} />
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">Ausrüstung im Beutel</h3>
      {gearItems.length === 0 ? (
        <p className="hint">
          Dein Beutel ist leer. Stell Gegenstände her oder erbeute sie von Gegnern — Grün bedeutet
          „besser als aktuell ausgerüstet“.
        </p>
      ) : (
        <div className="bag-grid">
          {gearItems
            .slice()
            .sort((a, b) => itemScore(b) - itemScore(a))
            .map((item) => (
              <ItemCard key={item.uid} item={item} showDelta />
            ))}
        </div>
      )}
    </Panel>
  );
}

function ItemCard({
  item,
  showDelta = false,
  onUse,
}: {
  item: ItemInstance;
  showDelta?: boolean;
  onUse?: () => void;
}) {
  const { state, dispatch } = useGame();
  const def = ITEMS[item.defId];
  const quality = QUALITIES[item.quality];
  const delta = showDelta ? statDelta(state, item) : null;
  const upgrade = delta ? itemScore(item) - (equippedScore(state, def.slot) ?? 0) : 0;

  return (
    <div className="item-card" style={{ borderColor: quality.color }}>
      <div className="item-card-head">
        <span className="item-icon">{def.icon}</span>
        <div>
          <div className="item-name" style={{ color: quality.color }}>
            {def.name}
          </div>
          <div className="item-quality">
            {quality.label} · Stufe {def.reqLevel}
          </div>
        </div>
      </div>

      <div className="item-stats">
        {item.stats.staerke ? <span>+{item.stats.staerke} Stärke</span> : null}
        {item.stats.agilitaet ? <span>+{item.stats.agilitaet} Agilität</span> : null}
        {item.stats.vitalitaet ? <span>+{item.stats.vitalitaet} Vitalität</span> : null}
        {item.attackTime ? (
          <span>{fmtSigned(item.attackTime, 2)}s Angriffszeit</span>
        ) : null}
        {item.crit ? <span>+{item.crit}% Krit</span> : null}
        {!Object.values(item.stats).some(Boolean) && !item.crit && !item.attackTime ? (
          <span className="muted">{def.use?.description ?? '—'}</span>
        ) : null}
      </div>

      {delta && (
        <div className="item-delta">
          <StatLine label="Stärke" value={delta.staerke} />
          <StatLine label="Agilität" value={delta.agilitaet} />
          <StatLine label="Vitalität" value={delta.vitalitaet} />
          <StatLine label="Angriffszeit" value={delta.attackTime} suffix="s" />
          <StatLine label="Krit" value={delta.crit} suffix="%" />
        </div>
      )}

      <div className="item-actions">
        {def.slot !== 'material' && (
          <button
            className="btn btn-tiny"
            onClick={() => dispatch({ type: 'equip', uid: item.uid })}
          >
            {upgrade > 0 ? 'Ausrüsten ▲' : 'Ausrüsten'}
          </button>
        )}
        {onUse && (
          <button className="btn btn-tiny btn-use" onClick={onUse} disabled={!!state.buff && !!ITEMS[item.defId].use?.buff}>
            Benutzen
          </button>
        )}
        <button
          className="btn btn-tiny btn-sell"
          onClick={() => dispatch({ type: 'sell', uid: item.uid })}
        >
          🪙 {fmt(Math.max(1, Math.round(def.sellPrice * quality.mult)))}
        </button>
      </div>
    </div>
  );
}

function equippedScore(state: ReturnType<typeof useGame>['state'], slot: string): number | null {
  if (slot === 'material') return null;
  const uid = state.equipped[slot as EquipSlot];
  if (!uid) return null;
  const item = state.inventory.find((i) => i.uid === uid);
  return item ? itemScore(item) : null;
}
