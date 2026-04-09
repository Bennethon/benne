import type { RoomScene } from '../scenes/RoomScene.js';
import type { BenneScript } from './BenneScript.js';

export interface RoomScriptContext {
  /**
   * Main authoring facade (`whenLookAt`, `B.player.walkTo`, …).
   * String ids for props, characters, and `walkTo` targets are documented in the **module comment** at the top of `BenneScript.ts`.
   */
  readonly B: BenneScript;

  /** Raw access (advanced use only) */
  readonly events: Phaser.Events.EventEmitter;
  readonly roomId: string;
  readonly roomScene: RoomScene;

  // Convenience re-exports so you can write `onProp` directly inside the callback
  onProp: BenneScript['onProp'];
  whenLookAt: BenneScript['whenLookAt'];
  whenUse: BenneScript['whenUse'];
  whenPickUp: BenneScript['whenPickUp'];
  whenGive: BenneScript['whenGive'];
  whenPush: BenneScript['whenPush'];
  whenPull: BenneScript['whenPull'];
  whenOpen: BenneScript['whenOpen'];
  whenClose: BenneScript['whenClose'];
  whenVerb: BenneScript['whenVerb'];
  whenTalkTo: BenneScript['whenTalkTo'];
}