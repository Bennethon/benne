import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import {
  buildInventoryUsedOnPayload,
  globalInventoryOnCharacterEventId,
  globalInventoryOnHotspotEventId,
  globalInventoryOnPropEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnPropEventId,
} from '../events/inventoryOnVerbEvents';
import type { VerbInteractTarget } from '../events/verbInteractionEvents';
import type { GameStateManager } from '../gameState/GameStateManager';
import type { GameSettings } from '../../types/game';
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
): void {
  const payload = buildInventoryUsedOnPayload(target, itemId, verbId);

  switch (target.type) {
    case 'prop': {
      const roomScoped = roomInventoryOnPropEventId(target.roomId, target.propId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return;
      }
      const globalScoped = globalInventoryOnPropEventId(target.propId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return;
      }
      bus.emit(roomScoped, payload);
      return;
    }
    case 'hotspot': {
      const roomScoped = roomInventoryOnHotspotEventId(target.roomId, target.hotspotId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return;
      }
      const globalScoped = globalInventoryOnHotspotEventId(target.hotspotId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return;
      }
      bus.emit(roomScoped, payload);
      return;
    }
    case 'character': {
      const roomScoped = roomInventoryOnCharacterEventId(target.roomId, target.characterId, itemId);
      if (listenerCount(bus, roomScoped) > 0) {
        bus.emit(roomScoped, payload);
        return;
      }
      const globalScoped = globalInventoryOnCharacterEventId(target.characterId, itemId);
      if (listenerCount(bus, globalScoped) > 0) {
        bus.emit(globalScoped, payload);
        return;
      }
      bus.emit(roomScoped, payload);
      return;
    }
  }
}

/** Convenience for call sites that already read {@link getGameSettings}. */
export function shouldDispatchInventoryUsedOnVerbForGame(
  manager: GameStateManager,
  verbId: string,
  resolution: PointerVerbResolution,
): boolean {
  return shouldDispatchInventoryUsedOnVerb(manager, getGameSettings(), verbId, resolution);
}
