import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('PB', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenInventoryUsedOn('PB', (payload) => {
    if (payload.itemId === 'Knife' && payload.verbId === 'use') {
      if (B.inventory('PB').animation === 'PB') {
        B.say`Hank: I need to open the jar first.`;
      } else {
        B.inventory('Knife').animation = 'Knife-PB';
        B.say`Hank: Mmmm... gooey peanut butter.`;
      }
    }
  });

  B.whenOpen(() => {
    B.inventory('PB').animation = 'PB-open';
    B.say`Hank: I opened the jar.`;
  });
});
