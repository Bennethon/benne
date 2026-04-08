import type { EventBus } from '../engine/events/EventBus';
import { gameEvents } from '../engine/events/EventBus';
import { registerGlobalScript } from './globalScript';

const roomScriptModules = import.meta.glob<{ registerRoomScript?: (events: EventBus) => void }>(
  './rooms/**/*.room.ts',
  { eager: true },
);

const characterScriptModules = import.meta.glob<{
  registerCharacterScript?: (events: EventBus) => void;
}>(
  './characters/**/*.character.ts',
  { eager: true },
);

/**
 * Registers globalScript, every `*.room.ts` that exports registerRoomScript, then every
 * `*.character.ts` under `characters/` that exports registerCharacterScript.
 */
export function registerGameContent(): void {
  registerGlobalScript(gameEvents);

  for (const mod of Object.values(roomScriptModules)) {
    mod.registerRoomScript?.(gameEvents);
  }

  for (const mod of Object.values(characterScriptModules)) {
    mod.registerCharacterScript?.(gameEvents);
  }
}
