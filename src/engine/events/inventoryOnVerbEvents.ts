import type { Point2 } from '../../types/room';
import type { VerbInteractTarget } from './verbInteractionEvents';

const VERB_ROOM_PREFIX = 'verb:room:';

/** `verb:room:<roomId>:inventoryOnProp:<propId>:<itemId>` */
export function roomInventoryOnPropEventId(roomId: string, propId: string, itemId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:inventoryOnProp:${propId}:${itemId}`;
}

/** `verb:inventoryOnProp:<propId>:<itemId>` — global fallback after no room-scoped listener. */
export function globalInventoryOnPropEventId(propId: string, itemId: string): string {
  return `verb:inventoryOnProp:${propId}:${itemId}`;
}

/** `verb:room:<roomId>:inventoryOnHotspot:<hotspotId>:<itemId>` */
export function roomInventoryOnHotspotEventId(roomId: string, hotspotId: string, itemId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:inventoryOnHotspot:${hotspotId}:${itemId}`;
}

/** `verb:inventoryOnHotspot:<hotspotId>:<itemId>` */
export function globalInventoryOnHotspotEventId(hotspotId: string, itemId: string): string {
  return `verb:inventoryOnHotspot:${hotspotId}:${itemId}`;
}

/** `verb:room:<roomId>:inventoryOnCharacter:<characterId>:<itemId>` */
export function roomInventoryOnCharacterEventId(roomId: string, characterId: string, itemId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:inventoryOnCharacter:${characterId}:${itemId}`;
}

/** `verb:inventoryOnCharacter:<characterId>:<itemId>` */
export function globalInventoryOnCharacterEventId(characterId: string, itemId: string): string {
  return `verb:inventoryOnCharacter:${characterId}:${itemId}`;
}

export interface InventoryUsedOnPropPayload {
  targetType: 'prop';
  itemId: string;
  verbId: string;
  roomId: string;
  propId: string;
  tag: string;
  description?: string;
  walkToPoint?: Point2;
  lookAtPoint?: Point2;
}

export interface InventoryUsedOnHotspotPayload {
  targetType: 'hotspot';
  itemId: string;
  verbId: string;
  roomId: string;
  hotspotId: string;
  description?: string;
}

export interface InventoryUsedOnCharacterPayload {
  targetType: 'character';
  itemId: string;
  verbId: string;
  roomId: string;
  characterId: string;
  instanceId: string;
  description?: string;
  walkToPoint?: Point2;
  talkPoint?: Point2;
}

export type AnyInventoryUsedOnPayload =
  | InventoryUsedOnPropPayload
  | InventoryUsedOnHotspotPayload
  | InventoryUsedOnCharacterPayload;

export function buildInventoryUsedOnPayload(
  target: VerbInteractTarget,
  itemId: string,
  verbId: string,
): AnyInventoryUsedOnPayload {
  switch (target.type) {
    case 'prop':
      return {
        targetType: 'prop',
        itemId,
        verbId,
        roomId: target.roomId,
        propId: target.propId,
        tag: target.tag,
        description: target.description,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.lookAtPoint !== undefined ? { lookAtPoint: target.lookAtPoint } : {}),
      };
    case 'hotspot':
      return {
        targetType: 'hotspot',
        itemId,
        verbId,
        roomId: target.roomId,
        hotspotId: target.hotspotId,
        description: target.description,
      };
    case 'character':
      return {
        targetType: 'character',
        itemId,
        verbId,
        roomId: target.roomId,
        characterId: target.characterId,
        instanceId: target.instanceId,
        description: target.description,
        ...(target.walkToPoint !== undefined ? { walkToPoint: target.walkToPoint } : {}),
        ...(target.talkPoint !== undefined ? { talkPoint: target.talkPoint } : {}),
      };
  }
}
