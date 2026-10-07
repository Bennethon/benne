import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { readEffectiveInventoryDescription } from '../inventory/inventoryScriptingAnimations.js';

/**
 * What a prop / hotspot / character / item is called on screen (the verb line, fallback targets):
 * its description, else its name (characters and items have one), else its id. Never blank, so
 * something with no description still reads "Look at mug" instead of "Look at".
 */
export function targetLabel(description: string | null | undefined, name: string | null | undefined, id: string): string {
  return description?.trim() || name?.trim() || id;
}

/** {@link targetLabel} for an inventory item, from its effective (possibly script-set) description. */
export function inventoryItemLabel(itemId: string): string {
  const def = getInventoryDefinition(itemId);
  const m = tryGetActiveGameStateManager();
  const description = def && m ? readEffectiveInventoryDescription(m, def) : def?.description;
  return targetLabel(description, def?.name, itemId);
}
