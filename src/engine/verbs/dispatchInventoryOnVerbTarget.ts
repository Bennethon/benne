import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import { interruptPlayerWalkForVerbInteraction } from '../scenes/interruptPlayerWalkForVerbInteraction.js';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  buildInventoryUsedOnInventoryItemPayload,
  buildInventoryUsedOnPayload,
  globalInventoryOnCharacterAnySourceEventId,
  globalInventoryOnCharacterEventId,
  globalInventoryOnHotspotAnySourceEventId,
  globalInventoryOnHotspotEventId,
  globalInventoryOnInventoryItemEventId,
  globalInventoryOnInventoryRowEventId,
  globalInventoryOnPropAnySourceEventId,
  globalInventoryOnPropEventId,
  roomInventoryOnCharacterAnySourceEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotAnySourceEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnInventoryItemEventId,
  roomInventoryOnInventoryRowEventId,
  roomInventoryOnPropAnySourceEventId,
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

/** Per-source handlers first (`…:inventoryOnProp:id:knife`), then target-wide scripts (`inventoryOnPropAny`). */
function tryEmitInventoryUsedOnFiveTier(
  bus: EventBus,
  roomSourceSpecific: string,
  roomAnySource: string,
  globalSourceSpecific: string,
  globalAnySource: string,
  payload: AnyInventoryUsedOnPayload,
): boolean {
  if (listenerCount(bus, roomSourceSpecific) > 0) {
    bus.emit(roomSourceSpecific, payload);
    return true;
  }
  if (listenerCount(bus, roomAnySource) > 0) {
    bus.emit(roomAnySource, payload);
    return true;
  }
  if (listenerCount(bus, globalSourceSpecific) > 0) {
    bus.emit(globalSourceSpecific, payload);
    return true;
  }
  if (listenerCount(bus, globalAnySource) > 0) {
    bus.emit(globalAnySource, payload);
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
      const roomAny = roomInventoryOnPropAnySourceEventId(target.roomId, target.propId);
      const globalScoped = globalInventoryOnPropEventId(target.propId, itemId);
      const globalAny = globalInventoryOnPropAnySourceEventId(target.propId);
      return tryEmitInventoryUsedOnFiveTier(bus, roomScoped, roomAny, globalScoped, globalAny, payload);
    }
    case 'hotspot': {
      const roomScoped = roomInventoryOnHotspotEventId(target.roomId, target.hotspotId, itemId);
      const roomAny = roomInventoryOnHotspotAnySourceEventId(target.roomId, target.hotspotId);
      const globalScoped = globalInventoryOnHotspotEventId(target.hotspotId, itemId);
      const globalAny = globalInventoryOnHotspotAnySourceEventId(target.hotspotId);
      return tryEmitInventoryUsedOnFiveTier(bus, roomScoped, roomAny, globalScoped, globalAny, payload);
    }
    case 'character': {
      const roomScoped = roomInventoryOnCharacterEventId(target.roomId, target.characterId, itemId);
      const roomAny = roomInventoryOnCharacterAnySourceEventId(target.roomId, target.characterId);
      const globalScoped = globalInventoryOnCharacterEventId(target.characterId, itemId);
      const globalAny = globalInventoryOnCharacterAnySourceEventId(target.characterId);
      return tryEmitInventoryUsedOnFiveTier(bus, roomScoped, roomAny, globalScoped, globalAny, payload);
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
  const roomRow = roomInventoryOnInventoryRowEventId(roomId, targetItemId);
  const globalScoped = globalInventoryOnInventoryItemEventId(targetItemId, sourceItemId);
  const globalRow = globalInventoryOnInventoryRowEventId(targetItemId);
  return tryEmitInventoryUsedOnFiveTier(bus, roomScoped, roomRow, globalScoped, globalRow, payload);
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

/**
 * BenneScript `unhandled()` (or an item verb with no handler) in a room's item-on-target handler:
 * hands the click to the next tier after the room's per-item handler (the room's any-item handler,
 * the global handlers, then the unhandled fallback). `payload` is the room event's payload.
 */
export function continueInventoryOnDispatchAfterRoom(bus: EventBus, payload: AnyInventoryUsedOnPayload): void {
  continueInventoryOnDispatch(bus, payload, 'room');
}

/**
 * Like {@link continueInventoryOnDispatchAfterRoom}, from a handler on the global per-item tier
 * (a character script's or an inventory item's item handler): continues with the target's global
 * any-item handler, then the unhandled fallback.
 */
export function continueInventoryOnDispatchAfterGlobal(bus: EventBus, payload: AnyInventoryUsedOnPayload): void {
  continueInventoryOnDispatch(bus, payload, 'global');
}

function continueInventoryOnDispatch(bus: EventBus, payload: AnyInventoryUsedOnPayload, from: 'room' | 'global'): void {
  const p = payload;
  const rest = (roomAny: string, globalScoped: string, globalAny: string): void => {
    const tiers = from === 'room' ? [roomAny, globalScoped, globalAny] : [globalAny];
    for (const eventId of [...tiers, INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT]) {
      if (listenerCount(bus, eventId) > 0) {
        bus.emit(eventId, p);
        return;
      }
    }
  };
  switch (p.targetType) {
    case 'prop':
      rest(
        roomInventoryOnPropAnySourceEventId(p.roomId, p.propId),
        globalInventoryOnPropEventId(p.propId, p.itemId),
        globalInventoryOnPropAnySourceEventId(p.propId),
      );
      return;
    case 'hotspot':
      rest(
        roomInventoryOnHotspotAnySourceEventId(p.roomId, p.hotspotId),
        globalInventoryOnHotspotEventId(p.hotspotId, p.itemId),
        globalInventoryOnHotspotAnySourceEventId(p.hotspotId),
      );
      return;
    case 'character':
      rest(
        roomInventoryOnCharacterAnySourceEventId(p.roomId, p.characterId),
        globalInventoryOnCharacterEventId(p.characterId, p.itemId),
        globalInventoryOnCharacterAnySourceEventId(p.characterId),
      );
      return;
    case 'inventoryItem':
      rest(
        roomInventoryOnInventoryRowEventId(p.roomId, p.targetItemId),
        globalInventoryOnInventoryItemEventId(p.targetItemId, p.itemId),
        globalInventoryOnInventoryRowEventId(p.targetItemId),
      );
      return;
  }
}
