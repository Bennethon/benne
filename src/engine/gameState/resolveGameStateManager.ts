import * as Phaser from 'phaser';
import type { GameStateManager } from './GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './registryKey.js';

/**
 * Module-level reference set by {@link setActiveGameStateManager} in `createBenneGame`.
 * Allows facades without a `Phaser.Game` handle (e.g. `GuiBenneScript` constructed before the
 * game exists) to lazily resolve the manager at call time.
 */
let activeManager: GameStateManager | null = null;

export function resolveGameStateManager(game: Phaser.Game): GameStateManager {
  const manager = game.registry.get(BENNE_GAME_STATE_REGISTRY_KEY) as GameStateManager | undefined;
  if (!manager) {
    throw new Error(
      '[Benne] GameStateManager missing from game.registry — createBenneGame must register it.',
    );
  }
  return manager;
}

/** Published by `createBenneGame`; consumed by facades without a `Phaser.Game` handle. */
export function setActiveGameStateManager(manager: GameStateManager | null): void {
  activeManager = manager;
}

/**
 * Returns the active {@link GameStateManager} if one has been published (post-`createBenneGame`),
 * otherwise `null`. Use this from facades like `GuiBenneScript` that are constructed before the
 * Phaser game exists.
 */
export function tryGetActiveGameStateManager(): GameStateManager | null {
  return activeManager;
}
