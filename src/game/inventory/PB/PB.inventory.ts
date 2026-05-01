import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('PB', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenInventoryUsedOn('PB', (payload) => {
    if (payload.itemId === 'Knife' && payload.verbId === 'use') {
      B.say`Hank: I used the Knife on the PB.`;
    }
  });

});
