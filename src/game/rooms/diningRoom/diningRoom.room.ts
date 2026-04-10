import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `diningRoom` — keep handlers for this room here (PowerQuest-style).
 *
 * String ids must match your `diningRoom.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / … : props, hotspots, and characters (`props[]` → `hotspots[]` → `CharacterData.id`).
 * - `whenVerb(verbId, targetId, …)`: custom verb; same resolution.
 * - `whenGive`: prop recipient only (for now).
 * - `B.prop('…')` / `onProp`: `props[].id` only.
 * - `B.character('…')`: `CharacterData.id` in this room.
 * - `walkTo('…')`: prop → hotspot → character → `points[].id`, or `{ x, y }` room pixels.
 */
registerRoomScript(() => {});
