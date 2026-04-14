import * as Phaser from 'phaser';
import { BenneScriptCore } from './BenneScriptCore.js';

/**
 * Bennescript facade for `*.gui.ts`. Today this is mostly `raw` + `wait`; future GUI lifecycle and control
 * events should extend this class without changing the registration shape.
 */
export class GuiBenneScript extends BenneScriptCore {
  constructor(events: Phaser.Events.EventEmitter) {
    super(events, () => null);
  }
}
