import * as Phaser from 'phaser';
import type { GameStateManager } from './GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './registryKey.js';

export function resolveGameStateManager(game: Phaser.Game): GameStateManager {
  const manager = game.registry.get(BENNE_GAME_STATE_REGISTRY_KEY) as GameStateManager | undefined;
  if (!manager) {
    throw new Error(
      '[Benne] GameStateManager missing from game.registry — createBenneGame must register it.',
    );
  }
  return manager;
}
