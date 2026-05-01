import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager.js';
import { gameEvents } from './events/EventBus.js';
import {
  wireBenneVerbContextGameStateRelay,
  unwireBenneVerbContextGameStateRelay,
} from './scripting/benneVerbContextScriptSurface.js';
import { setActiveBenneGame } from './gameState/activeBenneGame.js';
import { GameStateManager, normalizeSerializedInventory } from './gameState/GameStateManager.js';
import { BENNE_GAME_STATE_REGISTRY_KEY } from './gameState/registryKey.js';
import { setActiveGameStateManager } from './gameState/resolveGameStateManager.js';
import { getBennePhaserGameConfigBase } from './gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { RoomScene } from './scenes/RoomScene.js';

/**
 * Full `Phaser.Types.Core.GameConfig` for the shipped runtime (scenes + shared renderer / scale
 * settings). Kept here — not in `gameConfig.ts` — so the scene imports stay out of the editor
 * preview bundles (see the `gameConfig.ts` module comment).
 */
function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    ...getBennePhaserGameConfigBase(parent),
    scene: [BootScene, RoomScene],
  };
}

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
  setActiveGameStateManager(gameState);
  wireBenneVerbContextGameStateRelay(gameEvents);
  setActiveBenneGame(game);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    unwireBenneVerbContextGameStateRelay(gameEvents);
    setActiveGameStateManager(null);
    setActiveBenneGame(null);
  });
  return game;
}
