/**
 * GUI overlay definition from `src/game/guis/<id>/<id>.gui.json`.
 * Runtime composes optional `controls` in `RoomScene` (screen-space overlays); see `buildGuiOverlay` in `src/engine/gui/`.
 * Control **`id`** values (where present) are the keys used by **`GuiRuntime.getControl`** from `*.gui.ts` behaviors.
 */
export interface GuiDisplayData {
  /**
   * When true, loads `images/guis/<guiId>/<guiId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export type GuiTextAlign = 'left' | 'center' | 'right';

/** Alignment of a control within its grid cell (see {@link GuiGridPlacement}). */
export type GuiGridCellAlign =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * When set on a control, it is parented under the referenced {@link GuiGridControl} and positioned from
 * the spanned cell rectangle instead of using `x` / `y` relative to the GUI root container.
 */
export interface GuiGridPlacement {
  /** Must match a {@link GuiGridControl.id} in the same GUI. */
  gridControlId: string;
  /** 0-based row index within the grid. */
  row: number;
  /** 0-based column index within the grid. */
  col: number;
  rowspan?: number;
  colspan?: number;
  align?: GuiGridCellAlign;
}

/** How a GUI-sheet sprite is aligned to its control (or to the screen for full-frame art). */
export type GuiSpriteAnchor = 'top-left' | 'center' | 'screen';

/** Optional named animation clip on the GUI sheet (Aseprite tag / timeline). */
export interface GuiSpriteAnimationClip {
  loop?: boolean;
}

/** Map of clip name → options; same optional shape for `image` and `button` controls. */
export type GuiSpriteAnimationsMap = Record<string, GuiSpriteAnimationClip>;

export interface GuiTextControl {
  type: 'text';
  /** Prefer `line` for dialogue body; otherwise the first text control is the primary line. */
  id?: string;
  x: number;
  y: number;
  /** Draw order within the GUI overlay: added to the overlay’s base depth. */
  zIndex?: number;
  /** When set, overrides {@link GuiData.visible} for this line only. */
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
  gridPlacement?: GuiGridPlacement;
}

/**
 * Inventory panel control that displays a scrollable grid of the player's inventory.
 * Populated automatically from GameStateManager inventory on gameState:inventoryChanged.
 */
/** When set with {@link GuiInventoryPanelControl.backButton} and {@link GuiInventoryPanelControl.forwardButton}, arrow buttons scroll the panel. */
export type GuiInventoryPanelScrollDirection = 'horizontal' | 'vertical';

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

  /**
   * Scroll paging: `horizontal` advances one slot per forward click; `vertical` advances one row (`cols` slots).
   * Ignored unless both {@link GuiInventoryPanelControl.backButton} and {@link GuiInventoryPanelControl.forwardButton}
   * match existing `button` control `id`s in this GUI.
   */
  scrollDirection?: GuiInventoryPanelScrollDirection;
  /** `button` control `id` in this GUI — scrolls the view backward along {@link GuiInventoryPanelControl.scrollDirection}. */
  backButton?: string;
  /** `button` control `id` in this GUI — scrolls the view forward along {@link GuiInventoryPanelControl.scrollDirection}. */
  forwardButton?: string;

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
  /**
   * Pixel nudge for the backdrop sprite after {@link backgroundAnchor} (ignored when anchor is unused).
   * Does not affect slot layout or hit areas.
   */
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  slotBackgroundTag?: string; // optional per-slot background frame
  slotBackgroundAnchor?: GuiSpriteAnchor;
  /** Pixel nudge for each slot background sprite after {@link slotBackgroundAnchor}. */
  slotBackgroundOffsetX?: number;
  slotBackgroundOffsetY?: number;
  highlightTag?: string; // optional hover/selected overlay tag
  highlightAnchor?: GuiSpriteAnchor;
  /** Pixel nudge for the highlight overlay sprite after {@link highlightAnchor}. */
  highlightOffsetX?: number;
  highlightOffsetY?: number;
  gridPlacement?: GuiGridPlacement;
}

/**
 * Layout-only grid: a movable container whose children are controls with {@link GuiGridPlacement}
 * referencing this control’s `id`. Moving the grid (e.g. `gui.getControl(id)` as a container) moves
 * every placed control with it.
 */
export interface GuiGridControl {
  type: 'grid';
  id: string;
  x: number;
  y: number;
  /** Pixel width of the grid content box; when omitted, derived from {@link colWidths} or a default cell size. */
  width?: number;
  /** Pixel height of the grid content box; when omitted, derived from {@link rowHeights} or a default cell size. */
  height?: number;
  visible?: boolean;
  zIndex?: number;
  rows: number;
  columns: number;
  /** Length must equal {@link rows} when present; otherwise rows split the content height evenly. */
  rowHeights?: number[];
  /** Length must equal {@link columns} when present; otherwise columns split the content width evenly. */
  colWidths?: number[];
}

/**
 * Static or animated art from the GUI Aseprite sheet when the GUI root {@link GuiData.display}
 * has `aseprite: true` (same sheet as buttons / inventory panel on that GUI).
 */
export interface GuiImageControl {
  type: 'image';
  id?: string;
  x: number;
  y: number;
  zIndex?: number;
  visible?: boolean;
  /** Reserved for future clipping / 9-slice; does not affect `screen` background placement. */
  width?: number;
  height?: number;
  /** Aseprite frame tag on the GUI sheet; omit or empty to show nothing. */
  tag?: string;
  /**
   * Placement for {@link tag}; default `top-left`. Same vocabulary as
   * {@link GuiInventoryPanelControl.backgroundAnchor}.
   * When {@link gridPlacement} uses `align: "center"`, the runtime centers the sprite in the cell
   * (origin `0.5`) even if this field is omitted — set `backgroundAnchor` explicitly if you need a
   * different pivot inside the grid box.
   */
  backgroundAnchor?: GuiSpriteAnchor;
  /** Pixel nudge for the sheet sprite after {@link backgroundAnchor}. */
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  /** Optional extra clips from the GUI sheet (Aseprite tags). */
  animations?: GuiSpriteAnimationsMap;
  gridPlacement?: GuiGridPlacement;
}

