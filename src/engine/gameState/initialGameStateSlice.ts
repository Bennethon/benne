import { getStartingPlayerCharacterId } from '../../game/boot/constants.js';
import { getGameSettings } from '../ConfigManager.js';
import {
  buildInitialInventoryByCharacter,
  normalizeSerializedInventory,
} from './characterInventory.js';
import type { GameStateInitialSlice } from './GameStateManager.js';

/**
 * The slice {@link import('../Game.js').createBenneGame} passes into {@link GameStateManager}
 * at boot. `B.state.reset()` uses the same helper so a new game cannot drift from startup.
 * Returns `undefined` when `game-config.json` has no `initialGameState` (constructor defaults).
 */
export function buildBootGameStateSlice(): GameStateInitialSlice | undefined {
  const rawInit = getGameSettings().initialGameState;
  if (rawInit == null) {
    return undefined;
  }
  const startingPlayer = getStartingPlayerCharacterId();
  return {
    flags: rawInit.flags,
    variables: rawInit.variables,
    inventoryByCharacter: buildInitialInventoryByCharacter({
      inventoryByCharacter: rawInit.inventoryByCharacter,
      legacyInventory:
        rawInit.inventory !== undefined ? normalizeSerializedInventory(rawInit.inventory) : undefined,
      startingPlayerCharacterId: startingPlayer,
    }),
    activePlayerCharacterId: rawInit.activePlayerCharacterId ?? startingPlayer,
  };
}
