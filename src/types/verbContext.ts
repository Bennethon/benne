import type { GameVerbDefinition } from './game.js';
import type { InventoryItemData } from './inventory.js';

/** One configured verb from `game-config.json` (`verbs[]`). */
export type VerbDefinition = GameVerbDefinition;

/** Full inventory row definition (same shape as registry entries). */
export type InventoryItemDefinition = InventoryItemData;

/** Entity kind under the pointer used for HUD / custom verb line text. */
export type VerbHoverTargetType = 'prop' | 'hotspot' | 'character' | 'inventoryRow';

/**
 * Scripted hover snapshot (LucasArts-style target label). Omitted wholly when nothing is hovered
 * or while scripted-dialog input hides room targets (`RoomScene`).
 */
export interface VerbHoverTarget {
  description: string | null;
  targetType: VerbHoverTargetType | null;
  /** Room prop id, hotspot id, or character definition id (`CharacterData.id`). */
  targetId?: string;
  /** Set when {@link targetType} is `inventoryRow`. */
  itemId?: string;
  /**
   * Non-empty authored `defaultVerb` from prop / hotspot / character / inventory JSON — the same field
   * `resolvePointerVerbForTarget` reads (`src/engine/verbs/resolvePointerVerb.ts`).
   */
  defaultVerb?: string;
}
