import type { RoomData } from '../types/room';

/**
 * Base class for data-driven rooms. Scenes will compose engine systems with JSON definitions.
 */
export abstract class Room {
  readonly definition: RoomData;

  constructor(definition: RoomData) {
    this.definition = definition;
  }

  abstract get id(): string;
}
