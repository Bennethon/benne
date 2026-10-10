import type { EventBus } from '../events/EventBus';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import { interruptPlayerWalkForVerbInteraction } from '../scenes/interruptPlayerWalkForVerbInteraction.js';
import { beginActionSentence } from './actionSentence.js';
import { dispatchVerbInteraction } from './dispatchVerb.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getGameSettings } from '../ConfigManager.js';
import { inventoryItemLabel } from './targetLabel.js';
import { isItemVerbId } from './verbConfig.js';

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

/**
 * Dispatch order: `verb:room:<roomId>:inventory:<itemId>:<verbId>` → `verb:inventory:<itemId>:<verbId>`.
 * When neither channel has listeners, an item verb (`usesItem`) arms the item for using it on
 * something (decision 28); any other verb goes to the same global chain as {@link dispatchVerbInteraction}:
 * `verb:global:<verbId>` → `verb:global:fallback` → `verb:unhandled`.
 */
export function dispatchInventoryVerbInteraction(
  bus: EventBus,
  verbId: string,
  itemId: string,
  roomId: string,
): void {
  interruptPlayerWalkForVerbInteraction();
  beginActionSentence(verbId, inventoryItemLabel(itemId));
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
  const manager = tryGetActiveGameStateManager();
  if (isItemVerbId(getGameSettings(), verbId)) {
    manager?.setActiveInventoryItem(itemId);
    return;
  }
  dispatchVerbInteraction(bus, verbId, { onVerbFallback: false }, {
    type: 'inventoryItem',
    itemId,
    roomId,
    description: inventoryItemLabel(itemId),
  });
}

export {
  dispatchInventoryOnInventoryItemInteraction,
  dispatchInventoryOnVerbTargetInteraction,
  shouldDispatchInventoryUsedOnVerb,
  shouldDispatchInventoryUsedOnVerbForGame,
  shouldDropActiveInventoryOnUse,
} from './dispatchInventoryOnVerbTarget';
