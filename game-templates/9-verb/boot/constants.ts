import { getGameSettings } from '../../engine/ConfigManager';

export const SCENE_BOOT = 'Boot';
export const SCENE_ROOM = 'Room';

/** Internal canvas width from `src/game/game-config.json`. */
export function getInternalWidth(): number {
  return getGameSettings().resolution.width;
}

/** Internal canvas height from `src/game/game-config.json`. */
export function getInternalHeight(): number {
  return getGameSettings().resolution.height;
}

/** Default player character folder name under `src/game/characters/`. */
export function getStartingPlayerCharacterId(): string {
  return getGameSettings().startingPlayerCharacter;
}
