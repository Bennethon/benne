import * as Phaser from 'phaser';
import {
  guiAllButtonsClickEventId,
  guiButtonClickEventId,
  type GuiAllButtonsClickPayload,
} from '../events/guiButtonEvents.js';
import { BenneScriptCore } from './BenneScriptCore.js';

/**
 * Bennescript facade for `*.gui.ts`: GUI-scoped channels (e.g. button clicks), `raw`, and `wait`.
 * Handlers run through the same interaction queue as room / character scripts.
 */
export class GuiBenneScript extends BenneScriptCore {
  private readonly guiId: string;

  constructor(events: Phaser.Events.EventEmitter, guiId: string) {
    super(events, () => null);
    this.guiId = guiId;
  }

  /**
   * When the player activates a specific `button` control (by `id` in `*.gui.json`), run `handler`.
   * Mirrors verb sugar (`whenLookAt`, …): one string id, scoped to this GUI file’s `registerGuiScript` id.
   */
  whenButtonClick(buttonId: string, handler: () => void): void {
    this.subscribe(guiButtonClickEventId(this.guiId, buttonId), () => {
      handler();
    });
  }

  /**
   * Runs when any `button` control in this GUI is activated; receives the control `id`.
   * Prefer {@link whenButtonClick} for normal wiring; use this for logging, shared fallbacks, etc.
   */
  whenAnyButtonClick(handler: (buttonId: string) => void): void {
    this.subscribe(guiAllButtonsClickEventId(this.guiId), (payload) => {
      const p = payload as GuiAllButtonsClickPayload | undefined;
      if (p && typeof p.buttonId === 'string') {
        handler(p.buttonId);
      }
    });
  }
}
