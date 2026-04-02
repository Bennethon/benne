import type { EventBus } from '../engine/events/EventBus';
import { gameEvents } from '../engine/events/EventBus';
import { registerGlobalScript } from './globalScript';

const roomScriptModules = import.meta.glob<{ registerRoomScript?: (events: EventBus) => void }>(
  './rooms/**/*.room.ts',
  { eager: true },
);

/**
 * Registers globalScript, then every `*.room.ts` under `rooms/` that exports registerRoomScript.
 */
export function registerGameContent(): void {
  registerGlobalScript(gameEvents);

  for (const mod of Object.values(roomScriptModules)) {
    mod.registerRoomScript?.(gameEvents);
  }
}
