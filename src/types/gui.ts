/**
 * GUI overlay definition from `src/game/guis/<id>/<id>.gui.json`.
 * Runtime composes optional `controls` in `RoomScene` (screen-space overlays); see `buildGuiOverlay` in `src/engine/gui/`.
 */
export interface GuiDisplayData {
  /**
   * When true, loads `images/guis/<guiId>/<guiId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export type GuiTextAlign = 'left' | 'center' | 'right';

export interface GuiTextControl {
  type: 'text';
  /** Prefer `line` for dialogue body; otherwise the first text control is the primary line. */
  id?: string;
  x: number;
  y: number;
  text?: string;
  /** Key in `src/game/assets/fonts/fonts.json` (bitmap font). */
  font: string;
  fontSize: number;
  color: string;
  align?: GuiTextAlign;
  /** When set, enables word wrap at this width in screen pixels. */
  wordWrapWidth?: number;
  /**
   * Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing).
   * When omitted, `defaultLetterSpacing` for this control's `font` in `src/game/assets/fonts/fonts.json` is used, else 0.
   */
  letterSpacing?: number;
}

/**
 * Inventory panel control that displays a scrollable grid of the player's inventory.
 * Populated automatically from GameStateManager inventory on gameState:inventoryChanged.
 */
export interface GuiInventoryPanelControl {
  type: 'inventoryPanel';
  /** Optional ID for Bennescript targeting, e.g. B.whenInventorySlotClick('mainInv', ...) */
  id?: string;
  x: number;
  y: number;
  /** Draw order within the GUI overlay: added to the overlay’s base depth (not an absolute scene depth). */
  zIndex?: number;
  /** Whether this control is initially visible */
  visible?: boolean;

  /** Grid layout */
  rows: number;
  cols: number;
  slotWidth: number;
  slotHeight: number;
  spacingX?: number;
  spacingY?: number;

  /** Visual tuning */
  itemScale?: number; // default 1.0
  showEmptySlots?: boolean; // show fixed grid with empty backgrounds when true
  backgroundTag?: string; // optional Aseprite tag for full panel backdrop
  slotBackgroundTag?: string; // optional per-slot background frame
  highlightTag?: string; // optional hover/selected overlay tag
}

export type GuiControl = GuiTextControl | GuiInventoryPanelControl;

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  /**
   * Whether the entire GUI overlay starts visible when the room builds it (`RoomScene`).
   * `dialog-text` stays hidden when false until dialogue shows a line; `inventory-hud` follows this flag for the HUD.
   * Individual controls can override with their own `visible` flag.
   */
  visible?: boolean;
  display: GuiDisplayData;
  controls?: GuiControl[];
}
