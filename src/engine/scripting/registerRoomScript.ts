import type { RoomScriptContext } from './types.js';

/** Global registry for new-style Bennescript room handlers (keyed per module). */
const benneRoomScriptRegistrations = new Map<string, (context: RoomScriptContext) => void>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerRoomScript called without moduleKey. Pass import.meta.url as the second argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `room:legacy:${fallbackModuleKeyCounter}`;
}

export function getBenneRoomScriptRegistrations(): ReadonlyArray<(context: RoomScriptContext) => void> {
  return [...benneRoomScriptRegistrations.values()];
}

/**
 * Call at the top level of each `*.room.ts` to register Bennescript handlers.
 *
 * @param registerFn - Receives `{ B, events, roomId, roomScene, … }`. Use **`B`** for authoring; see the
 *   **module-level table** in `BenneScript.ts` for which string ids to pass to `whenLookAt`, `walkTo`, etc.
 */
export function registerRoomScript(
  registerFn: (context: RoomScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey);
  benneRoomScriptRegistrations.set(resolvedKey, registerFn);
}
