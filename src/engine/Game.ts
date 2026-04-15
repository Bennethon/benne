import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager.js';
import { gameEvents } from './events/EventBus.js';
import { GameStateManager, normalizeSerializedInventory } from './gameState/GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './gameState/registryKey.js';
import { createGameConfig } from './gameConfig.js';

/**
 * Creates the root {@link Phaser.Game} instance (Benne engine entry).
 * Resolution and scale mode come from `src/game/game-config.json` via {@link createGameConfig}.
 * Registers {@link GameStateManager} on `game.registry` for cross-room state.
 */
export function createBenneGame(parent: HTMLElement | string): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  const rawInit = getGameSettings().initialGameState;
  const initial =
    rawInit != null
      ? {
          flags: rawInit.flags,
          variables: rawInit.variables,
          inventory:
            rawInit.inventory !== undefined ? normalizeSerializedInventory(rawInit.inventory) : undefined,
        }
      : undefined;
  const gameState = new GameStateManager(gameEvents, initial);
  game.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, gameState);
  return game;
}
