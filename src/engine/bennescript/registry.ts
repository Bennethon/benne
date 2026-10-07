/**
 * Handles by content id, so the runtime can hand authors the same objects they import (a region
 * handler's `who === hank`, `pointer.item`, `room.last`). Every handle registers itself when the
 * generated modules create it. Kept free of handle-class imports to avoid module cycles.
 */

interface Registered {
  readonly id: string;
}

const rooms = new Map<string, Registered>();
const items = new Map<string, Registered>();
const verbs = new Map<string, Registered>();
/** Characters by `<roomId>:<id>`; `:<id>` is the room-less `characters.x` handle. */
const characters = new Map<string, Registered>();

export function registerRoomHandle(handle: Registered): void {
  if (!rooms.has(handle.id)) {
    rooms.set(handle.id, handle);
  }
}

export function lookupRoomHandle<T>(id: string | null | undefined): T | null {
  return id ? ((rooms.get(id) as T | undefined) ?? null) : null;
}

export function registerItemHandle(handle: Registered): void {
  if (!items.has(handle.id)) {
    items.set(handle.id, handle);
  }
}

export function lookupItemHandle<T>(id: string | null | undefined): T | null {
  return id ? ((items.get(id) as T | undefined) ?? null) : null;
}

export function registerVerbHandle(handle: Registered): void {
  if (!verbs.has(handle.id)) {
    verbs.set(handle.id, handle);
  }
}

export function lookupVerbHandle<T>(id: string | null | undefined): T | null {
  return id ? ((verbs.get(id) as T | undefined) ?? null) : null;
}

export function registerCharacterHandle(roomId: string | null, handle: Registered): void {
  const key = `${roomId ?? ''}:${handle.id}`;
  if (!characters.has(key)) {
    characters.set(key, handle);
  }
}

/** The room's own handle for a character when the room module made one, else `characters.x`. */
export function lookupCharacterHandle<T>(roomId: string | null, id: string): T | null {
  return ((characters.get(`${roomId ?? ''}:${id}`) ?? characters.get(`:${id}`)) as T | undefined) ?? null;
}
