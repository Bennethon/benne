import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {
  console.log('🚀 Bennescript office.room.ts is being EXECUTED!');

  B.whenLookAt('desk', () => {
    console.log('✅ B.whenLookAt("desk") fired!');
    B.say("Hello from Bennescript!");
  });

  B.whenUse('desk', () => {
    console.log('✅ B.whenUse("desk") fired!');
  });
});