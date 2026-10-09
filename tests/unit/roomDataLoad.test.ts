import { describe, expect, it } from 'vitest';
import { loadRoomDataById } from '../../src/engine/content/loadRoomData';
import { loadStartRoomData } from '../../src/engine/content/loadStartRoom';

describe('room data loading', () => {
  it('gives each load its own copy, so runtime writes never become the authored default', () => {
    const start = loadStartRoomData();
    const authored = structuredClone(start);
    for (const room of [start, loadRoomDataById(start.id)]) {
      room.walkable.polygons.forEach((p) => (p.active = !p.active));
      room.regions?.forEach((r) => (r.active = !r.active));
      room.id = 'changed';
    }
    expect(loadStartRoomData()).toEqual(authored);
    expect(loadRoomDataById(authored.id)).toEqual(authored);
  });
});
