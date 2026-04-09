import type { RoomScriptContext } from './types.js';

/** Global registry for new-style Bennescript room handlers */
const benneRoomScriptRegistrations: Array<(context: RoomScriptContext) => void> = [];

export function getBenneRoomScriptRegistrations(): ReadonlyArray<(context: RoomScriptContext) => void> {
  return benneRoomScriptRegistrations;
}

/**
 * Call this at the top level of your *.room.ts files to register Bennescript handlers.
 */
export function registerRoomScript(registerFn: (context: RoomScriptContext) => void): void {
  benneRoomScriptRegistrations.push(registerFn);
}