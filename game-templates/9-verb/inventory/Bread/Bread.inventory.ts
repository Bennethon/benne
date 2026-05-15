import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Bread', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenInventoryUsedOn('Bread', (payload) => {
    if (payload.itemId === 'Knife' && payload.verbId === 'use') {
      if (B.inventory('Knife').animation === 'Knife') {
        B.say`Hank: It won't do any good without something to spread!`;
      } else {
        B.inventory.add('Sammich');
        B.inventory.remove('Bread');
        B.say`Hank: This looks delicious!`;
      }

      return;
    }

    return false;
  });

});
