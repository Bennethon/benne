import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Key', ({ B }) => {

  B.whenLookAt(() => {
    B.say`Hank: It's a key.`;
  });

  B.whenUse(() => {
    // TODO
  });
});