/** Per-interaction sheet tags; values are Aseprite tag names on this GUI’s sheet. */
export interface GuiButtonStates {
  hover?: string;
  pressed?: string;
  disabled?: string;
}

/**
 * Text + sheet-backed hit target. Uses the GUI’s Aseprite export when `display.aseprite` is true.
 * `x` and `y` are the **top-left** of the hit box (`width` × `height`); the label is laid out inside that box.
 * {@link backgroundAnchor} only affects where the **background** sheet sprite is drawn, not where the bounds sit
 * (same idea as {@link GuiInventoryPanelControl.backgroundAnchor}).
 */
export interface GuiButtonControl {
  type: 'button';
  /** Unique within this GUI (Inspector, Bennescript `whenButtonClick`, future compositor). */
  id: string;
  x: number;
  y: number;
  zIndex?: number;
  visible?: boolean;
  /** Hit-testing width in screen pixels; also used to position the label within the hit box. */
  width: number;
  /** Hit-testing height in screen pixels; also used to position the label within the hit box. */
  height: number;
  /**
   * How the **background** sheet sprite is pinned relative to the hit box (`x`,`y`,`width`,`height`).
   * Does not move the hit box: `top-left` pins art to the box’s top-left, `center` to its center, `screen` to canvas (0,0) like full-frame HUD art.
   */
  backgroundAnchor?: GuiSpriteAnchor;
  /** Pixel nudge for the background sprite after {@link backgroundAnchor}. */
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  text: string;
  /** Key in `src/game/assets/fonts/fonts.json` (bitmap font). */
  font: string;
  fontSize: number;
  textColor: string;
  textAlign?: GuiTextAlign;
  /**
   * When &gt; 0, wraps label text via `BitmapText.setMaxWidth` (inner width in pixels).
   * Hit box (`width` × `height`) is unchanged unless the runtime resizes height (e.g. dialog options).
   */
  wordWrapWidth?: number;
  /** Fine-tune label position in pixels (default 0). */
  textOffsetX?: number;
  textOffsetY?: number;
  /** Default visual tag on the GUI sheet. */
  backgroundTag: string;
  /** Hover / pressed / disabled sheet tags. */
  states?: GuiButtonStates;
  animations?: GuiSpriteAnimationsMap;
  /**
   * When false, the button ignores input; default true when omitted.
   * (Runtime compositor will map this to visuals + hit testing.)
   */
  enabled?: boolean;
  gridPlacement?: GuiGridPlacement;
}

/**
 * Invisible, rectangular hit zone with a stable **`id`**: pure behavior surface for
 * **`B.whenMouseEnter` / `B.whenMouseLeave`** in `*.gui.ts`. Never drawn (no art, no text).
 * Layout-only properties; no **`zIndex`** — triggers sit above all other controls in this GUI’s overlay
 * so they reliably catch pointer events even over inventory icons and button art.
 */
export interface GuiTriggerControl {
  type: 'trigger';
  /** Required — used by **`B.whenMouseEnter('id', …)`** and Inspector tree. */
  id: string;
  /** Optional human label for the Inspector / editor tree. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * When **`false`**, the trigger is inert (no pointer events emit, no cursor change).
   * Default (omitted / `true`) is active.
   */
  active?: boolean;
  /** Hide the trigger at load without deleting it. Pointer events are suppressed while hidden. */
  visible?: boolean;
  gridPlacement?: GuiGridPlacement;
}

export type GuiControl =
  | GuiTextControl
  | GuiInventoryPanelControl
  | GuiImageControl
  | GuiButtonControl
  | GuiTriggerControl
  | GuiGridControl;

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  /**
   * Initial screen-space **x** offset of the packed **`gui.root`** container at build time.
   * Controls parented under the root (every control **not** in **`fixedControls`**) are rendered at this
   * offset plus their authored control **`x`**. Fixed controls are unaffected. Omitted = 0.
   * Runtime tweens via **`gui.root.tweenTo({ x: … })`** still work; this is just the initial value.
   */
  x?: number;
  /**
   * Initial screen-space **y** offset of the packed **`gui.root`** container at build time.
   * Typically used to park a HUD offscreen (e.g. **`y: -34`** for a dropdown bar) so a **`tweenTo({ y: 0 })`**
   * in **`onGuiBuilt`** reveals it. See **`x`** for layering semantics; fixed controls are unaffected.
   */
  y?: number;
  /**
   * Control **`id`** values (from **`controls[]`**) that stay **outside** the packed **`gui.root`**
   * container at runtime, so **`gui.root.tweenTo`** / whole-overlay moves do not affect them.
   * Omitted ids and unknown strings are ignored. Controls without an **`id`** cannot be listed here.
   */
  fixedControls?: string[];
  /**
   * When **`false`**, the overlay starts hidden at room load; when **`true`**, it starts visible.
   * (`RoomScene` builds every GUI under `src/game/guis/` except the engine-driven Speaking Text
   * **`speaking-text`** overlay, shown via `setDialogTextOverlay` regardless of this flag at boot.)
   * Per-control `visible` can still override for individual controls.
   */
  visible: boolean;
  display: GuiDisplayData;
  controls?: GuiControl[];
}
