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

  B.whenInventoryUsedOn('Couch', (payload) => {
    if (payload.itemId === 'Broom' && payload.verbId === 'use') {
      B.player.walkTo('Couch');
      B.player.say('I used the Broom on the Couch.');
    } else if (payload.itemId === 'Broom' && payload.verbId === 'give') {
      B.player.walkTo('Couch');
      B.player.face('U');
      B.player.say('Here, couch.');
    }
  });

  B.whenLookAt('penny', () => {
    B.player.say("It's Penny.");
  });

  B.whenTalkTo('penny', () => {
    B.walkToClicked();
    B.faceClicked();
    B.say`
      Hank: Hello, I am saying something!
      Penny: Oh really? I am too!
      Player: This feels so good!
      `;
    B.character('penny').say('Thats cool.');
    B.player.say('Yes, it is.');
  });

  B.whenLookAt('Couch', () => {
    B.faceClicked();
    B.say`Hank: It's my poorly drawn couch.`;
  });

  B.whenUse('Door', () => {
    B.walkToClicked();
    B.player.faceClicked();
    B.prop('Door').animation = 'Door-open';
    B.room.changeTo('outside');
  });

  B.whenOpen('Door', () => {
    B.player.walkToClicked();
    B.player.faceClicked();
    B.prop('Door').animation = 'Door-open';
    // B.prop('Door').playAnimation('Door-open');
  });

  B.whenPull('Couch', () => {
    B.player.moveTo('apartment-point-1');
  });

  B.whenClose('Couch', () => {
    B.fadeOut(2, 0x00ff00);
    B.wait(1);
    B.fadeIn(2, 0x00ff00);
  });
  B.whenInventoryUsedOn('Bread', (payload) => {
    if (payload.itemId === 'Broom' && payload.verbId === 'use') {
      B.say`Hank: I don't need to clean the bread.`
    } else if (payload.itemId === 'Broom' && payload.verbId === 'give') {
      B.say`Hank: I can't give something to bread.`
    }
  });
});
