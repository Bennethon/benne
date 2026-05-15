import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `apartment` — keep handlers for this room here (PowerQuest-style).
 *
 * String ids must match your `apartment.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / `whenPush` / `whenPull` / `whenOpen` / `whenClose`: work on props, hotspots, and characters — same string id, resolution order `props[]` → `hotspots[]` → `CharacterData.id` in this room.
 * - `whenVerb(verbId, targetId, …)`: any verb id from game config; same target resolution.
 * - `whenGive`: prop recipient only (for now).
 * - `B.prop('…')` / `onProp`: `props[].id` only.
 * - `B.character('…')`: `CharacterData.id` for a character in this room.
 * - `walkTo('…')`: unified target — prop id → hotspot id → character id → `points[].id`, or `{ x, y }` in room pixels.
 */
registerRoomScript(({ B }) => {
  // Delete this line when you add your first handler.
  void B;
  B.whenInventoryUsedOn('Pillar', (payload) => {
    if (payload.itemId === 'Broom') {
      B.player.walkTo('Pillar');
      B.player.say('I used the Broom on the Pillar.');
      return;
    }
    return false;
  });

  B.whenUse('Pillar', () => {
    B.player.walkTo('Pillar');
    B.player.say('I used the Pillar.');
  });

  B.whenLookAt('Pillar', () => {
    B.player.say('I like to keep this pillar here so I can walk around it.');
  });

  B.whenUse('Door', () => {
    B.walkToClicked();

    if (B.state.getFlag('unlockedDoor')) {
      B.prop('Door').animation = 'Door-open';
      B.sound.playAndWait('doorOpen');
      B.room.changeTo('outside');
    } else {
      B.say`Hank: The door is locked.`;
      B.display('The door is locked. AHH! I can\'t get out! HELP ME! HELP ME! SOMEBODY HELP ME! PLEASE HELP ME!');
      B.display('Ok calm down.');
    }
  });
});
