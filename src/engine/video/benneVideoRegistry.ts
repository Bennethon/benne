import type * as Phaser from 'phaser';

/**
 * When true, scripted video playback (`B.video.*` / {@link import('../scenes/RoomScene.js').RoomScene})
 * no-ops and the boot loader skips video assets, so editor previews never play cinematics.
 * Set from preview `Phaser.Game` `callbacks.preBoot`; shipped runtime leaves unset/false.
 */
export const BENNE_VIDEO_SCRIPT_DISABLED_KEY = 'benneVideoScriptDisabled';

export function isBenneVideoScriptDisabled(game: Phaser.Game): boolean {
  return game.registry.get(BENNE_VIDEO_SCRIPT_DISABLED_KEY) === true;
}
