import type { GameSettings } from '../../types/game.js';
import type { EventBus } from '../events/EventBus';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { readEffectiveInventoryDescription } from '../inventory/inventoryScriptingAnimations.js';
import { getInventoryItemIdsWithBenneScripts } from '../scripting/registerInventoryScript.js';
import { interruptPlayerWalkForVerbInteraction } from '../scenes/interruptPlayerWalkForVerbInteraction.js';
import { dispatchVerbInteraction } from './dispatchVerb.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { resolveEffectiveGiveVerbId, resolveEffectiveUseVerbId } from './verbConfig.js';

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

/**
 * Dispatch order: `verb:room:<roomId>:inventory:<itemId>:<verbId>` → `verb:inventory:<itemId>:<verbId>` →
 * when neither channel has listeners, the same global chain as {@link dispatchVerbInteraction}:
 * `verb:global:<verbId>` → `verb:global:fallback` → `verb:unhandled`.
 */
export function dispatchInventoryVerbInteraction(
  bus: EventBus,
  verbId: string,
  itemId: string,
  roomId: string,
): void {
  interruptPlayerWalkForVerbInteraction();
  const payload = { itemId, roomId, verbId };
  const roomScoped = roomInventoryVerbEventId(roomId, itemId, verbId);
  if (listenerCount(bus, roomScoped) > 0) {
    bus.emit(roomScoped, payload);
    return;
  }
  const globalScoped = inventoryVerbEventId(itemId, verbId);
  if (listenerCount(bus, globalScoped) > 0) {
    bus.emit(globalScoped, payload);
    return;
  }
  const def = getInventoryDefinition(itemId);
  const manager = tryGetActiveGameStateManager();
  const description =
    def && manager
      ? readEffectiveInventoryDescription(manager, def)
      : def?.description;
  dispatchVerbInteraction(bus, verbId, { onVerbFallback: false }, {
    type: 'inventoryItem',
    itemId,
    roomId,
    ...(description !== undefined && description.length > 0 ? { description } : {}),
  });
}

/**
 * Inventory rows with a `*.inventory.ts` module get **use** / **give**→active from
 * {@link import('../scripting/InventoryBenneScript.js').InventoryBenneScript} after the interaction queue drains.
 * JSON-only items never load that script — this mirrors arming when the resolved verb is the effective **use** or
 * **give** id (see {@link resolveEffectiveUseVerbId}, {@link resolveEffectiveGiveVerbId}).
 */
export function trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch(
  manager: GameStateManager,
  settings: GameSettings,
  verbId: string,
  itemId: string,
): void {
  if (getInventoryItemIdsWithBenneScripts().has(itemId)) {
    return;
  }
  const useId = resolveEffectiveUseVerbId(settings);
  const giveId = resolveEffectiveGiveVerbId(settings);
  if (verbId !== useId && verbId !== giveId) {
    return;
  }
  manager.setActiveInventoryItem(itemId);
}

/** @deprecated Use {@link trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch}. */
export const trySyncActiveInventoryAfterInventoryUseRowDispatch =
  trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch;

export {
  dispatchInventoryOnInventoryItemInteraction,
  dispatchInventoryOnVerbTargetInteraction,
  shouldDispatchInventoryUsedOnVerb,
  shouldDispatchInventoryUsedOnVerbForGame,
  shouldDropActiveInventoryOnUse,
} from './dispatchInventoryOnVerbTarget';
