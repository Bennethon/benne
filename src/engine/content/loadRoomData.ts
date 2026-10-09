import type { RoomsManifestData } from '../../types/game';
import type { RoomData } from '../../types/room';
import manifestJson from '../../game/rooms/rooms.manifest.json';

const roomJsonModules = import.meta.glob('/src/game/rooms/**/*.room.json', { eager: true }) as Record<
  string,
  { default: RoomData }
>;

/**
 * Resolves a room by manifest **`id`**, with optional `game-config.json` not applying here
 * (only `startingRoomId` affects {@link import('./loadStartRoom.js').loadStartRoomData}).
 */
export function loadRoomDataById(roomId: string): RoomData {
  const manifest = manifestJson as RoomsManifestData;
  const entry = manifest.rooms.find((r) => r.id === roomId);

  if (!entry) {
    throw new Error(`Room '${roomId}' is missing from rooms manifest.`);
  }

  const key = `/src/game/rooms/${entry.definition}`;
  const mod = roomJsonModules[key];

  if (!mod) {
    throw new Error(
      `Room JSON not found for manifest entry '${entry.definition}' (expected glob key '${key}'). ` +
        `Keys: ${Object.keys(roomJsonModules).join(', ')}`,
    );
  }

  // A copy per load: RoomScene writes runtime state (e.g. `regions.x.active`) into its room data,
  // and the imported JSON must stay the authored default for the next load.
  const data = structuredClone(mod.default);
  if (data.id !== roomId) {
    console.warn(
      `[Benne] loadRoomDataById: manifest id '${roomId}' but room JSON has id '${data.id}' — engine uses JSON id at runtime; fix manifest/JSON to match.`,
    );
  }
  return data;
}
