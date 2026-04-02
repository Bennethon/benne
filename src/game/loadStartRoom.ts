import { getGameSettings } from '../engine/ConfigManager';
import type { RoomsManifestData } from '../types/game';
import type { RoomData } from '../types/room';
import manifestJson from './rooms/rooms.manifest.json';

const roomJsonModules = import.meta.glob('./rooms/**/*.room.json', { eager: true }) as Record<
  string,
  { default: RoomData }
>;

/**
 * Resolves the start room from `game-config.json` (when `startingRoomId` is set) or `rooms.manifest.json`.
 */
export function loadStartRoomData(): RoomData {
  const manifest = manifestJson as RoomsManifestData;
  const startRoomId = getGameSettings().startingRoomId ?? manifest.startRoomId;
  const entry = manifest.rooms.find((r) => r.id === startRoomId);

  if (!entry) {
    throw new Error(`Start room '${startRoomId}' missing from rooms manifest.`);
  }

  const key = `./rooms/${entry.definition}`;
  const mod = roomJsonModules[key];

  if (!mod) {
    throw new Error(
      `Room JSON not found for manifest entry '${entry.definition}' (expected glob key '${key}'). Keys: ${Object.keys(roomJsonModules).join(', ')}`,
    );
  }

  return mod.default;
}
