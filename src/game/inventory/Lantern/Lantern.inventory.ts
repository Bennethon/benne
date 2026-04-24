import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Lantern', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;

  B.whenUse.doNotActivate(() => {
    if (B.inventory('Lantern').animation === 'Lantern') {
      B.say`Hank: I will turn on the Lantern.`;
      B.wait(500);
      B.inventory('Lantern').animation = 'Lantern-glowing';
      B.wait(500);
      B.say`Hank: There we go!`;
    } else if (B.inventory('Lantern').animation === 'Lantern-glowing') {
      B.say`Hank: I will turn off the Lantern.`;
      B.wait(500);
      B.inventory('Lantern').animation = 'Lantern';
      B.wait(500);
      B.say`Hank: There we go!`;
    }
    
  });
});
