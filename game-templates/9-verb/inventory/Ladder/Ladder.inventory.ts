import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Ladder', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;

  B.whenInventoryUsedOn('Ladder', (payload) => {
    if (payload.itemId === 'Broom') {
      B.player.say('I used the Broom on the Ladder.');
    }
  });

});
