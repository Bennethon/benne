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
      B.walkToClicked();
      B.faceClicked();
      B.player.say('I used the Broom on the Pillar.');
    }
  });

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

  B.whenLookAt('Pillar', () => {
    B.player.say('I like to keep this pillar here so I can walk around it.');
  });

  B.whenLookAt('henry', () => {
    B.player.say('Henry is in the room.');
  });

  B.whenTalkTo('henry', () => {
    B.walkToClicked();
    B.faceClicked();
    B.say`
      Hank: Hello, I am saying something!
      Henry: Oh really? I am too!
      Player: This feels so good!
      `;
    B.character('henry').say('Thats cool.');
    B.player.say('Yes, it is.');
  });

  B.whenLookAt('Couch', () => {
    B.faceClicked();
    B.say`Hank: It's my poorly drawn couch.`;
  });

  B.whenUse('Door', () => {
    // TODO
  });

  B.whenOpen('Door', () => {
    B.player.walkToClicked();
    B.player.faceClicked();
    B.prop('Door').animation = 'Door-open';
    // B.prop('Door').playAnimation('Door-open');
  });

  B.whenPush('henry', () => {
    B.character('henry').playAnimation('WalkU');
    // B.character('henry').animation = 'WalkU';
  });
});
