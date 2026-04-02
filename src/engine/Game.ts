import * as Phaser from 'phaser';
import { createGameConfig } from './gameConfig';

/**
 * Creates the root {@link Phaser.Game} instance (Benne engine entry).
 * Resolution and scale mode come from `src/game/game-config.json` via {@link createGameConfig}.
 */
export function createBenneGame(parent: HTMLElement | string): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}
