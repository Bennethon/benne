import type { RoomHotspotData } from '../types/room';

/**
 * Runtime handle for a hotspot / use / look target (backed by JSON definitions).
 */
export class InteractiveObject {
  readonly definition: RoomHotspotData;

  constructor(definition: RoomHotspotData) {
    this.definition = definition;
  }

  get id(): string {
    return this.definition.id;
  }
}
