import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import type { BenneScript } from './BenneScript.js';

export interface RoomScriptContext {
  /** Main facade — authors use `B` */
  readonly B: BenneScript;

  /** Raw access (advanced use only) */
  readonly events: Phaser.Events.EventEmitter;
  readonly roomId: string;
  readonly roomScene: RoomScene;

  // Convenience re-exports so you can write `onProp` directly inside the callback
  onProp: BenneScript['onProp'];
  whenLookAt: BenneScript['whenLookAt'];
  whenUse: BenneScript['whenUse'];
}