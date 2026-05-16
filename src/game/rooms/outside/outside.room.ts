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
    B.sound.playMusic('halloween-spooky', { fadeSeconds: 2.0 });
    B.sound.play('doorClose');
    if (B.room.isFirstVisit) {
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
      B.character('henry').startFacingCharacter('hank');
    }
  });

  B.whenUse('door', () => {
    B.walkToClicked();
    B.room.changeTo('apartment');
  });

  B.whenLookAt('door', () => {
    B.faceClicked();
    B.say`Hank: It's the door.`;
  });

  B.whenLookAt('FountainOff', () => {
    B.faceClicked();
    B.say`
    Hank: It's a fountain.
    Hank: It's not running.
    `;
  });

  B.whenUse('FountainOff', () => {
    B.walkToClicked();
    B.wait(.5);
    B.player.say('I don\'t see how to turn it on.');
  });

  B.whenLookAt('FountainOn', () => {
    B.faceClicked();
    B.say`
    Hank: I got it working!.
    `;
  });

  B.whenUse('FountainOn', () => {
    B.faceClicked();
    B.say`
    Hank: Cool!.
    `;
  });

  B.whenLookAt('Rock', () => {
    B.faceClicked();
    B.say`
    Hank: It's a weird looking, out of place rock.
    `;
  });

  B.whenUse('Rock', () => {
    B.walkToClicked();
    B.player.say('I think I can move it.');
    B.prop('Rock').hide();
    B.prop('RockMoved').show();
    B.player.say('Huh, some weird lever hidden under the rock.');
  });



  B.whenLookAt('RockMoved', () => {
    B.faceClicked();
    B.say`
    Hank: I wonder what this lever does...
    `;
  });



  B.whenUse('RockMoved', () => {
    B.walkToClicked();
    B.say`Hank: Let's see what this does...`;
    B.prop('RockMoved').hide();
    B.prop('LeverPulled').show();
    B.prop('FountainOff').hide();
    B.prop('FountainOn').show();
    B.state.setFlag('turnedOnFountain', true);
    B.character('henry').say('WOO HOO! IT\'S WORKING!');
    B.display('You won!');
  });
});
