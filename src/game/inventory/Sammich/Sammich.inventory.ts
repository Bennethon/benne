import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Sammich', ({ B }) => {

  B.whenLookAt(() => {
    B.say`Hank: It looks delicious!`;
  });

  B.whenUse(() => {
    // TODO
  });
});
