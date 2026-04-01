import type { RoomDefinition } from '../types/room';

/**
 * Base class for data-driven rooms. Scenes will compose engine systems with JSON definitions.
 */
export abstract class Room {
  readonly definition: RoomDefinition;

  constructor(definition: RoomDefinition) {
    this.definition = definition;
  }

  abstract get id(): string;
}
