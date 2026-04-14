import { gameEvents } from '../engine/events/EventBus';
import { GuiBenneScript } from '../engine/scripting/GuiBenneScript';
import { getBenneCharacterScriptRegistrations } from '../engine/scripting/registerCharacterScript';
import { getBenneGuiScriptRegistrations } from '../engine/scripting/registerGuiScript';
import { getBenneRoomScriptRegistrations } from '../engine/scripting/registerRoomScript';
import type { GuiScriptContext } from '../engine/scripting/types';

const LEGACY_REGISTER_EXPORTS = [
  'registerRoomScript',
  'registerCharacterScript',
  'registerGuiScript',
  'registerGlobalScript',
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

/**
 * Eager-loads all game script modules (side-effect `register*` calls only) and wires GUI registrations.
 * Room and character scripts run from {@link import('../engine/scenes/RoomScene.js').RoomScene}; global scripts
 * run from {@link import('../engine/scripting/wireBenneGlobalScripts.js').wireBenneGlobalScripts} after the Phaser game exists.
 */
export function registerGameContent(): void {
  const roomModules = import.meta.glob('./rooms/**/*.room.ts', { eager: true });
  for (const [path, mod] of Object.entries(roomModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const characterModules = import.meta.glob('./characters/**/*.character.ts', { eager: true });
  for (const [path, mod] of Object.entries(characterModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const guiModules = import.meta.glob('./guis/**/*.gui.ts', { eager: true });
  for (const [path, mod] of Object.entries(guiModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  const globalModules = import.meta.glob('./globalScript.ts', { eager: true });
  for (const [path, mod] of Object.entries(globalModules)) {
    warnLegacyRegisterExports(path, mod as Record<string, unknown>);
  }

  (window as unknown as { __benneRoomScripts?: unknown }).__benneRoomScripts =
    getBenneRoomScriptRegistrations();
  (window as unknown as { __benneCharacterScripts?: unknown }).__benneCharacterScripts =
    getBenneCharacterScriptRegistrations();

  for (const { guiId, registerFn } of getBenneGuiScriptRegistrations()) {
    const B = new GuiBenneScript(gameEvents);
    const ctx: GuiScriptContext = { B, events: gameEvents, guiId };
    try {
      registerFn(ctx);
    } catch (err) {
      console.error(`[Benne] Error in GUI script for "${guiId}":`, err);
    }
  }
}
