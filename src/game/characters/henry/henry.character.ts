import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for `henry` — Bennescript on this character’s global verb channel (room-scoped handlers win first).
 */
registerCharacterScript('henry', ({ B }) => {
  B.whenLookAt(() => {
    // TODO
  });
});
