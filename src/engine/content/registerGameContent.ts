import { registerRoomModuleLoaders } from '../scenes/roomScriptModules';
import { registerInventoryDefinitionsFromGame } from './registerInventoryDefinitions';
import { registerDialogDefinitionsFromGame } from './registerDialogDefinitions';

/** Extracts the roomId from a glob path like `./rooms/apartment/apartment.room.ts`. */
function extractRoomIdFromPath(path: string): string {
  const filename = path.split('/').pop() ?? '';
  return filename.replace(/\.room\.ts$/, '');
}

/**
 * Registers content definitions and loads the game's BenneScript modules. Script handlers register
 * themselves at each module's top level.
 *
 * **Room scripts** load lazily: `import.meta.glob` with `eager: false` records one dynamic-import
 * factory per room, and {@link import('../scenes/roomScriptModules.js').ensureRoomScriptLoaded}
 * runs the module during the asset-loading phase of the room's first transition (or boot), right
 * before its {@link import('../scenes/RoomScene.js').RoomScene} attaches the handlers.
 *
 * Character, GUI, inventory, dialog and global scripts load eagerly, here.
 */
export function registerGameContent(): void {
  registerInventoryDefinitionsFromGame();
  registerDialogDefinitionsFromGame();

  const roomModuleFactories = import.meta.glob('/src/game/rooms/**/*.room.ts', { eager: false });
  const roomLoaders = new Map<string, () => Promise<unknown>>();
  for (const [path, factory] of Object.entries(roomModuleFactories)) {
    roomLoaders.set(extractRoomIdFromPath(path), factory as () => Promise<unknown>);
  }
  registerRoomModuleLoaders(roomLoaders);

  import.meta.glob('/src/game/characters/**/*.character.ts', { eager: true });
  import.meta.glob('/src/game/guis/**/*.gui.ts', { eager: true });
  import.meta.glob('/src/game/inventory/**/*.inventory.ts', { eager: true });
  import.meta.glob('/src/game/globalScript.ts', { eager: true });
  import.meta.glob('/src/game/dialogs/**/*.dialog.ts', { eager: true });
}
