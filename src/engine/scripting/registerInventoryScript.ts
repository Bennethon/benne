import type { InventoryScriptContext } from './types.js';

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

/**
 * Call at the top level of each `*.inventory.ts` to register Bennescript handlers for that item.
 * Handlers subscribe to **room-scoped and global** inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} can prefer room listeners first.
 */
export function registerInventoryScript(
  itemId: string,
  registerFn: (context: InventoryScriptContext) => void,
): void {
  benneInventoryScriptRegistrations.push({ itemId, registerFn });
}
