import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `henry` — self-only Bennescript (`B.whenLookAt(() => …)`).
 * Room-scoped handlers in `*.room.ts` still run first for the same verb.
 */
registerCharacterScript('henry', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });
  // Delete this line when you add your first handler.
  void B;

  B.whenLookAt(() => {
    B.faceClicked();
    B.player.say('It looks like my buddy, Henry.');
  });

  B.whenPickUp(() => {
    B.faceClicked();
    B.player.say("He's too heavy.");
  });
});
