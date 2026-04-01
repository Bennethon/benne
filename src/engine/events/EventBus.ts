import * as Phaser from 'phaser';

/**
 * Global event bus for gameplay, puzzles, and UI (decoupled from Phaser scenes).
 */
export class EventBus extends Phaser.Events.EventEmitter {
  constructor() {
    super();
  }
}

export const gameEvents = new EventBus();
