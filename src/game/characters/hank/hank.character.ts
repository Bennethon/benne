import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `hank` — Bennescript on this character’s global verb channel (room-scoped handlers win first).
 */
registerCharacterScript('hank', ({ B }) => {
  B.whenLookAt(() => {
    // TODO
  });

  B.whenUse(() => {
    // TODO
  });
});
