import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Lantern', ({ B }) => {

  B.whenUse.doNotActivate(() => {
    if (B.inventory('Lantern').animation === 'Lantern') {
      B.say`Hank: I will turn on the Lantern.`;
      B.wait(.5);
      B.inventory('Lantern').animation = 'Lantern-glowing';
      B.wait(.5);
      B.say`Hank: There we go!`;
    } else if (B.inventory('Lantern').animation === 'Lantern-glowing') {
      B.say`Hank: I will turn off the Lantern.`;
      B.wait(.5);
      B.inventory('Lantern').animation = 'Lantern';
      B.wait(.5);
      B.say`Hank: There we go!`;
    }
    
  });
}, import.meta.url);
