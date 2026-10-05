import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `hank` — self-only Bennescript (`B.whenLookAt(() => …)`).
 * Room-scoped handlers in `*.room.ts` still run first for the same verb.
 */
registerCharacterScript('hank', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });
  // Delete this line when you add your first handler.
  void B;
});
