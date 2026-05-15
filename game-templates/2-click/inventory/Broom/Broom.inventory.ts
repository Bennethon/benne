import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Broom', ({ B }) => {

  B.whenLookAt(() => {
    B.say`Hank: It's a broom.`;
  });

  B.whenUse(() => {
    // TODO
  });
});
