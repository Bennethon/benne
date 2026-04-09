import type { RoomScriptContext } from './types.js';

/** Global registry for new-style Bennescript room handlers */
const benneRoomScriptRegistrations: Array<(context: RoomScriptContext) => void> = [];

export function getBenneRoomScriptRegistrations(): ReadonlyArray<(context: RoomScriptContext) => void> {
  return benneRoomScriptRegistrations;
}

/**
 * Call at the top level of each `*.room.ts` to register Bennescript handlers.
 *
 * @param registerFn - Receives `{ B, events, roomId, roomScene, … }`. Use **`B`** for authoring; see the
 *   **module-level table** in `BenneScript.ts` for which string ids to pass to `whenLookAt`, `walkTo`, etc.
 */
export function registerRoomScript(registerFn: (context: RoomScriptContext) => void): void {
  benneRoomScriptRegistrations.push(registerFn);
}