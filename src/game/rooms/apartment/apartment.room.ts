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

  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('my-cat-is-crazy');
  });

  B.whenInventoryUsedOn('Couch', (payload) => {
    if (payload.itemId === 'Broom' && payload.verbId === 'use') {
      B.player.walkTo('Couch');
      B.faceClicked();
      B.player.say('I used the broom on the couch.');
      return;
    }
    if (payload.itemId === 'Broom' && payload.verbId === 'give') {
      B.player.walkTo('Couch');
      B.player.face('U');
      B.player.say('Here, couch.');
      B.inventory.remove('Broom');
      return;
    }
    return false;
  });

  B.whenLookAt('penny', () => {
    B.player.say("It's Penny.");
  });

  B.whenTalkTo('penny', () => {
    B.walkToClicked();
    B.say`
      Hank: Hey Penny!
      Penny: Hi!
      `;
    B.dialog("chatwithpenny").start();
  });

  B.whenLookAt('Couch', () => {
    B.faceClicked();
    B.say`Hank: It's my weird, magical, poorly drawn couch.`;
  });

  const handleOpenOrUseDoor = () => {
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
  };
  
  B.whenOpen('Door', handleOpenOrUseDoor); 
  B.whenUse('Door', handleOpenOrUseDoor);

  B.whenPull('Couch', () => {
    B.walkToClicked();
    B.player.say('It\'s too heavy.');
  });

  B.whenClose('Couch', () => {
    B.fadeOut(2, 0x00ff00);
    B.wait(1);
    B.fadeIn(2, 0x00ff00);
  });
  
  B.whenInventoryUsedOn('Bread', (payload) => {
    if (payload.itemId === 'Broom' && payload.verbId === 'use') {
      B.say`Hank: I don't need to clean the bread.`;
      return;
    }
    if (payload.itemId === 'Broom' && payload.verbId === 'give') {
      B.say`Hank: I can't give something to bread.`;
      return;
    }
    return false;
  });

  B.whenLookAt('Bread', () => {
    B.say`Hank: It's some bread.`;
  });

  B.whenPickUp('Bread', () => {
    B.walkToClicked();
    B.inventory.add('Bread');
    B.prop('Bread').hide();
  });

  B.whenLookAt('Knife', () => {
    B.faceClicked();
    B.say`Hank: It's a knife.`;
  });

  B.whenPickUp('Knife', () => {
    B.walkToClicked();
    B.inventory.add('Knife');
    B.prop('Knife').hide();
  });

  B.whenLookAt('PeanutButter', () => {
    B.say`Hank: It's some peanut butter.`;
  });

  B.whenPickUp('PeanutButter', () => {
    B.walkToClicked();
    B.inventory.add('PB');
    B.prop('PeanutButter').hide();
  });

  B.whenLookAt('Table', () => {
    B.player.say('I like to keep this table here so I can walk around it.');
  });

  B.whenInventoryUsedOn('penny', (payload) => {
    if (payload.itemId === 'Sammich' && payload.verbId === 'give') {
      B.walkToClicked();
      B.say`Hank: Here, Penny! Have a sandwich.`;
      B.inventory.remove('Sammich');
      B.character('penny').say`Thank you! Here's the key.`;
      B.inventory.add('Key');
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });
  B.whenInventoryUsedOn('Door', (payload) => {
    if (payload.itemId === 'Key' && payload.verbId === 'use') {
      B.walkToClicked();
      B.state.setFlag('unlockedDoor', true);
      B.inventory.remove('Key');
      B.player.say('The door is unlocked.');
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.playFrom("gotKey", () => {
    B.inventory.add('Key');
  });

  B.playFrom("doorUnlocked", () => {
    B.state.setFlag('unlockedDoor', true);
  });


  B.whenInventoryUsedOn('Table', (payload) => {
    if (payload.itemId === 'Broom' && payload.verbId === 'use') {
      B.walkToClicked();
      B.sound.playAndWait('sweeping');
      B.player.say('I cleaned the table.');
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenOpen('Couch', () => {
    B.prop('Couch').fade(1, 0.5, 1);
  });

  B.whenOpen('penny', () => {
    B.character('penny').fade(1, 0.5, 1);
  });
});
