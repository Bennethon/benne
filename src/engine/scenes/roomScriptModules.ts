/**
 * Lazy loading of room script modules (`rooms/<id>/<id>.room.ts`). Boot records one dynamic-import
 * factory per room ({@link registerRoomModuleLoaders}); the room transition and boot await
 * {@link ensureRoomScriptLoaded} during asset loading, so a room's module runs once, before its
 * `RoomScene.create` attaches the handlers it registered at top level.
 */

/** Key = roomId; value = dynamic-import factory for that room's `*.room.ts` module. */
const roomModuleLoaders = new Map<string, () => Promise<unknown>>();

/**
 * The roomId whose module is being imported, set around the dynamic `import()` so top-level
 * registrations that don't name their room (`playFrom(…)`) can find it.
 */
let currentLoadingRoomId: string | null = null;

/** Stores the lazy module factory for each room. Called once from `registerGameContent`. */
export function registerRoomModuleLoaders(loaders: ReadonlyMap<string, () => Promise<unknown>>): void {
  for (const [roomId, loader] of loaders) {
    roomModuleLoaders.set(roomId, loader);
  }
}

/** The room whose `*.room.ts` module is being evaluated right now, or `null`. */
export function getLoadingRoomScriptId(): string | null {
  return currentLoadingRoomId;
}

const loadedRoomIds = new Set<string>();
const inFlightRoomLoads = new Map<string, Promise<void>>();
let roomLoadTail: Promise<void> = Promise.resolve();

/**
 * Imports the `*.room.ts` module for `roomId` once. Safe to call repeatedly. Must be awaited before
 * `RoomScene.create` attaches the room's handlers (the asset-loading phase of a transition or boot).
 */
export async function ensureRoomScriptLoaded(roomId: string): Promise<void> {
  if (loadedRoomIds.has(roomId)) return;
  const existing = inFlightRoomLoads.get(roomId);
  if (existing) return existing;
  const loader = roomModuleLoaders.get(roomId);
  if (!loader) return;

  // Registration is a synchronous side effect of an asynchronous import. Serialize imports
  // so the ambient room ID cannot be changed by another room while its module evaluates.
  const load = roomLoadTail.then(async () => {
    currentLoadingRoomId = roomId;
    try {
      await loader();
      loadedRoomIds.add(roomId);
    } finally {
      currentLoadingRoomId = null;
    }
  });
  inFlightRoomLoads.set(roomId, load);
  roomLoadTail = load.then(() => undefined, () => undefined);
  try {
    await load;
  } finally {
    inFlightRoomLoads.delete(roomId);
  }
}
