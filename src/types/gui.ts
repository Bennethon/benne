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

/** How a GUI-sheet sprite is aligned to its control (or to the screen for full-frame art). */
export type GuiSpriteAnchor = 'top-left' | 'center' | 'screen';

/** Associates an Aseprite frame tag on the GUI sheet with placement; omit or empty `tag` to show nothing. */
export interface GuiSpriteDisplay {
  tag?: string;
  anchor?: GuiSpriteAnchor;
}

export interface GuiTextControl {
  type: 'text';
  /** Prefer `line` for dialogue body; otherwise the first text control is the primary line. */
  id?: string;
  x: number;
  y: number;
  /** Draw order within the GUI overlay: added to the overlay’s base depth. */
  zIndex?: number;
  /** When set, overrides {@link GuiData.visible} / overlay start visibility for this line only. */
  visible?: boolean;
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
  /** Placement for {@link backgroundTag}; default `top-left`. */
  backgroundAnchor?: GuiSpriteAnchor;
  slotBackgroundTag?: string; // optional per-slot background frame
  slotBackgroundAnchor?: GuiSpriteAnchor;
  highlightTag?: string; // optional hover/selected overlay tag
  highlightAnchor?: GuiSpriteAnchor;
}

/** Static or animated art from the GUI Aseprite sheet (`display.aseprite`). */
export interface GuiImageControl {
  type: 'image';
  id?: string;
  x: number;
  y: number;
  zIndex?: number;
  visible?: boolean;
  /** Reserved for future clipping / 9-slice; does not affect `screen` anchor placement. */
  width?: number;
  height?: number;
  display: GuiSpriteDisplay;
}

export type GuiControl = GuiTextControl | GuiInventoryPanelControl | GuiImageControl;

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  /**
   * When **`false`**, the overlay starts hidden at room load. When omitted or **`true`**, it starts visible
   * (`RoomScene` builds every GUI under `src/game/guis/` except the engine-driven **`dialog-text`** overlay).
   * Per-control `visible` on `inventoryPanel` (and future controls) can still override.
   */
  visible?: boolean;
  display: GuiDisplayData;
  controls?: GuiControl[];
}
