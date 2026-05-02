import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Sammich', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.
  void B; // keep this until you add real handlers

  B.whenLookAt(() => {
    B.player.say('It looks delicious!');
  });

  B.whenUse.doNotActivate(() => {
    B.player.say('I am not hungry right now.');
  });
}, import.meta.url);
