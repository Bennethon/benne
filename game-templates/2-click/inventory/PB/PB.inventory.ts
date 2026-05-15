import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('PB', ({ B }) => {

  B.whenLookAt(() => {
    B.say`Hank: It's some peanut butter.`;
  });

  B.whenUse.doNotActivate(() => {
    if (B.inventory('PB').animation === 'PB') {
      B.inventory('PB').animation = 'PB-open';
      B.say`Hank: I opened the jar.`;
    } else {
      B.say`Hank: It's already open.`;
    }
  });

  B.whenInventoryUsedOn('PB', (payload) => {
    if (payload.itemId === 'Knife') {
      
      if (B.inventory('PB').animation === 'PB') {
        B.say`Hank: I need to open the jar first.`;
      } else {
        B.inventory('Knife').animation = 'Knife-PB';
        B.inventory('Knife').cursorAnimation = 'Knife-PB';
        B.say`Hank: Mmmm... gooey peanut butter.`;
      }
      
      return;
    }
    
    return false;
  });

});
