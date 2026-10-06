export type { InventoryItemId } from './generated/benne-game-ids.js';

export interface InventoryItemData {
  id: string;
  /** BenneScript handle name, when the generated one doesn't fit (docs/bennescript-ergonomics-refactor.md §7.2). */
  scriptName?: string;
  name: string;
  description: string;
  /** Supported interaction verbs for this item (`game-config.json` ids). */
  onVerb?: Record<string, boolean>;
  /**
   * Verb id invoked when an `inputProfile` slot resolves to `"defaultVerb"` on this inventory
   * item. Falls back to `"look"` when omitted.
   */
  defaultVerb?: string;
  /** `false` = unique (0/1); `true` = supports quantity greater than 1. */
  stackable: boolean;
  /**
   * Per-item override for `game-config.json` `dropWhenInventoryUsed`. When set, controls whether
   * the active inventory selection is dropped (active inventory + active verb cleared) after the
   * player uses **this** item on a clickable target. When omitted, the global policy applies
   * (`dropWhenInventoryUsed`, default `false`).
   */
  dropWhenUsed?: boolean;
  /** Optional per-tag animation overrides for inventory sheets. */
  animations?: Record<
    string,
    {
      loop?: boolean;
      frameDuration?: number;
    }
  >;
  display: {
    aseprite: boolean | 'shared';
  };
  /**
   * Optional Aseprite frame tag for the default clip in UI/cursor (Phaser key is namespaced on the shared sheet).
   * Defaults to `id` when omitted.
   */
  defaultAnimation?: string;
  /**
   * When this item is the active inventory selection, optional frame tag on **this item’s** inventory sheet to play
   * on the custom game cursor over clickables (see `RoomScene` + `game-config.json` `cursor`). Omitted = keep normal active-verb cursor behavior.
   */
  cursorAnimation?: string;
  cursor?: {
    hotspot?: { x: number; y: number };
  };
}
