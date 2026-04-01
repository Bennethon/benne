import type { InteractiveObjectDefinition } from '../types/room';

/**
 * Runtime handle for a hotspot / use / look target (backed by JSON definitions).
 */
export class InteractiveObject {
  readonly definition: InteractiveObjectDefinition;

  constructor(definition: InteractiveObjectDefinition) {
    this.definition = definition;
  }

  get id(): string {
    return this.definition.id;
  }
}
