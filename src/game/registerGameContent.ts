import { gameEvents } from '../engine/events/EventBus';
import { GuiBenneScript } from '../engine/scripting/GuiBenneScript';
import { getBenneCharacterScriptRegistrations } from '../engine/scripting/registerCharacterScript';
import {
  getBenneGuiScriptRegistrations,
  registerGuiBenneScriptInstance,
} from '../engine/scripting/registerGuiScript';
import { getBenneInventoryScriptRegistrations } from '../engine/scripting/registerInventoryScript';
import {
  registerRoomScriptModuleLoaders,
} from '../engine/scripting/registerRoomScript';
import type { GuiScriptContext } from '../engine/scripting/types';
import { registerInventoryDefinitionsFromGame } from './registerInventoryDefinitions';
import { registerDialogDefinitionsFromGame } from './registerDialogDefinitions';

const LEGACY_REGISTER_EXPORTS = [
  'registerRoomScript',
  'registerCharacterScript',
  'registerGuiScript',
  'registerGlobalScript',
  'registerInventoryScript',
  'registerDialogScript',
] as const;

function warnLegacyRegisterExports(path: string, mod: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  for (const key of LEGACY_REGISTER_EXPORTS) {
    if (typeof mod[key] === 'function') {
      console.error(
        `[Benne] ${path} exports legacy "${String(key)}". Use side-effect registration from @engine/scripting instead.`,
      );
    }
  }
}

/** Extracts the roomId from a glob path like `./rooms/apartment/apartment.room.ts`. */
function extractRoomIdFromPath(path: string): string {
  const filename = path.split('/').pop() ?? '';
  return filename.replace(/\.room\.ts$/, '');
}

/**
 * Eager-loads all game script modules (side-effect `register*` calls only) and wires GUI registrations.
 *
 * **Room scripts** are registered lazily: `import.meta.glob` with `eager: false` records one dynamic-
 * import factory per room. The actual module (and its `registerRoomScript` side-effect) is loaded on
 * demand by {@link import('../engine/scripting/registerRoomScript.js').ensureRoomScriptLoaded} during
 * the asset-loading phase of each room transition or boot, so only the active room's handlers are
 * registered when that room's {@link import('../engine/scenes/RoomScene.js').RoomScene} runs `create`.
 *
 * Character and inventory scripts run from {@link import('../engine/scenes/RoomScene.js').RoomScene};
 * global scripts run from {@link import('../engine/scripting/wireBenneGlobalScripts.js').wireBenneGlobalScripts}
 * after the Phaser game exists.
 */
export function registerGameContent(): void {
  registerInventoryDefinitionsFromGame();
  registerDialogDefinitionsFromGame();

  // ── Room scripts: discovery only (lazy execution per room) ──────────────────
  // The factories are stored in registerRoomScript.ts; ensureRoomScriptLoaded() is called during
  // the transition / boot asset-loading phase so the module runs exactly once per session per room,
  // immediately before that room's RoomScene.create wires its handlers.
  const roomModuleFactories = import.meta.glob('./rooms/**/*.room.ts', { eager: false });
  const roomLoaders = new Map<string, () => Promise<unknown>>();
  for (const [path, factory] of Object.entries(roomModuleFactories)) {
    const roomId = extractRoomIdFromPath(path);
    roomLoaders.set(roomId, factory as () => Promise<unknown>);
  }
  registerRoomScriptModuleLoaders(roomLoaders);

  const characterModules = import.meta.glob('./characters/**/*.character.ts', { eager: true });
  for (const [path, mod] of Object.entries(characterModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const guiModules = import.meta.glob('./guis/**/*.gui.ts', { eager: true });
  for (const [path, mod] of Object.entries(guiModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const inventoryModules = import.meta.glob('./inventory/**/*.inventory.ts', { eager: true });
  for (const [path, mod] of Object.entries(inventoryModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const globalModules = import.meta.glob('./globalScript.ts', { eager: true });
  for (const [path, mod] of Object.entries(globalModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const dialogModules = import.meta.glob('./dialogs/**/*.dialog.ts', { eager: true });
  for (const [path, mod] of Object.entries(dialogModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  (window as unknown as { __benneCharacterScripts?: unknown }).__benneCharacterScripts =
    getBenneCharacterScriptRegistrations();
  (window as unknown as { __benneInventoryScripts?: unknown }).__benneInventoryScripts =
    getBenneInventoryScriptRegistrations();

  for (const { guiId, registerFn } of getBenneGuiScriptRegistrations()) {
    const B = new GuiBenneScript(gameEvents, guiId);
    registerGuiBenneScriptInstance(guiId, B);
    const ctx: GuiScriptContext = { B, events: gameEvents, guiId };
    try {
      registerFn(ctx);
    } catch (err) {
      console.error(`[Benne] Error in GUI script for "${guiId}":`, err);
    }
  }
}
