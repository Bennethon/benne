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

  B.whenLookAt('Couch', () => {
    B.faceClicked();
    B.say`Hank: It's my weird, poorly drawn couch.`;
  });

  B.whenInventoryUsedOn('Couch', (payload) => {
    if (payload.itemId === 'Broom') {
      B.player.walkTo('Couch');
      B.faceClicked();
      B.player.say('I used the broom on the couch.');
      return;
    }
    return false;
  });


  B.whenLookAt('Door', () => {
    B.player.say('It\'s the door to the outside.');
  });

  B.whenInventoryUsedOn('Door', (payload) => {
    if (payload.itemId === 'Key') {
      B.walkToClicked();
      B.state.setFlag('unlockedDoor', true);
      B.inventory.remove('Key');
      B.player.say('The door is unlocked.');
      return;
    }
    
    return false;
  });

  B.whenLookAt('penny', () => {
    B.player.say('It\'s Penny.');
  });

  B.whenUse('penny', () => {
    B.walkToClicked();
    B.player.say('Hey Penny!');
    B.dialog('chatwithpenny').start();
  });

  B.whenInventoryUsedOn('penny', (payload) => {
    if (payload.itemId === 'Sammich') {
      B.walkToClicked();
      B.say`Hank: Here, Penny! Have a sandwich.`;
      B.inventory.remove('Sammich');
      B.character('penny').say`Thank you! Here's the key.`;
      B.inventory.add('Key');
      return;
    }
    return false;
  });


  B.whenLookAt('Table', () => {
    B.player.say('I like to keep this table here so I can walk around it.');
  });

  B.whenInventoryUsedOn('Table', (payload) => {
    if (payload.itemId === 'Broom') {
      B.walkToClicked();
      B.sound.playAndWait('sweeping');
      B.player.say('I cleaned the table.');
      return;
      return;
    }
    
    return false;
  });


  B.whenLookAt('PeanutButter', () => {
    B.faceClicked();
    B.say`Hank: It's some peanut butter.`;
  });

  B.whenUse('PeanutButter', () => {
    B.walkToClicked();
    B.inventory.add('PB');
    B.prop('PeanutButter').hide();
  });

  B.whenLookAt('Knife', () => {
    B.faceClicked();
    B.say`Hank: It's a knife.`;
  });

  B.whenUse('Knife', () => {
    B.walkToClicked();
    B.inventory.add('Knife');
    B.prop('Knife').hide();
  });

  B.whenLookAt('Bread', () => {
    B.faceClicked();
    B.say`Hank: It's some bread.`;
  });

  B.whenUse('Bread', () => {
    B.walkToClicked();
    B.inventory.add('Bread');
    B.prop('Bread').hide();
  });

  B.whenEnterRoom(() => {
    if (!B.sound.isMusicPlaying()) {
      B.sound.playMusic('my-cat-is-crazy');
    }
  });

  B.whenEnterRoomAfterFade(() => {
    if (B.room.last === 'outside') {
      B.wait(.5);
      B.sound.play('doorClose');
      B.prop('Door').animation = 'Door';
    }
  });

  B.whenUse('Table', () => {
    B.walkToClicked();
  });
});
