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
    } else if (payload.itemId === 'Candy1') {
      // TODO
    } else if (payload.itemId === 'Chainsaw') {
      // TODO
    } else if (payload.itemId === 'Key') {
      // TODO
    } else if (payload.itemId === 'Ladder') {
      // TODO
    } else if (payload.itemId === 'Lantern') {
      // TODO
    } else if (payload.itemId === 'Newspaper') {
      // TODO
    } else if (payload.itemId === 'SheetMusic') {
      // TODO
    } else if (payload.itemId === 'Vacuum') {
      // TODO
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
    B.player.say('I like to keep this piller here so I can walk around it.');
  });
});
