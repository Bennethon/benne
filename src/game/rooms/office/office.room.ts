import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {
  console.log('🚀 Bennescript office.room.ts is being EXECUTED!');

  B.whenLookAt('desk', () => {
    console.log('✅ B.whenLookAt("desk") fired!');
    B.player.say('Hello from Bennescript!');
  });

  B.whenUse('desk', () => {
    console.log('✅ B.whenUse("desk") fired!');

    B.character('henry').walkTo('office-point-1');
    B.player.say('Hello from Bennescript!');
  });
});