import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Broom', ({ B }) => {
  B.whenLookAt(() => {
    B.player.say('…');
  });

  B.whenUse(() => {
    B.player.say('…');
  });
});
