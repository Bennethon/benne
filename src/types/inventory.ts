export interface InventoryItemData {
  id: string;
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
  cursor?: {
    hotspot?: { x: number; y: number };
  };
}
