import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('magnet', ({ B }) => {
  // "Use" / "Give" on this item will automatically make it active for combining with world targets.
  // Add B.whenUse / B.whenGive only if you need extra behavior (sound, dialogue, consumption, etc.).
  // Use B.whenUse.doNotActivate / B.whenGive.doNotActivate if this item should never become active.

  B.whenInventoryUsedOn('magnet', (payload) => {
    if (payload.itemId === 'antenna') {
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
    B.say`Hank: A cute promotional magnet for the friendly AI overlord.`
  });

});
