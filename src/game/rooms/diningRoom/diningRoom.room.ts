import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `diningRoom` — keep handlers for this room here (PowerQuest-style).
 *
 * String ids must match your `diningRoom.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / … / `B.prop('…')`: `props[].id` (not hotspots — use `B.raw.on` + `roomHotspotVerbEventId` if needed).
 * - `B.character('…')` / `whenTalkTo('…')`: `CharacterData.id` for a character placed in this room.
 * - `walkTo('…')`: unified target — prop id → hotspot id → character id → `points[].id`, or `{ x, y }` in room pixels.
 */
registerRoomScript(({ B }) => {
});
