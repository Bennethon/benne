import type { Point2 } from '../../types/room';

/** Emitted when no object handler, object fallback, or global handler consumes the verb. */
export const VERB_UNHANDLED_EVENT = 'verb:unhandled';

/** Ultimate global fallback after `verb:global:<verbId>`. */
export const VERB_GLOBAL_FALLBACK_EVENT = 'verb:global:fallback';

const VERB_GLOBAL_PREFIX = 'verb:global:';
const VERB_ROOM_PREFIX = 'verb:room:';
const VERB_CHARACTER_PREFIX = 'verb:character:';

/** `verb:global:<verbId>` — register here for default handling of a verb on any target. */
export function globalVerbHandlerEventId(verbId: string): string {
  return `${VERB_GLOBAL_PREFIX}${verbId}`;
}

function roomTargetTypeAndId(target: VerbInteractTarget): { targetType: string; targetId: string } {
  switch (target.type) {
    case 'prop':
      return { targetType: 'prop', targetId: target.propId };
    case 'hotspot':
      return { targetType: 'hotspot', targetId: target.hotspotId };
    case 'character':
      return { targetType: 'character', targetId: target.characterId };
    case 'inventoryItem':
      throw new Error('Inventory GUI rows do not use room object verb event ids');
  }
}

/** `verb:room:<roomId>:<targetType>:<targetId>:<verbId>` */
export function roomObjectVerbEventId(target: VerbInteractTarget, verbId: string): string {
  const x = roomTargetTypeAndId(target);
  return `${VERB_ROOM_PREFIX}${target.roomId}:${x.targetType}:${x.targetId}:${verbId}`;
}

/** `verb:room:<roomId>:<targetType>:<targetId>:fallback` */
export function roomObjectVerbFallbackEventId(target: VerbInteractTarget): string {
  const x = roomTargetTypeAndId(target);
  return `${VERB_ROOM_PREFIX}${target.roomId}:${x.targetType}:${x.targetId}:fallback`;
}

export function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:prop:${propId}:${verbId}`;
}

export function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:hotspot:${hotspotId}:${verbId}`;
}

export function roomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:character:${characterId}:${verbId}`;
}

export function roomPropVerbFallbackEventId(roomId: string, propId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:prop:${propId}:fallback`;
}

export function roomHotspotVerbFallbackEventId(roomId: string, hotspotId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:hotspot:${hotspotId}:fallback`;
}

export function roomCharacterVerbFallbackEventId(roomId: string, characterId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:character:${characterId}:fallback`;
}

/** `verb:character:<characterId>:<verbId>` */
export function characterVerbEventId(characterId: string, verbId: string): string {
  return `${VERB_CHARACTER_PREFIX}${characterId}:${verbId}`;
}

/** `verb:character:<characterId>:fallback` */
export function characterVerbFallbackEventId(characterId: string): string {
  return `${VERB_CHARACTER_PREFIX}${characterId}:fallback`;
}

export type VerbInteractTarget =
  | {
      type: 'prop';
      propId: string;
      tag: string;
      roomId: string;
      description?: string;
      /** Optional hints from room JSON for script-driven walk/face (not applied by the engine on click). */
      walkToPoint?: Point2;
      lookAtPoint?: Point2;
    }
  | {
      type: 'hotspot';
      hotspotId: string;
      roomId: string;
      description?: string;
      walkToPoint?: Point2;
      lookAtPoint?: Point2;
    }
  | {
      type: 'character';
      characterId: string;
      instanceId: string;
      roomId: string;
      description?: string;
      /** World / room pixel stand hint when `CharacterData.walkToPoint` is set (sprite origin + offset). */
      walkToPoint?: Point2;
      /** World / room pixel look-at hint when `CharacterData.talkPoint` is set (sprite origin + offset). */
      talkPoint?: Point2;
    }
  | {
      type: 'inventoryItem';
      itemId: string;
      roomId: string;
      description?: string;
    };

/**
 * Payload for {@link VERB_GLOBAL_FALLBACK_EVENT} and {@link globalVerbHandlerEventId} emissions
 * (flat object from `dispatchVerb`; which optional ids are set depends on target type).
 */
export type VerbGlobalFallbackPayload = {
  verbId: string;
  roomId: string;
  description?: string;
  propId?: string;
  tag?: string;
  hotspotId?: string;
  characterId?: string;
  instanceId?: string;
  /** Set when the interaction target is an inventory panel row (`dispatchInventoryVerbInteraction` global chain). */
  inventoryItemId?: string;
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
  talkPoint?: Point2;
  verbFallback?: boolean;
};

export type VerbUnhandledPayload = {
  verbId: string;
  target: VerbInteractTarget;
  fallbackLine: string;
};
