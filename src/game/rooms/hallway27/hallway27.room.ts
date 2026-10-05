import { registerRoomScript } from '@engine/scripting';

/**
 * Room script for `hallway27` — keep handlers for this room here.
 *
 * String ids must match your `hallway27.room.json` (and character JSON where noted):
 * - `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / `whenPush` / `whenPull` / `whenOpen` / `whenClose`: work on props, hotspots, and characters — same string id, resolution order `props[]` → `hotspots[]` → `CharacterData.id` in this room.
 * - `whenVerb(verbId, targetId, …)`: any verb id from game config; same target resolution.
 * - `whenGive`: prop recipient only (for now); armed give/use on world targets → `whenInventoryUsedOn` (props, hotspots, characters) — filter `payload.itemId` / `payload.verbId`.
 * - `B.prop('…')` / `onProp`: `props[].id` only.
 * - `B.character('…')`: `CharacterData.id` for a character in this room.
 * - `walkTo('…')`: unified target — prop id → hotspot id → character id → `points[].id`, or `{ x, y }` in room pixels.
 */
registerRoomScript(({ B }) => {
  // Delete this line when you add your first handler.
  void B;

  B.whenEnterRoomAfterFade(() => {
    B.wait(1);
    B.player.face("D");
    B.wait(.5);
    B.player.say(`Well, that about does it for the hallway.`);
    B.player.say(`Time to clean the lab.`);
  });

  B.whenLookAt('door-outside', () => {
    B.faceClicked();
    B.player.say(`That's the door to outside.`)
  });

  B.whenUse('door-outside', () => {
    B.walkToClicked();
    B.player.say(`I'm not done with my rounds. I can't leave!`)
  });

  B.whenLookAt('door-lab', () => {
    B.faceClicked();
    B.player.say(`That's the high tech time lab.`);
    B.player.say(`I need to clean in there.`);
  });

  B.whenUse('door-lab', () => {
    B.walkToClicked();
    B.player.say(`Last room of the night. Let's finish this up and I can go home.`);
    B.wait(.5);
    B.room.changeTo('lab27');
  });
  
  B.whenLookAt('bulliten-board', () => {
    B.walkToClicked();
    B.say`Hank: I never understand any of this science stuff.`
  });

  B.whenLookAt('cleaning-stuff', () => {
    B.faceClicked();
    B.say`Hank: Standard issue, janitorial equipment.`;
  });

  B.whenPickUp('cleaning-stuff', () => {
    B.faceClicked();
    B.say`Hank: I don't need any of that right now.`;
  });

  B.whenUse('cleaning-stuff', () => {
    B.faceClicked();
    B.say`Hank: I don't need any of that right now.`;
  });

  B.whenVerb('clean', 'cleaning-stuff', () => {
    B.faceClicked();
    B.say`Hank: Clean the cleaning supplies? That's crazy.`;
  });
});
