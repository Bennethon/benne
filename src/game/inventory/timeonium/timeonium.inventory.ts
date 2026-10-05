import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('timeonium', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenLookAt(() => {
    B.say`Hank: Timeonium. The magic juice that makes time travel possible.`
  });
});
