import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import {
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
  const payload = buildInventoryUsedOnPayload(target, itemId, verbId);

  switch (target.type) {
    case 'prop': {
      const roomScoped = roomInventoryOnPropEventId(target.roomId, target.propId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return true;
      }
      const globalScoped = globalInventoryOnPropEventId(target.propId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return true;
      }
      bus.emit(roomScoped, payload);
      return false;
    }
    case 'hotspot': {
      const roomScoped = roomInventoryOnHotspotEventId(target.roomId, target.hotspotId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return true;
      }
      const globalScoped = globalInventoryOnHotspotEventId(target.hotspotId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return true;
      }
      bus.emit(roomScoped, payload);
      return false;
    }
    case 'character': {
      const roomScoped = roomInventoryOnCharacterEventId(target.roomId, target.characterId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return true;
      }
      const globalScoped = globalInventoryOnCharacterEventId(target.characterId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return true;
      }
      bus.emit(roomScoped, payload);
      return false;
    }
  }
  return false;
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
  const payload = buildInventoryUsedOnInventoryItemPayload(
    roomId,
    sourceItemId,
    targetItemId,
    verbId,
    description,
  );
  const roomScoped = roomInventoryOnInventoryItemEventId(roomId, targetItemId, sourceItemId);
  if (listenerCount(bus, roomScoped) > 0) {
    bus.emit(roomScoped, payload);
    return true;
  }
  const globalScoped = globalInventoryOnInventoryItemEventId(targetItemId, sourceItemId);
  if (listenerCount(bus, globalScoped) > 0) {
    bus.emit(globalScoped, payload);
    return true;
  }
  bus.emit(roomScoped, payload);
  return false;
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
