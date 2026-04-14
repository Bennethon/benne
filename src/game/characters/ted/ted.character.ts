import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `ted` — self-only Bennescript (`B.whenLookAt(() => …)`).
 * Room-scoped handlers in `*.room.ts` still run first for the same verb.
 */
registerCharacterScript('ted', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });

  B.whenLookAt(() => {
    // TODO
  });

  B.whenUse(() => {
    // TODO
  });

  B.whenVerb("slap", () => {
    // TODO
  });
});
