import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Ladder', ({ B }) => {
  B.whenLookAt(() => {
    B.player.say('…');
  });

  B.whenUse(() => {
    B.player.say('…');
  });
});
