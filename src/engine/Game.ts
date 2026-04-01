import * as Phaser from 'phaser';
import { createGameConfig } from './gameConfig';

/**
 * Creates the root {@link Phaser.Game} instance (Benne engine entry).
 */
export function createBenneGame(parent: HTMLElement | string): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}
