import { getGameSettings } from '../ConfigManager';
import type { EventBus } from '../events/EventBus';
import { interruptPlayerWalkForVerbInteraction } from '../scenes/interruptPlayerWalkForVerbInteraction.js';
import type { VerbInteractTarget, VerbUnhandledPayload } from '../events/verbInteractionEvents';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  characterVerbEventId,
  characterVerbFallbackEventId,
  globalVerbHandlerEventId,
  roomObjectVerbEventId,
  roomObjectVerbFallbackEventId,
} from '../events/verbInteractionEvents';

/** Per-target options for verb dispatch (object-level fallback only; per-verb routing is listener-first). */
export type VerbHandlerMap = {
  onVerbFallback: boolean;
};

function listenerCount(bus: EventBus, event: string): number {
  return bus.listeners(event).length;
}

function buildEmitPayload(target: VerbInteractTarget, verbId: string): Record<string, unknown> {
  switch (target.type) {
    case 'prop':
      return {
        propId: target.propId,
        roomId: target.roomId,
        tag: target.tag,
        description: target.description,
        verbId,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.lookAtPoint !== undefined ? { lookAtPoint: target.lookAtPoint } : {}),
      };
    case 'hotspot':
      return {
        hotspotId: target.hotspotId,
        roomId: target.roomId,
        description: target.description,
        verbId,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.lookAtPoint !== undefined ? { lookAtPoint: target.lookAtPoint } : {}),
      };
    case 'character':
      return {
        characterId: target.characterId,
        instanceId: target.instanceId,
        roomId: target.roomId,
        description: target.description,
        verbId,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.talkPoint !== undefined ? { talkPoint: target.talkPoint } : {}),
      };
    case 'inventoryItem':
      return {
        verbId,
        roomId: target.roomId,
        inventoryItemId: target.itemId,
        ...(target.description !== undefined ? { description: target.description } : {}),
      };
  }
}

/**
 * Dispatch order (listener-first): room-scoped per-verb (props/hotspots/characters) → global character
 * per-verb → object `onVerbFallback` channels (when enabled, if listeners) → `verb:global:<verbId>` →
 * `verb:global:fallback` → `verb:unhandled` (+ dev `console.warn`).
 *
 * Active inventory + use / active-verb clicks are handled separately by
 * {@link import('./dispatchInventoryOnVerbTarget.js').dispatchInventoryOnVerbTargetInteraction}.
 */
export function dispatchVerbInteraction(
  bus: EventBus,
  verbId: string,
  handlers: VerbHandlerMap,
  target: VerbInteractTarget,
): void {
  interruptPlayerWalkForVerbInteraction();
  const settings = getGameSettings();
  const payload = buildEmitPayload(target, verbId);

  if (target.type === 'character') {
    const roomScoped = roomObjectVerbEventId(target, verbId);
    if (listenerCount(bus, roomScoped) > 0) {
      bus.emit(roomScoped, payload);
      return;
    }
    const globalCharacter = characterVerbEventId(target.characterId, verbId);
    if (listenerCount(bus, globalCharacter) > 0) {
      bus.emit(globalCharacter, payload);
      return;
    }
  } else if (target.type === 'prop' || target.type === 'hotspot') {
    const roomScoped = roomObjectVerbEventId(target, verbId);
    if (listenerCount(bus, roomScoped) > 0) {
      bus.emit(roomScoped, payload);
      return;
    }
  }

  if (handlers.onVerbFallback) {
    if (target.type === 'character') {
      const roomScopedFallback = roomObjectVerbFallbackEventId(target);
      if (listenerCount(bus, roomScopedFallback) > 0) {
        bus.emit(roomScopedFallback, { ...payload, verbFallback: true });
        return;
      }
      const globalCharacterFallback = characterVerbFallbackEventId(target.characterId);
      if (listenerCount(bus, globalCharacterFallback) > 0) {
        bus.emit(globalCharacterFallback, { ...payload, verbFallback: true });
        return;
      }
    } else if (target.type === 'prop' || target.type === 'hotspot') {
      const fallbackId = roomObjectVerbFallbackEventId(target);
      if (listenerCount(bus, fallbackId) > 0) {
        bus.emit(fallbackId, { ...payload, verbFallback: true });
        return;
      }
    }
  }

  const globalVerb = globalVerbHandlerEventId(verbId);
  if (listenerCount(bus, globalVerb) > 0) {
    bus.emit(globalVerb, payload);
    return;
  }

  if (listenerCount(bus, VERB_GLOBAL_FALLBACK_EVENT) > 0) {
    bus.emit(VERB_GLOBAL_FALLBACK_EVENT, payload);
    return;
  }

  const fallbackLine = settings.defaultFallbackLine ?? "That doesn't work.";
  const unhandled: VerbUnhandledPayload = {
    verbId,
    target,
    fallbackLine,
  };
  bus.emit(VERB_UNHANDLED_EVENT, unhandled);

  if (import.meta.env.DEV) {
    console.warn(
      `[Benne] Unhandled verb "${verbId}" on ${target.type} (no object/global handler). Message: "${fallbackLine}"`,
      target,
    );
  }
}
