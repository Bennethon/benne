import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Lantern', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;

  B.whenUse.doNotActivate(() => {
    B.say`Hank: I used the Lantern.`;
  });
});
