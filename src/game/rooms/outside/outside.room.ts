import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `outside` — keep handlers for this room here (PowerQuest-style).
 *
 * String ids must match your `outside.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / `whenPush` / `whenPull` / `whenOpen` / `whenClose`: work on props, hotspots, and characters — same string id, resolution order `props[]` → `hotspots[]` → `CharacterData.id` in this room.
 * - `whenVerb(verbId, targetId, …)`: any verb id from game config; same target resolution.
 * - `whenGive`: prop recipient only (for now).
 * - `B.prop('…')` / `onProp`: `props[].id` only.
 * - `B.character('…')`: `CharacterData.id` for a character in this room.
 * - `walkTo('…')`: unified target — prop id → hotspot id → character id → `points[].id`, or `{ x, y }` in room pixels.
 */
registerRoomScript(({ B }) => {
  B.whenEnterRoom(() => {
    B.player.moveTo.now('enter-from-door');
  });

  const handleOpenOrUseDoor = () => {
    B.walkToClicked();
    B.player.faceClicked();

    if (B.state.getFlag('unlockedDoor')) {
      B.room.changeTo('apartment');
    } else {
      B.say`Hank: The door is locked.`;
    }
  };
  
  B.whenOpen('door', handleOpenOrUseDoor); 
  B.whenUse('door', handleOpenOrUseDoor);

});
