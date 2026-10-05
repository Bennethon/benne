import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `customer` — self-only Bennescript (`B.whenLookAt(() => …)`).
 * Room-scoped handlers in `*.room.ts` still run first for the same verb.
 */
registerCharacterScript('customer', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });
  // Delete this line when you add your first handler.
  void B;
});
