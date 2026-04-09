import { registerRoomScript } from '@engine/scripting';

/**
 * String ids: `when*` / `B.prop` → `props[].id` in this room JSON (not hotspots — use `B.raw.on` +
 * `roomHotspotVerbEventId` if needed). `B.character` / `whenTalkTo` → `CharacterData.id` in the room.
 * `walkTo('…')` → prop id → hotspot id → character id → `points[].id`, or `{ x, y }` room pixels.
 */
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