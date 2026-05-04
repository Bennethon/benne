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
    B.player.face('R');
  });

  B.whenEnterRoomAfterFade(() => {
    B.character('henry').say('Hey, Hank!');
    B.character('henry').say('Come here!');
    B.player.walkTo('henry');
    B.player.say('What\'s up?');
    B.character('henry').walkTo('henry-fountain');
    B.character('henry').face('L');
    B.character('henry').say('Check out this fountain!');
    B.player.walkTo('FountainOff');
    B.player.face('R');
    B.wait(1);
    B.player.say('What about it?');
    B.character('henry').say('I need you to turn it on. It\'s really important.');
    B.player.say('Uh, ok.');
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


  B.whenLookAt('door', () => {
    B.faceClicked();
    B.say`Hank: It's the door to the apartment.`;
  });

  B.whenLookAt('FountainOff', () => {
    B.faceClicked();
    B.say`
    Hank: It's a fountain.
    Hank: It's not running.
    `;
  });

  B.whenLookAt('FountainOn', () => {
    B.faceClicked();
    B.say`
    Hank: The fountain is running!.
    `;
  });

  B.whenLookAt('Rock', () => {
    B.faceClicked();
    B.say`
    Hank: It's a weird looking, out of place rock.
    `;
  });

  B.whenPush('Rock', () => {
    B.walkToClicked();
    B.player.faceClicked();
    B.player.say('I think I can move it.');
    B.prop('Rock').hide();
    B.prop('RockMoved').show();
    B.player.say('Huh.');
  });
});
