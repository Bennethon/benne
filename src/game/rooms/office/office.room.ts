import { registerRoomScript } from '@engine/scripting';

/**
 * `whenLookAt` / `whenUse` / `whenTalkTo` / `whenPickUp` / … / `whenVerb` → prop → hotspot → character id. `B.prop` / `onProp` → props only.
 * `walkTo('…')` → same order, then `points[].id`, or `{ x, y }` room pixels.
 */
registerRoomScript(({ B }) => {
  console.log('🚀 Bennescript office.room.ts is being EXECUTED!');

  B.whenLookAt('henry', () => {
    console.log('✅ B.whenLookAt("henry") fired!');
    B.player.say('Hello from Bennescript!');
  });

  B.whenUse('desk', () => {
    console.log('✅ B.whenUse("desk") fired!');

    B.character('henry').walkTo('office-point-1');

    B.player.walkTo('henry');

    B.player.say('Hello from Bennescript! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.');
  });

  B.whenLookAt('office-prop-cyberbuddy', () => {
    // TODO
  });

  B.whenUse('office-prop-cyberbuddy', () => {
    // TODO
  });

  B.whenLookAt('office-prop-glasses', () => {
    // TODO
  });

  B.whenUse('office-prop-glasses', () => {
    // TODO
  });


  B.whenUse('henry', () => {
    B.player.walkTo('henry');
    B.player.say('Hello from Bennescript! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.');
    B.character('henry').say('SUP DUDE!');
  });
});