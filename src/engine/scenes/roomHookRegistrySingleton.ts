import type { RoomTransitionHookRegistry } from './RoomTransitionHookRegistry.js';

let registry: RoomTransitionHookRegistry | null = null;

export function setGlobalRoomHookRegistry(r: RoomTransitionHookRegistry | null): void {
  registry = r;
}

export function getGlobalRoomHookRegistry(): RoomTransitionHookRegistry {
  if (!registry) {
    throw new Error('[Benne] Room hook registry not initialised (wireBenneGlobalScripts not run).');
  }
  return registry;
}

export function tryGetGlobalRoomHookRegistry(): RoomTransitionHookRegistry | null {
  return registry;
}
