import type { InventoryScriptContext } from './types.js';
import type { InventoryItemId } from '../../types/generated/benne-game-ids.js';

const benneInventoryScriptRegistrations: Array<{
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}> = [];

export function getBenneInventoryScriptRegistrations(): ReadonlyArray<{
  itemId: string;
  registerFn: (context: InventoryScriptContext) => void;
}> {
  return benneInventoryScriptRegistrations;
}

/** Item ids that have a `registerInventoryScript` module (vs JSON-only inventory definitions). */
export function getInventoryItemIdsWithBenneScripts(): ReadonlySet<string> {
  return new Set(benneInventoryScriptRegistrations.map((r) => r.itemId));
}

/**
 * Call at the top level of each `*.inventory.ts` to register Bennescript handlers for that item.
 * Handlers subscribe to **room-scoped and global** inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} can prefer room listeners first.
 */
export function registerInventoryScript(
  itemId: InventoryItemId,
  registerFn: (context: InventoryScriptContext) => void,
): void {
  benneInventoryScriptRegistrations.push({ itemId, registerFn });
}
