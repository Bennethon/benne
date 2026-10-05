import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('antenna', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.

  B.whenInventoryUsedOn('antenna', (payload) => {
    if (payload.itemId === 'magnet') {
      B.inventory.remove(`antenna`);
      B.inventory.remove(`magnet`);
      B.sound.play('whip');
      B.inventory.add(`magnetStick`);
      B.player.say(`Cool!`);
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });


  B.whenLookAt(() => {
    B.say`Hank: An old broken car antenna.`
  });
});
