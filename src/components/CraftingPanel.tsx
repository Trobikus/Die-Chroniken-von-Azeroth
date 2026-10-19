import { MATERIALS, MATERIAL_ORDER } from '../game/data/materials';
import { ITEMS } from '../game/data/items';
import { PROFESSION_LABEL, RECIPES, RECIPES_BY_ID } from '../game/data/recipes';
import { canAffordMaterials, scaleCost } from '../game/engine';
import type { MaterialId } from '../game/types';
import { fmt } from '../game/format';
import { useGame } from '../game/gameContext';
import { Panel } from './Panel';

export function CraftingPanel() {
  const { state, dispatch } = useGame();

  const professions = [...new Set(RECIPES.map((r) => r.profession))];

  return (
    <Panel
      title="Handwerk"
      icon="🔨"
      subtitle="Jedes Rezept würfelt die Qualität neu — ein gewöhnliches Ergebnis ist kein Grund aufzugeben."
    >
      {professions.map((profession) => (
        <div key={profession} className="profession">
          <h3 className="profession-title">{PROFESSION_LABEL[profession]}</h3>
          <div className="recipe-grid">
            {RECIPES.filter((r) => r.profession === profession).map((recipe) => {
              const isCurrent = state.crafting?.recipeId === recipe.id;
              const repeats = isCurrent && state.crafting ? 1 + state.crafting.queued : 1;
              const running = isCurrent;
              const blockedElsewhere = !!state.crafting && !isCurrent;
              const totalGold = recipe.goldCost * repeats;
              const enoughGold = state.gold >= totalGold;
              const enoughMat = canAffordMaterials(state, scaleCost(recipe.cost, repeats));
              const reqLevel = ITEMS[recipe.results[0].defId]?.reqLevel ?? 1;
              const locked = state.level < reqLevel;
              const disabled = !enoughGold || !enoughMat || locked || blockedElsewhere;

              return (
                <div key={recipe.id} className={`recipe-card ${running ? 'running' : ''} ${locked ? 'locked' : ''}`}>
                  <div className="recipe-head">
                    <span className="recipe-icon">{recipe.icon}</span>
                    <div>
                      <div className="recipe-name">{recipe.name}</div>
                      <div className="recipe-meta">
                        {recipe.craftTime}s Handwerkzeit
                        {running && state.crafting && state.crafting.queued > 0 && (
                          <> · {repeats} in Warteschlange</>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="recipe-cost">
                    {totalGold > 0 && (
                      <span className={enoughGold ? 'cost ok' : 'cost missing'}>
                        🪙 {fmt(totalGold)}
                      </span>
                    )}
                    {(Object.entries(recipe.cost) as [MaterialId, number][]).map(([id, n]) => (
                      <span
                        key={id}
                        className={
                          (state.materials[id] ?? 0) >= n * repeats ? 'cost ok' : 'cost missing'
                        }
                      >
                        {MATERIALS[id].icon} {n * repeats}
                      </span>
                    ))}
                    {recipe.yieldGold ? (
                      <span className="cost yield">+{recipe.yieldGold * repeats} 🪙</span>
                    ) : null}
                  </div>

                  {locked && <div className="recipe-lock">Erfordert Stufe {reqLevel}</div>}

                  <div className="recipe-actions">
                    <button
                      className="btn btn-craft"
                      disabled={disabled}
                      onClick={() => dispatch({ type: 'craft', recipeId: recipe.id })}
                    >
                      {running ? 'Nachlegen' : 'Herstellen'}
                    </button>
                    <button
                      className="btn btn-queue"
                      disabled={disabled}
                      onClick={() => dispatch({ type: 'craft', recipeId: recipe.id, count: 5 })}
                    >
                      ×5
                    </button>
                  </div>

                  {running && state.crafting && (
                    <div className="craft-progress">
                      <div
                        className="craft-progress-fill"
                        style={{
                          width: `${(1 - state.crafting.remaining / recipe.craftTime) * 100}%`,
                        }}
                      />
                      <span>{state.crafting.remaining.toFixed(1)}s</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {state.crafting && (
        <div className="craft-status">
          <span>
            🔨 {RECIPES_BY_ID[state.crafting.recipeId]?.name} läuft
            {state.crafting.queued > 0 && ` · ${state.crafting.queued} danach in der Schlange`}
          </span>
          <button className="btn btn-tiny" onClick={() => dispatch({ type: 'cancelCraft' })}>
            Abbrechen
          </button>
        </div>
      )}

      <p className="hint">
        Ein Handwerksplatz: Nur ein Rezept läuft zur selben Zeit, dafür mit Warteschlange. Materialien:{' '}
        {MATERIAL_ORDER.map((id) => `${MATERIALS[id].icon} ${fmt(state.materials[id] ?? 0)}`).join(' · ')}
      </p>
    </Panel>
  );
}
