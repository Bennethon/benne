import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('coffee', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenLookAt(() => {
    if (B.inventory('coffee').animation == 'coffee-full') {
      B.say`Hank: A full cup of black coffee.`
    } else {
      B.say`Hank: An empty coffee cup.`
    }
  });
});
