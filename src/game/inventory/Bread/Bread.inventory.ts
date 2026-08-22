import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Bread', ({ B }) => {

  B.whenLookAt(() => {
    B.say`Hank: It's some bread.`;
  });

  B.whenUse(() => {
    // TODO
  });

  B.whenInventoryUsedOn('Bread', (payload) => {
    if (payload.itemId === 'Knife') {
      
      if (B.inventory('Knife').animation === 'Knife') {
        B.say`Hank: It won't do any good without something to spread!`;
      } else {
        B.inventory.add('Sammich');
        B.inventory.remove('Bread');
        B.clearActiveInventory();
        B.say`Hank: This looks delicious!`;
      }
      
      return;
    }
    
    return false;
  });

});
