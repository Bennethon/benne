const VERB_ROOM_PREFIX = 'verb:room:';
const VERB_INVENTORY_PREFIX = 'verb:inventory:';

/** `verb:room:<roomId>:inventory:<itemId>:<verbId>` */
export function roomInventoryVerbEventId(roomId: string, itemId: string, verbId: string): string {
  return `${VERB_ROOM_PREFIX}${roomId}:inventory:${itemId}:${verbId}`;
}

/** `verb:inventory:<itemId>:<verbId>` — global inventory handler (after no room-scoped listener). */
export function inventoryVerbEventId(itemId: string, verbId: string): string {
  return `${VERB_INVENTORY_PREFIX}${itemId}:${verbId}`;
}

export interface InventoryVerbInteractPayload {
  itemId: string;
  roomId: string;
  verbId: string;
}
