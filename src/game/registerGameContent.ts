import type { EventBus } from '../engine/events/EventBus';
import { gameEvents } from '../engine/events/EventBus';
import { registerGlobalScript } from './globalScript';
import { getBenneRoomScriptRegistrations } from '../engine/scripting/registerRoomScript';

/**
 * BENNE scripting registration.
 * Supports both old-style (exported registerRoomScript) and new Bennescript style.
 */
export function registerGameContent(): void {
  registerGlobalScript(gameEvents);

  // === NEW BENNE SCRIPT STYLE ===
  const benneRoomScripts = getBenneRoomScriptRegistrations();
  if (benneRoomScripts.length > 0) {
    console.log(`[Benne] ✅ Collected ${benneRoomScripts.length} new-style Bennescript room handler(s)`);
  }
  (window as any).__benneRoomScripts = benneRoomScripts;

  // === OLD STYLE FALLBACK (for other rooms) ===
  const roomScriptModules = import.meta.glob<{
    registerRoomScript?: (events: EventBus) => void;
  }>('./rooms/**/*.room.ts', { eager: true });

  for (const [path, mod] of Object.entries(roomScriptModules)) {
    const fn = mod.registerRoomScript;
    if (!fn) continue;

    // Skip if this room already used the new style
    if (benneRoomScripts.length > 0 && path.includes('office')) {
      continue;
    }

    console.warn(`[Benne] Old-style script found: ${path} — falling back to raw events`);
    fn(gameEvents);
  }

  // Character scripts (unchanged)
  const characterScriptModules = import.meta.glob<{
    registerCharacterScript?: (events: EventBus) => void;
  }>('./characters/**/*.character.ts', { eager: true });

  for (const mod of Object.values(characterScriptModules)) {
    mod.registerCharacterScript?.(gameEvents);
  }

  const guiScriptModules = import.meta.glob<{
    registerGuiScript?: (events: EventBus) => void;
  }>('./guis/**/*.gui.ts', { eager: true });

  for (const mod of Object.values(guiScriptModules)) {
    mod.registerGuiScript?.(gameEvents);
  }
}