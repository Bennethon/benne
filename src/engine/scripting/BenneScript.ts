import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { roomPropVerbEventId } from '../events/verbInteractionEvents.js';   // ← This is the correct file

export class BenneScript {
  private events: Phaser.Events.EventEmitter;
  private roomId: string;
  private roomScene: RoomScene;

  constructor(
    events: Phaser.Events.EventEmitter,
    roomId: string,
    roomScene: RoomScene
  ) {
    this.events = events;
    this.roomId = roomId;
    this.roomScene = roomScene;
  }

  // ─────────────────────────────────────────────────────────────
  // Prop verb handlers — the clean API you liked
  // ─────────────────────────────────────────────────────────────
  onProp(
    propId: string,
    verbId: string,
    handler: (payload: RoomPropInteractPayload) => void | Promise<void>
  ): void {
    const eventId = roomPropVerbEventId(this.roomId, propId, verbId);
    this.events.on(eventId, async (payload: RoomPropInteractPayload) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`Error in ${eventId} handler:`, err);
      }
    });
  }

  /** Sugar: B.whenLookAt('desk', async () => { ... }) */
  whenLookAt(propId: string, handler: () => void | Promise<void>): void {
    this.onProp(propId, 'look', () => handler());
  }

  /** Sugar: B.whenUse('door', async () => { ... }) */
  whenUse(propId: string, handler: () => void | Promise<void>): void {
    this.onProp(propId, 'use', () => handler());
  }

  // ─────────────────────────────────────────────────────────────
  // Player actions (placeholders — we'll make these awaitable soon)
  // ─────────────────────────────────────────────────────────────
  async walkToProp(propId: string): Promise<void> {
    console.log(`[Bennescript] Player walking to prop: ${propId}`);
    // TODO: integrate with RoomScene player movement + walkable clamping + feet
  }

  async face(targetId: string): Promise<void> {
    console.log(`[Bennescript] Player facing: ${targetId}`);
  }

  say(line: string): void {
    console.log(`[Player] ${line}`);
    // TODO: proper dialogue queue (will be awaitable later)
  }

  get player() {
    return {
      walkToProp: this.walkToProp.bind(this),
      face: this.face.bind(this),
      say: this.say.bind(this),
    };
  }
}