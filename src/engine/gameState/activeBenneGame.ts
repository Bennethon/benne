import * as Phaser from 'phaser';

/**
 * Module-level handle set by {@link import('../Game.js').createBenneGame} so verb dispatch can
 * reach the active {@link import('../scenes/RoomScene.js').RoomScene} without threading `Phaser.Game`
 * through every API.
 */
let activeGame: Phaser.Game | null = null;

export function setActiveBenneGame(game: Phaser.Game | null): void {
  activeGame = game;
}

export function tryGetActiveBenneGame(): Phaser.Game | null {
  return activeGame;
}
