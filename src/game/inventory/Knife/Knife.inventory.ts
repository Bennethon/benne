import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Knife', ({ B }) => {

  B.whenUse(() => {
    // TODO
  });

  B.whenLookAt(() => {
    B.say`Hank: It's a knife.`;
  });
});
