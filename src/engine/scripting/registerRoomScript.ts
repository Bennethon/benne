import type { RoomScriptContext } from './types.js';

type RoomCallback = (context: RoomScriptContext) => void;

/**
 * Per-room callback registry. Populated lazily when a room's module is first imported.
 * Key = roomId; value = callbacks registered by that room's `registerRoomScript` call(s).
 * Callbacks are stored permanently after first import and re-invoked on every room enter
 * (each call receives a fresh {@link RoomScriptContext} from {@link import('../scenes/RoomScene.js').RoomScene}).
 */
const perRoomCallbacks = new Map<string, RoomCallback[]>();

/**
 * Lazy module factories registered by {@link registerRoomScriptModuleLoaders}.
 * Key = roomId; value = dynamic-import factory for that room's `*.room.ts` module.
 */
const roomModuleLoaders = new Map<string, () => Promise<unknown>>();

/**
 * The roomId whose module is currently being imported.
 * Set by {@link ensureRoomScriptLoaded} around the dynamic `import()` call so
 * {@link registerRoomScript} can key each callback to the correct room.
 */
let _currentLoadingRoomId: string | null = null;

// ─── Registration helpers (called from registerGameContent) ──────────────────

/**
 * Stores the lazy module factory for each room. Called once from
 * {@link import('../../game/registerGameContent.js').registerGameContent} with the full
 * roomId → factory map derived from `import.meta.glob`.
 */
export function registerRoomScriptModuleLoaders(
  loaders: ReadonlyMap<string, () => Promise<unknown>>,
): void {
  for (const [roomId, loader] of loaders) {
    roomModuleLoaders.set(roomId, loader);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call at the top level of each `*.room.ts` to register Bennescript handlers.
 *
 * @param registerFn - Receives `{ B, events, roomId, roomScene, … }`. Use **`B`** for authoring;
 *   see the **module-level table** in `BenneScript.ts` for which string ids to pass to
 *   `whenLookAt`, `walkTo`, etc.
 */
export function registerRoomScript(registerFn: RoomCallback): void {
  const rid = _currentLoadingRoomId;
  if (rid == null) {
    if (import.meta.env.DEV) {
      console.error(
        '[Benne] registerRoomScript called outside a lazy room module load context — registration ignored. ' +
          'Ensure this file is under src/game/rooms/**/*.room.ts and is discovered by registerGameContent.',
      );
    }
    return;
  }
  let arr = perRoomCallbacks.get(rid);
  if (!arr) {
    arr = [];
    perRoomCallbacks.set(rid, arr);
  }
  arr.push(registerFn);
}

/**
 * Returns the registered callbacks for a room.
 * Will be empty until {@link ensureRoomScriptLoaded} has been awaited for that room.
 */
export function getCallbacksForRoom(roomId: string): ReadonlyArray<RoomCallback> {
  return perRoomCallbacks.get(roomId) ?? [];
}

/**
 * Ensures the `*.room.ts` module for `roomId` has been imported (once) and its
 * {@link registerRoomScript} side-effect has run.  Safe to call multiple times —
 * subsequent calls for an already-loaded room return immediately without re-importing.
 *
 * Must be awaited **before** `RoomScene.create` needs the callbacks (i.e. during the
 * asset-loading phase of a transition or boot).
 */
export async function ensureRoomScriptLoaded(roomId: string): Promise<void> {
  if (perRoomCallbacks.has(roomId)) {
    return;
  }
  const loader = roomModuleLoaders.get(roomId);
  if (!loader) {
    return;
  }
  _currentLoadingRoomId = roomId;
  try {
    await loader();
  } finally {
    _currentLoadingRoomId = null;
  }
}

