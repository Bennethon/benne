import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import { interruptPlayerWalkForVerbInteraction } from '../scenes/interruptPlayerWalkForVerbInteraction.js';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  buildInventoryUsedOnInventoryItemPayload,
  buildInventoryUsedOnPayload,
  globalInventoryOnCharacterEventId,
  globalInventoryOnHotspotEventId,
  globalInventoryOnInventoryItemEventId,
  globalInventoryOnPropEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnInventoryItemEventId,
  roomInventoryOnPropEventId,
  type AnyInventoryUsedOnPayload,
} from '../events/inventoryOnVerbEvents';
import type { VerbInteractTarget } from '../events/verbInteractionEvents';
import type { GameStateManager } from '../gameState/GameStateManager';
import type { GameSettings } from '../../types/game';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import type { PointerVerbResolution } from './resolvePointerVerb';
import { resolveEffectiveUseVerbId } from './verbConfig';

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

function tryEmitInventoryOnTargetOrGlobalUnhandled(
  bus: EventBus,
  roomEventId: string,
  globalEventId: string,
  payload: AnyInventoryUsedOnPayload,
): boolean {
  if (listenerCount(bus, roomEventId) > 0) {
    bus.emit(roomEventId, payload);
    return true;
  }
  if (listenerCount(bus, globalEventId) > 0) {
    bus.emit(globalEventId, payload);
    return true;
  }
  if (listenerCount(bus, INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT) > 0) {
    bus.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, payload);
    return true;
  }
  return false;
}

/**
 * When an active inventory item is set and the pointer resolves to the effective **use** verb or the current
 * **active verb**, dispatch uses inventory-on-target channels instead of {@link dispatchVerbInteraction}.
 */
export function shouldDispatchInventoryUsedOnVerb(
  manager: GameStateManager,
  settings: GameSettings,
  verbId: string,
  resolution: PointerVerbResolution,
): boolean {
  if (resolution.kind !== 'verb') {
    return false;
  }
  const itemId = manager.getActiveInventoryItemId();
  if (itemId == null) {
    return false;
  }
  const useVerbId = resolveEffectiveUseVerbId(settings);
  if (verbId === useVerbId) {
    return true;
  }
  const active = manager.getActiveVerb();
  return active !== null && verbId === active;
}

/**
 * Room-scoped inventory-on-target event first, then global fallback (same precedence idea as
 * {@link import('./dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} / character verbs).
 */
export function dispatchInventoryOnVerbTargetInteraction(
  bus: EventBus,
  itemId: string,
  verbId: string,
  target: VerbInteractTarget,
): boolean {
  interruptPlayerWalkForVerbInteraction();
  if (target.type === 'inventoryItem') {
    return false;
  }
  const payload = buildInventoryUsedOnPayload(target, itemId, verbId);

  switch (target.type) {
    case 'prop': {
      const roomScoped = roomInventoryOnPropEventId(target.roomId, target.propId, itemId);
      const globalScoped = globalInventoryOnPropEventId(target.propId, itemId);
      return tryEmitInventoryOnTargetOrGlobalUnhandled(bus, roomScoped, globalScoped, payload);
    }
    case 'hotspot': {
      const roomScoped = roomInventoryOnHotspotEventId(target.roomId, target.hotspotId, itemId);
      const globalScoped = globalInventoryOnHotspotEventId(target.hotspotId, itemId);
      return tryEmitInventoryOnTargetOrGlobalUnhandled(bus, roomScoped, globalScoped, payload);
    }
    case 'character': {
      const roomScoped = roomInventoryOnCharacterEventId(target.roomId, target.characterId, itemId);
      const globalScoped = globalInventoryOnCharacterEventId(target.characterId, itemId);
      return tryEmitInventoryOnTargetOrGlobalUnhandled(bus, roomScoped, globalScoped, payload);
    }
  }
}

/**
 * Inventory panel: **source** item (armed) used on **target** item row. Same room/global precedence as
 * {@link dispatchInventoryOnVerbTargetInteraction}.
 */
export function dispatchInventoryOnInventoryItemInteraction(
  bus: EventBus,
  sourceItemId: string,
  verbId: string,
  targetItemId: string,
  roomId: string,
  description: string | undefined,
): boolean {
  interruptPlayerWalkForVerbInteraction();
  const payload = buildInventoryUsedOnInventoryItemPayload(
    roomId,
    sourceItemId,
    targetItemId,
    verbId,
    description,
  );
  const roomScoped = roomInventoryOnInventoryItemEventId(roomId, targetItemId, sourceItemId);
  const globalScoped = globalInventoryOnInventoryItemEventId(targetItemId, sourceItemId);
  return tryEmitInventoryOnTargetOrGlobalUnhandled(bus, roomScoped, globalScoped, payload);
}

/** Convenience for call sites that already read {@link getGameSettings}. */
export function shouldDispatchInventoryUsedOnVerbForGame(
  manager: GameStateManager,
  verbId: string,
  resolution: PointerVerbResolution,
): boolean {
  return shouldDispatchInventoryUsedOnVerb(manager, getGameSettings(), verbId, resolution);
}

/**
 * Resolves whether the **active inventory selection** should be "dropped" (active inventory +
 * active verb both cleared) after `itemId` is used on a clickable target.
 *
 * Precedence:
 * 1. Item's **`dropWhenUsed`** (from `*.inventory.json`) — when defined, wins.
 * 2. Global **`dropWhenInventoryUsed`** from `game-config.json`.
 * 3. Default **`false`** (stay armed so the player can use the same item on several targets).
 */
export function shouldDropActiveInventoryOnUse(itemId: string): boolean {
  const def = getInventoryDefinition(itemId);
  if (def?.dropWhenUsed !== undefined) {
    return def.dropWhenUsed;
  }
  return getGameSettings().dropWhenInventoryUsed ?? false;
}
