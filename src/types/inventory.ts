export interface InventoryItemData {
  id: string;
  name: string;
  description: string;
  /** `false` = unique (0/1); `true` = supports quantity greater than 1. */
  stackable: boolean;
  display: {
    aseprite: boolean | 'shared';
    /** For `"shared"`: which frame tag to use (defaults to `id`). */
    tag?: string;
  };
  /** Optional tag name to play by default in UI/cursor (defaults to `display.tag` or `id`). */
  defaultAnimation?: string;
  cursor?: {
    hotspot?: { x: number; y: number };
  };
}
