/**
 * Composes GUI `BitmapText` overlays. Renderer settings (`pixelArt`, `roundPixels`, WebGL) come from
 * `getBenneRendererConfigFields` / `getBennePhaserGameConfigBase` — keep in sync with every preview surface.
 */
import * as Phaser from 'phaser';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { getInternalWidth } from '../../game/constants';
import { isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';
import { guiPhaserAnimationKey } from '../../game/asepritePhaserAnimationKeys';
import { getGameSettings } from '../ConfigManager';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/guiAseprite';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import type { GameBitmapFontDefinition, GameFontsManifest } from '../../types/fonts';
import { gameEvents } from '../events/EventBus';
import { guiAllButtonsClickEventId, guiButtonClickEventId, type GuiAllButtonsClickPayload } from '../events/guiButtonEvents';
import {
  guiControlMouseEnterEventId,
  guiControlMouseLeaveEventId,
} from '../events/guiControlHoverEvents';
import type {
  BenneGuiScriptButtonVisualState,
  GuiButtonControl,
  GuiControl,
  GuiData,
  GuiGridControl,
  GuiGridPlacement,
  GuiImageControl,
  GuiInventoryPanelControl,
  GuiNineSliceImageControl,
  GuiSpriteAnchor,
  GuiTextAlign,
  GuiTextControl,
  GuiTextOutline,
  GuiTriggerControl,
} from '../../types/gui';
import {
  addGuiNineSliceImage,
  estimateNineSliceSizeForGridAlign,
  tryResizeGuiNineSlicePanel,
} from './guiNineSliceImage.js';
import {
  applyGuiBitmapTextFillTint,
  attachGuiBitmapTextOutlineList,
  BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY,
  BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY,
  BENNE_GUI_OUTLINE_DX_KEY,
  BENNE_GUI_OUTLINE_DY_KEY,
  BENNE_GUI_OUTLINE_FILL_ALPHA_KEY,
  BENNE_GUI_OUTLINE_FILL_TINT_KEY,
  guiTextOutlineMaxAbsOffsetForBounds,
  resolveEffectiveGuiTextOutline,
  syncOutlinedGuiBitmapTextAll,
  syncOutlinedGuiBitmapTextPositions,
} from './guiTextOutline';
import {
  alignBoxTopLeftInCell,
  cumulativeOffsets,
  isGuiGridPlacement,
  layoutGuiGridTracks,
  parseGuiGridCellAlign,
  spanCellRect,
} from './guiGridLayout';
import type { InventoryItemData } from '../../types/inventory';
import {
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
  type GameStateVariableChangedPayload,
} from '../../types/gameState.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import {
  isPersistedInventoryAnimationVariableKey,
  readEffectiveInventoryDefaultAnimationTag,
} from '../inventory/inventoryScriptingAnimations.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY,
  benneGuiButtonReadVisualScriptLock,
} from './guiButtonVisualStateScript.js';
import {
  dispatchInventoryOnInventoryItemInteraction,
  dispatchInventoryVerbInteraction,
  shouldDispatchInventoryUsedOnVerbForGame,
  shouldDropActiveInventoryOnUse,
  trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch,
} from '../verbs/dispatchInventoryVerb';
import { getEffectiveInputProfile } from '../verbs/verbConfig';
import { resolvePointerVerbForInventoryItem } from '../verbs/resolvePointerVerb';
import {
  getAsepriteSpriteSourceInset,
  getAsepriteVisibleFrameSize,
  resolveAuthoredPositionForAsepriteTrim,
  warnDevIfAsepriteJsonMissingSpriteSourceSize,
  wireBenneGuiAsepriteTrimmedPlacementAfterFrameChanges,
} from '../aseprite/asepriteFramePlacement';
import { ensureAsepriteAtlasAnimationsRegisteredOnce } from '../aseprite/ensureAsepriteAtlasAnimationsOnce.js';

/** Slot stroke for `game-config.json` `debug.showGuiOutlines` (distinct from walkable / prop debug colors). */
const DEBUG_GUI_INVENTORY_SLOT_STROKE = 0x66ccff;
/** Cell stroke for `grid` controls when `debug.showGuiOutlines` is true. */
const DEBUG_GUI_GRID_CELL_STROKE = 0xffcc66;

const manifest = gameFontsManifest as GameFontsManifest;

/** Renders above the room stack (`RoomScene` assigns sequential depths from `ROOM_STACK_DEPTH_BASE`). */
export const GUI_TEXT_OVERLAY_DEPTH = 25_000;

/**
 * Base depth increment between stacked GUI overlays in the room (must match `RoomScene` stack math).
 * One stride must fit every authored `zIndex` / panel depth within a single overlay.
 */
export const GUI_OVERLAY_DEPTH_STRIDE = 10_000;

/**
 * Minimum gap between Speaking Text (primary line + outline clones) and the internal canvas edges when using
 * {@link GuiOverlayHandle.setPrimaryScreenPositionBottomCenter}.
 */
const PRIMARY_LINE_SCREEN_EDGE_INSET = 2;

function unionOutlinedBitmapTextScreenBounds(main: Phaser.GameObjects.BitmapText): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  const expand = (r: Phaser.Geom.Rectangle): void => {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  };
  expand(main.getBounds());
  const outs = main.getData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY) as Phaser.GameObjects.BitmapText[] | undefined;
  if (Array.isArray(outs)) {
    for (const o of outs) {
      expand(o.getBounds());
    }
  }
  return { left, top, right, bottom };
}

/**
 * Positions the primary line with bottom-center at `(anchorX, anchorY)`, then nudges it so the unioned bounds
 * (including outline layers) stay inside `[inset, width - inset]` horizontally and do not cross above `y = inset`.
 */
function clampPrimaryLineBottomCenterToScreen(
  primaryLine: Phaser.GameObjects.BitmapText,
  anchorX: number,
  anchorY: number,
  viewW: number,
  inset: number,
): void {
  primaryLine.setOrigin(0.5, 1);
  primaryLine.setPosition(Math.round(anchorX), Math.round(anchorY));
  syncOutlinedGuiBitmapTextPositions(primaryLine);
  const bb = unionOutlinedBitmapTextScreenBounds(primaryLine);
  if (!(bb.right > bb.left && bb.bottom > bb.top)) {
    return;
  }
  const minX = inset;
  const maxX = viewW - inset;
  const minY = inset;
  let dx = 0;
  let dy = 0;
  const innerW = maxX - minX;
  const spanW = bb.right - bb.left;
  if (innerW > 0 && spanW <= innerW) {
    if (bb.left < minX) {
      dx = minX - bb.left;
    } else if (bb.right > maxX) {
      dx = maxX - bb.right;
    }
  } else if (innerW > 0) {
    /** Wider than the safe band: keep the start edge inside the inset (right may still clip). */
    dx = minX - bb.left;
  }
  if (bb.top < minY) {
    dy = minY - bb.top;
  }
  if (dx !== 0 || dy !== 0) {
    primaryLine.setPosition(Math.round(anchorX + dx), Math.round(anchorY + dy));
    syncOutlinedGuiBitmapTextPositions(primaryLine);
  }
}

export interface GuiOverlayHandle {
  /** Updates the dialogue line control (`id: line`) if present, else the first text control. */
  setPrimaryText(text: string): void;
  /**
   * Places the **bottom-center** of the primary line (after word wrap) at `(x, y)` in game-canvas space,
   * then rounds and **clamps** so the line plus any outline layers stay inside the internal resolution (inset from
   * left/right/top). Restores authored origin/position via {@link resetPrimaryScreenPosition}.
   */
  setPrimaryScreenPositionBottomCenter(x: number, y: number): void;
  /** Restores the primary line to its authored GUI position and display origin. */
  resetPrimaryScreenPosition(): void;
  setControlText(id: string, text: string): void;
  /**
   * **`display-text` GUI only** — sets narration text and resizes `displayTextBg` / `text` to fit.
   * No-op when this overlay is not the reserved Display Text layout (missing controls → no-op).
   */
  setDisplayTextLayout(text: string): void;
  setVisible(visible: boolean): void;
  /** Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing). */
  setLetterSpacing(spacing: number): void;
  /**
   * Top-level scene object(s) for this overlay. After packing, the **movable** authored controls live under
   * one screen-fixed **`Container`** (`gui.root` in **`GuiRuntime`**). Any control **`id`** listed in
   * **`GuiData.fixedControls`** is kept as an additional top-level object (not parented under that container)
   * so root-level tweens do not move it; those objects are included here after the container. Phaser renders
   * packed children through the parent; camera `ignore()` follows the same rule for every entry. Runtime-only
   * behavior objects may append when a **`GuiRuntime`** exists. Used by **`RoomScene`** to route GUI through a
   * dedicated UI camera with `origin=(0,0)` in the editor preview so `scrollFactor=0` placement survives
   * non-unit camera zoom (Phaser 4's origin-aware zoom math otherwise pushes screen-fixed overlays far off
   * the viewport when `camera.zoom ≠ 1`).
   */
  readonly gameObjects: readonly Phaser.GameObjects.GameObject[];
  destroy(): void;
}

/**
 * Result of {@link buildGuiOverlay}: the overlay handle plus an optional {@link GuiRuntime} factory for `*.gui.ts` behaviors.
 */
export interface BuiltGuiOverlay {
  handle: GuiOverlayHandle;
  /**
   * Creates a {@link GuiRuntime} for this overlay (control facades, triggers). Call once per room load.
   * Disposal is chained into {@link GuiOverlayHandle.destroy}.
   */
  createGuiRuntime(queueInteraction: (factory: () => Promise<unknown>) => void): GuiRuntime;
}

function originFromAlign(align: GuiTextAlign | undefined): { x: number; y: number } {
  switch (align) {
    case 'center':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function hexStringToTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0xffffff;
  }
}

/** Depth of the button label stack inside the hit container (above {@link GUI_BUTTON_BG_DEPTH}). */
const GUI_BUTTON_LABEL_DEPTH = 20;
const GUI_BUTTON_OUTLINE_DEPTH_BELOW_LABEL = 19;

const GUI_BUTTON_BG_DEPTH = 0;

/**
 * Creates outline `BitmapText` copies behind `main` (caller sets `main.setDepth` above all outlines).
 * Each outline uses `outlineDepthCeiling - i * ε` so ordering stays stable and below the main label.
 */
function createGuiBitmapTextOutlines(
  scene: Phaser.Scene,
  main: Phaser.GameObjects.BitmapText,
  outline: GuiTextOutline | undefined,
  visible: boolean,
  outlineDepthCeiling: number,
): Phaser.GameObjects.BitmapText[] {
  const spec = resolveEffectiveGuiTextOutline(outline);
  if (!spec) {
    return [];
  }
  const outs: Phaser.GameObjects.BitmapText[] = [];
  let i = 0;
  const mw = (main as { maxWidth?: number }).maxWidth;
  const ls = (main as { letterSpacing?: number }).letterSpacing ?? 0;
  for (const { dx, dy } of spec.offsets) {
    const o = scene.add.bitmapText(main.x + dx, main.y + dy, main.font, main.text, main.fontSize, main.align);
    o.setOrigin(main.originX, main.originY);
    if (ls !== 0) {
      o.setLetterSpacing(ls);
    }
    if (typeof mw === 'number' && mw > 0) {
      o.setMaxWidth(mw);
    }
    o.setScrollFactor(0, 0);
    o.setDepth(outlineDepthCeiling - i * 0.0001);
    o.setVisible(visible);
    o.setData(BENNE_GUI_OUTLINE_DX_KEY, dx);
    o.setData(BENNE_GUI_OUTLINE_DY_KEY, dy);
    if (spec) {
      applyGuiBitmapTextFillTint(o, spec.tint);
      o.setAlpha(spec.alpha);
      o.setData(BENNE_GUI_OUTLINE_FILL_TINT_KEY, spec.tint);
      o.setData(BENNE_GUI_OUTLINE_FILL_ALPHA_KEY, spec.alpha);
    }
    outs.push(o);
    i += 1;
  }
  attachGuiBitmapTextOutlineList(main, outs);
  return outs;
}

/**
 * Phaser WebGL `BitmapText` uses unrounded per-glyph positions from `GetBitmapTextSize`; center/right alignment
 * often adds half-pixel offsets. For wrapped text, using an **even** max width makes longest-line metrics more
 * often land on whole pixels (debug: compare `align: left` vs `center` on the same string).
 */
function evenWordWrapWidth(width: number): number {
  const w = Math.floor(width);
  if (w < 2) {
    return 0;
  }
  return w % 2 === 0 ? w : w - 1;
}

function bitmapTextLineAlign(align: GuiTextAlign | undefined): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

/**
 * Measures wrapped `BitmapText` size for a button label (matches {@link buildGuiButton} font / align / spacing).
 * Destroys the temporary object; safe to call during layout passes.
 */
export function measureGuiButtonTextBlockSize(
  scene: Phaser.Scene,
  c: Pick<GuiButtonControl, 'font' | 'fontSize' | 'text' | 'textAlign' | 'textOutline'>,
  wordWrapInnerWidth: number,
): { w: number; h: number } {
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (!fontEntry || !scene.cache.bitmapFont.exists(c.font)) {
    return { w: 64, h: 14 };
  }
  const align = c.textAlign ?? 'center';
  const lineAlign = bitmapTextLineAlign(align);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
  const tmp = scene.add.bitmapText(0, 0, c.font, c.text ?? '', renderSize, lineAlign);
  tmp.setVisible(false);
  tmp.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
  const maxW = evenWordWrapWidth(wordWrapInnerWidth);
  if (maxW > 0) {
    tmp.setMaxWidth(maxW);
  }
  const letterSpacing = fontEntry.defaultLetterSpacing ?? 0;
  if (letterSpacing !== 0) {
    tmp.setLetterSpacing(letterSpacing);
  }
  const b = tmp.getBounds();
  tmp.destroy();
  const pad = guiTextOutlineMaxAbsOffsetForBounds(c.textOutline);
  return {
    w: Math.max(1, Math.round(b.width) + 2 * pad),
    h: Math.max(1, Math.round(b.height) + 2 * pad),
  };
}

/**
 * BMFont XML often uses a negative `info size` (e.g. -8). Phaser scales with `fontSize / fontData.size`; if signs
 * disagree, scale becomes negative and flips/mirrors glyphs. Match the sign of `fontData.size`.
 */
function effectiveBitmapFontRenderSize(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  const entry = scene.cache.bitmapFont.get(fontKey) as { data?: { size?: number } } | null;
  const dataSize = entry?.data?.size;
  if (dataSize == null || dataSize === 0) {
    return fontSize;
  }
  return dataSize < 0 ? -Math.abs(fontSize) : Math.abs(fontSize);
}

function guiSpriteAnchorOrDefault(a: GuiSpriteAnchor | undefined): GuiSpriteAnchor {
  return a ?? 'top-left';
}

/**
 * Applies a GUI Aseprite **tag** (animation or named frame) to `sprite`.
 * Returns **`false`** when the tag does not exist on the sheet — callers must **`destroy`** the sprite so the
 * atlas’s default frame (often an untagged first cel) never appears on screen.
 */
function stopSpriteAnimationIfPlaying(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.anims?.isPlaying) {
    sprite.anims.stop();
  }
}

/** Stops any playing clip before applying a tag so static frames and clips can switch cleanly. */
function reapplyGuiSheetTag(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  tag: string,
  guiId: string,
): boolean {
  stopSpriteAnimationIfPlaying(sprite);
  return tryApplyGuiSheetTag(scene, sprite, textureKey, tag, guiId);
}

function tryApplyGuiSheetTag(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  tag: string,
  guiId: string,
): boolean {
  const t = tag.trim();
  if (!t || !scene.textures.exists(textureKey)) {
    return false;
  }
  ensureAsepriteAtlasAnimationsRegisteredOnce(scene, textureKey);
  const animKey = guiPhaserAnimationKey(guiId, t);
  if (scene.anims.exists(animKey)) {
    sprite.play(animKey);
    return true;
  }
  try {
    const tex = scene.textures.get(textureKey);
    const names = tex.getFrameNames(false);
    if (!names.includes(animKey)) {
      return false;
    }
    sprite.setFrame(animKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Positions a GUI-sheet sprite for `top-left`, `center`, or `screen` anchor.
 * `screen`: top-left of the game canvas / internal resolution — ignores `x`/`y` for placement (full-frame HUD art).
 * `offX` / `offY` are an extra pixel nudge in the same space as `x`/`y` (or canvas space for `screen`).
 */
function applyGuiSpriteAnchor(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  x: number,
  y: number,
  offX = 0,
  offY = 0,
): void {
  switch (anchor) {
    case 'center':
      sprite.setOrigin(0.5, 0.5);
      sprite.setPosition(Math.round(x + offX), Math.round(y + offY));
      break;
    case 'screen':
      sprite.setOrigin(0, 0);
      /** Absolute screen / canvas coordinates; control `x`/`y` are ignored for draw position. */
      sprite.setPosition(Math.round(offX), Math.round(offY));
      break;
    default:
      sprite.setOrigin(0, 0);
      sprite.setPosition(Math.round(x + offX), Math.round(y + offY));
  }
}

/**
 * Places the button’s sheet sprite using `anchor` **within the button’s logical bounds** (coordinates are
 * **local** to the button {@link Phaser.GameObjects.Container}, whose top-left is the hit rect origin).
 */
function placeGuiButtonBackgroundSpriteLocal(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  w: number,
  h: number,
  /** World-space top-left of the button container — only used when `anchor === 'screen'`. */
  worldTopLeft: { x: number; y: number },
  offX = 0,
  offY = 0,
): void {
  const inset = getAsepriteSpriteSourceInset(sprite.frame);
  switch (anchor) {
    case 'center':
      {
        const p = resolveAuthoredPositionForAsepriteTrim('center', w / 2, h / 2, sprite.frame);
        applyGuiSpriteAnchor(sprite, 'center', p.x, p.y, offX, offY);
      }
      break;
    case 'screen':
      sprite.setOrigin(0, 0);
      sprite.setPosition(Math.round(-worldTopLeft.x + offX), Math.round(-worldTopLeft.y + offY));
      break;
    default:
      applyGuiSpriteAnchor(sprite, 'top-left', -inset.x, -inset.y, offX, offY);
      break;
  }
}

export interface BuiltGuiButton {
  /** Invisible hit box (`width` × `height`); carries pointer handlers. */
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Sprite | null;
  readonly label: Phaser.GameObjects.BitmapText | null;
  /** Outline copies behind {@link BuiltGuiButton.label}; empty when no outline. */
  readonly labelOutlines: readonly Phaser.GameObjects.BitmapText[];
  readonly enabled: boolean;
  readonly width: number;
  readonly height: number;
}

/** Depth bias for the **debug outline** of trigger rectangles within their overlay (layout visualisation only). */
const GUI_TRIGGER_DEBUG_DEPTH_BIAS = 5_000;

/**
 * Builds the visual placeholder for a `trigger` control. The rectangle is **never interactive** — input is
 * routed through a scene-level `pointermove` observer (see `installGuiTriggerPointerObserver`). Keeping it as a
 * normal scene object lets packing, camera routing, and `setVisible` keep working uniformly across controls.
 * Local hit rect is **`(0, 0, width, height)`** from the top-left so authored `x` / `y` matches other controls.
 */
function buildGuiTriggerZone(
  scene: Phaser.Scene,
  c: GuiTriggerControl,
  baseDepth: number,
  startVisible: boolean,
  /** When set, the rectangle is parented under this container using local coordinates. */
  parent?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Rectangle | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }
  const id = c.id?.trim() ?? '';
  if (!id) {
    return null;
  }
  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const overlayVisible = startVisible && c.visible !== false;
  const showGuiDebug = getGameSettings().debug?.showGuiOutlines === true;

  /**
   * Debug mode fills a translucent rect and strokes its border; in shipping mode the rect is invisible but
   * still participates in display-list packing and camera ignore routing like any other control.
   */
  const rect = scene.add.rectangle(px + w / 2, py + h / 2, w, h, 0x88ff88, showGuiDebug ? 0.18 : 0);
  rect.setScrollFactor(0, 0);
  rect.setDepth(baseDepth + GUI_TRIGGER_DEBUG_DEPTH_BIAS);
  rect.setVisible(overlayVisible);
  if (showGuiDebug) {
    rect.setStrokeStyle(1, 0x88ff88, 0.9);
  }
  if (parent) {
    parent.add(rect);
  }
  return rect;
}

/**
 * Minimum positional / visibility fields read by {@link installGuiControlPointerHoverObserver}. Declared as a
 * structural type (not an interface extending `GameObject`) so it accepts the overlap shared by `Sprite`,
 * `Container`, `BitmapText`, and `Rectangle` without fighting Phaser 4's strict typings.
 */
type GuiHoverObservableGameObject = Phaser.GameObjects.GameObject & {
  visible: boolean;
  setVisible(value: boolean): unknown;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  parentContainer?: Phaser.GameObjects.Container | null;
  getBounds?: () => Phaser.Geom.Rectangle;
};

/**
 * Computes the current **world-space** bounds of a `scrollFactor: 0` GUI control. Prefers `getBounds()` because
 * it handles arbitrary transforms / packed children (e.g. `inventoryPanel` containers); falls back to a centered
 * rect for plain `Rectangle` game objects (whose `getBounds()` is sometimes 0-sized on Phaser 4 when the Shape
 * has no stroke). Hit tests map the pointer through the GUI camera (`editor-ui` when present, else `main`) via
 * {@link Phaser.Cameras.Scene2D.Camera#getWorldPoint} so coordinates match under hi-DPI letterboxing.
 */
function computeGuiControlWorldRect(
  target: GuiHoverObservableGameObject,
): { left: number; top: number; right: number; bottom: number } | null {
  if (typeof target.getBounds === 'function') {
    const b = target.getBounds();
    if (b.width > 0 && b.height > 0) {
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    }
  }
  const w = target.displayWidth ?? target.width ?? 0;
  const h = target.displayHeight ?? target.height ?? 0;
  if (!(w > 0 && h > 0)) {
    return null;
  }
  const parent = target.parentContainer ?? null;
  const ox = parent ? parent.x : 0;
  const oy = parent ? parent.y : 0;
  const cx = (target.x ?? 0) + ox;
  const cy = (target.y ?? 0) + oy;
  /** Rectangle game objects are centered on `(x, y)`; other objects rarely hit this fallback. */
  const halfW = w / 2;
  const halfH = h / 2;
  return { left: cx - halfW, top: cy - halfH, right: cx + halfW, bottom: cy + halfH };
}

/**
 * Scene-level pointer observer that emits `guiControlMouseEnter/LeaveEventId` on rect-containment transitions
 * for a GUI control, **without** calling `setInteractive`. Used for `trigger` controls and for non-button
 * controls (`image`, `inventoryPanel`, `text`) so hover events work uniformly while the room beneath keeps
 * receiving prop / hotspot / character clicks. Gated by live `visible` state (the control's own plus its
 * `parentContainer`'s) so a parked / hidden overlay never spurious-fires. Hooks `setVisible` so hiding the
 * control flushes a synthetic leave. Returns a disposer that detaches the listener and — if currently inside —
 * emits a final leave.
 */
function installGuiControlPointerHoverObserver(
  scene: Phaser.Scene,
  gui: GuiData,
  controlId: string,
  target: GuiHoverObservableGameObject,
  options?: { active?: boolean },
): () => void {
  const id = controlId.trim();
  if (!id) {
    return () => {};
  }
  if (options?.active === false) {
    return () => {};
  }
  let inside = false;

  const isEffectivelyVisible = (): boolean => {
    if (!target.visible) {
      return false;
    }
    const parent = target.parentContainer ?? null;
    if (parent && !parent.visible) {
      return false;
    }
    return true;
  };

  const emitLeaveIfInside = (): void => {
    if (!inside) {
      return;
    }
    inside = false;
    gameEvents.emit(guiControlMouseLeaveEventId(gui.id, id));
  };

  const ptrWorldScratch = new Phaser.Math.Vector2();
  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!isEffectivelyVisible()) {
      emitLeaveIfInside();
      return;
    }
    const rect = computeGuiControlWorldRect(target);
    if (!rect) {
      emitLeaveIfInside();
      return;
    }
    const cam = scene.cameras.getCamera('editor-ui') ?? scene.cameras.main;
    const wp = cam.getWorldPoint(pointer.x, pointer.y, ptrWorldScratch);
    const inRect =
      wp.x >= rect.left && wp.x <= rect.right && wp.y >= rect.top && wp.y <= rect.bottom;
    if (inRect && !inside) {
      inside = true;
      gameEvents.emit(guiControlMouseEnterEventId(gui.id, id));
    } else if (!inRect && inside) {
      emitLeaveIfInside();
    }
  };

  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onPointerMove);

  /** Hook `setVisible` so hiding the control (or its overlay) flushes a leave synchronously. */
  const originalSetVisible = target.setVisible.bind(target);
  target.setVisible = (v: boolean) => {
    const prev = target.visible;
    const result = originalSetVisible(v);
    if (prev && !v) {
      emitLeaveIfInside();
    }
    return result;
  };

  return () => {
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onPointerMove);
    emitLeaveIfInside();
    target.setVisible = originalSetVisible;
  };
}

/**
 * Installs pointer **mouseenter / mouseleave** forwarding on `target` so `B.whenMouseEnter(controlId, …)` /
 * `whenMouseLeave(controlId, …)` observe it. Safe for objects that are already interactive (e.g. buttons);
 * for non-interactive ones the caller must call `setInteractive` beforehand (triggers, inventory panels, images, text).
 * Returns a disposer that detaches listeners.
 */
export function wireGuiControlHoverEvents(
  gui: GuiData,
  controlId: string,
  target: Phaser.GameObjects.GameObject,
): () => void {
  const id = controlId.trim();
  if (!id) {
    return () => {};
  }
  const onOver = (): void => {
    gameEvents.emit(guiControlMouseEnterEventId(gui.id, id));
  };
  const onOut = (): void => {
    gameEvents.emit(guiControlMouseLeaveEventId(gui.id, id));
  };
  target.on('pointerover', onOver);
  target.on('pointerout', onOut);
  return () => {
    target.off('pointerover', onOver);
    target.off('pointerout', onOut);
  };
}

function applyGuiButtonInteractivity(
  container: Phaser.GameObjects.Container,
  width: number,
  height: number,
  enabled: boolean,
): void {
  const g = new Phaser.Geom.Rectangle(0, 0, width, height);
  container.setInteractive(g, Phaser.Geom.Rectangle.Contains);
  if (container.input) {
    /** `true` uses the hand cursor over the hit area (Phaser `InteractiveObject.cursor`). */
    const showOsHand = enabled && !isBenneGameCursorAsepriteEnabled(getGameSettings());
    container.input.cursor = showOsHand;
  }
}

export function buildGuiButton(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiButtonControl,
  baseDepth: number,
  startVisible: boolean,
  /** Runs after a successful click passes guards, before {@link gameEvents} button emits. */
  onBeforeEmit?: () => void,
  /**
   * Top-left of the button’s hit rect in **GUI content root** space (same frame as authored `x`/`y`).
   * Used only for `backgroundAnchor: 'screen'` so full-frame art stays pinned to the canvas when the button sits in a grid.
   */
  screenBgWorldTopLeft?: { x: number; y: number },
  /**
   * Optional guard called on `pointerup`: when it returns **`true`** the click is swallowed.
   * Provided by {@link RoomScene} for cutscene-mode suppression.
   */
  isClickSuppressed?: () => boolean,
): BuiltGuiButton | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }

  const z = c.zIndex ?? 0;
  const d = baseDepth + z;
  const overlayVisible = startVisible && c.visible !== false;
  const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
  const bgOffX = c.backgroundOffsetX ?? 0;
  const bgOffY = c.backgroundOffsetY ?? 0;
  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const worldTL = screenBgWorldTopLeft ?? { x: px, y: py };

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  hitTarget.setDepth(d);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData('benneGuiButton', true);

  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const defaultBgTag = c.backgroundTag.trim();
  let bg: Phaser.GameObjects.Sprite | null = null;

  if (usesAsepriteDisplay(gui) && defaultBgTag && scene.textures.exists(guiTextureKey)) {
    const sprite = scene.add.sprite(0, 0, guiTextureKey);
    sprite.setDepth(GUI_BUTTON_BG_DEPTH);
    sprite.setVisible(false);
    sprite.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, defaultBgTag, gui.id)) {
      sprite.destroy();
    } else {
      sprite.setVisible(overlayVisible);
      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(
          sprite.frame,
          `GUI "${gui.id}" button "${c.id}" background`,
        );
      }
      placeGuiButtonBackgroundSpriteLocal(sprite, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
      hitTarget.add(sprite);
      bg = sprite;
    }
  }

  let label: Phaser.GameObjects.BitmapText | null = null;
  const labelOutlines: Phaser.GameObjects.BitmapText[] = [];
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (fontEntry && scene.cache.bitmapFont.exists(c.font)) {
    const align = c.textAlign ?? 'center';
    const ox = c.textOffsetX ?? 0;
    const oy = c.textOffsetY ?? 0;
    const pad = 4;
    const labelX = align === 'left' ? pad + ox : align === 'right' ? w - pad + ox : w / 2 + ox;
    const labelY = h / 2 + oy;
    const lineAlign = bitmapTextLineAlign(align);
    const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
    const bt = scene.add.bitmapText(labelX, labelY, c.font, c.text ?? '', renderSize, lineAlign);
    bt.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    const labelTint = hexStringToTint(c.textColor ?? '#ffffff');
    applyGuiBitmapTextFillTint(bt, labelTint);
    bt.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, labelTint);
    const letterSpacing = fontEntry.defaultLetterSpacing ?? 0;
    if (letterSpacing !== 0) {
      bt.setLetterSpacing(letterSpacing);
    }
    if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
      const maxW = evenWordWrapWidth(c.wordWrapWidth);
      if (maxW > 0) {
        bt.setMaxWidth(maxW);
      }
    }
    bt.setScrollFactor(0, 0);
    bt.setVisible(overlayVisible);
    const outs = createGuiBitmapTextOutlines(
      scene,
      bt,
      c.textOutline,
      overlayVisible,
      GUI_BUTTON_OUTLINE_DEPTH_BELOW_LABEL,
    );
    for (const o of outs) {
      hitTarget.add(o);
      labelOutlines.push(o);
    }
    bt.setDepth(GUI_BUTTON_LABEL_DEPTH);
    hitTarget.add(bt);
    label = bt;
  } else if (c.font.trim().length > 0) {
    console.warn(`[Benne] GUI button "${c.id}": unknown or unloaded font "${c.font}".`);
  }

  if (!bg && !label) {
    hitTarget.destroy();
    return null;
  }

  const enabled = c.enabled !== false;
  if (!enabled) {
    hitTarget.setAlpha(0.45);
    bg?.setAlpha(0.45);
    label?.setAlpha(0.45);
    for (const lo of labelOutlines) {
      lo.setAlpha(0.45);
    }
    const dTag = c.states?.disabled?.trim();
    if (bg && dTag) {
      reapplyGuiSheetTag(scene, bg, guiTextureKey, dTag, gui.id);
      placeGuiButtonBackgroundSpriteLocal(bg, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
    }
  }

  if (overlayVisible && enabled) {
    applyGuiButtonInteractivity(hitTarget, w, h, enabled);
  }

  const hoverTag = c.states?.hover?.trim();
  const pressedTag = c.states?.pressed?.trim();
  const disabledTag = c.states?.disabled?.trim();
  const hoverTextColor = c.textColorStates?.hover?.trim();
  const pressedTextColor = c.textColorStates?.pressed?.trim();
  const disabledTextColor = c.textColorStates?.disabled?.trim();
  const defaultTextTint = hexStringToTint(c.textColor ?? '#ffffff');
  const hoverTextTint = hoverTextColor ? hexStringToTint(hoverTextColor) : defaultTextTint;
  const pressedTextTint = pressedTextColor ? hexStringToTint(pressedTextColor) : defaultTextTint;
  const disabledTextTint = disabledTextColor ? hexStringToTint(disabledTextColor) : defaultTextTint;

  const setLabelTint = (tint: number): void => {
    if (!label) {
      return;
    }
    applyGuiBitmapTextFillTint(label, tint);
    label.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, tint);
  };

  const repositionButtonBg = (): void => {
    if (bg) {
      placeGuiButtonBackgroundSpriteLocal(bg, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
    }
  };

  const syncButtonChromeAlpha = (a: number): void => {
    hitTarget.setAlpha(a);
    bg?.setAlpha(a);
    label?.setAlpha(a);
    for (const lo of labelOutlines) {
      lo.setAlpha(a);
    }
  };

  const applyChromeVisual = (visual: BenneGuiScriptButtonVisualState): void => {
    if (!enabled) {
      return;
    }
    const applyBgForState = (tag: string | undefined): void => {
      if (!bg) {
        return;
      }
      const t = tag?.trim();
      if (t && reapplyGuiSheetTag(scene, bg, guiTextureKey, t, gui.id)) {
        repositionButtonBg();
        return;
      }
      reapplyGuiSheetTag(scene, bg, guiTextureKey, defaultBgTag, gui.id);
      repositionButtonBg();
    };

    switch (visual) {
      case 'normal':
        if (bg) {
          reapplyGuiSheetTag(scene, bg, guiTextureKey, defaultBgTag, gui.id);
          repositionButtonBg();
        }
        setLabelTint(defaultTextTint);
        syncButtonChromeAlpha(1);
        break;
      case 'hover':
        applyBgForState(hoverTag);
        setLabelTint(hoverTextColor ? hoverTextTint : defaultTextTint);
        syncButtonChromeAlpha(1);
        break;
      case 'pressed':
        applyBgForState(pressedTag);
        setLabelTint(pressedTextColor ? pressedTextTint : defaultTextTint);
        syncButtonChromeAlpha(1);
        break;
      case 'disabled':
        applyBgForState(disabledTag);
        setLabelTint(disabledTextColor ? disabledTextTint : defaultTextTint);
        syncButtonChromeAlpha(0.45);
        break;
      default:
        break;
    }
  };

  if (enabled) {
    hitTarget.setData(BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY, applyChromeVisual);
  }

  const pointerDrivesChrome =
    enabled &&
    ((bg !== null && (Boolean(hoverTag) || Boolean(pressedTag) || Boolean(disabledTag))) ||
      (label !== null && (Boolean(hoverTextColor) || Boolean(pressedTextColor) || Boolean(disabledTextColor))));

  if (pointerDrivesChrome) {
    hitTarget.on('pointerover', () => {
      if (benneGuiButtonReadVisualScriptLock(hitTarget)) {
        return;
      }
      applyChromeVisual('hover');
    });
    hitTarget.on('pointerout', () => {
      if (benneGuiButtonReadVisualScriptLock(hitTarget)) {
        return;
      }
      applyChromeVisual('normal');
    });
    hitTarget.on('pointerdown', () => {
      if (benneGuiButtonReadVisualScriptLock(hitTarget)) {
        return;
      }
      applyChromeVisual('pressed');
    });
    hitTarget.on('pointerup', () => {
      if (benneGuiButtonReadVisualScriptLock(hitTarget)) {
        return;
      }
      applyChromeVisual('normal');
    });
  }

  if (!enabled && label && disabledTextColor) {
    setLabelTint(disabledTextTint);
  }

  hitTarget.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !hitTarget.visible || !pointer.leftButtonReleased()) {
      return;
    }
    if (isClickSuppressed?.()) {
      return;
    }
    onBeforeEmit?.();
    gameEvents.emit(guiButtonClickEventId(gui.id, c.id));
    gameEvents.emit(guiAllButtonsClickEventId(gui.id), { buttonId: c.id } satisfies GuiAllButtonsClickPayload);
  });

  return { hitTarget, background: bg, label, labelOutlines, enabled, width: w, height: h };
}

function addGuiBitmapLine(
  scene: Phaser.Scene,
  c: GuiTextControl,
  initial: string,
  depth: number,
  visible: boolean,
): { main: Phaser.GameObjects.BitmapText; outlines: Phaser.GameObjects.BitmapText[] } | null {
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (!fontEntry) {
    console.warn(`[Benne] Unknown GUI font id "${c.font}" — add it to src/game/assets/fonts/fonts.json.`);
    return null;
  }

  if (!scene.cache.bitmapFont.exists(c.font)) {
    console.warn(`[Benne] Bitmap font "${c.font}" is not in the cache (preload order?).`);
    return null;
  }

  const o = originFromAlign(c.align);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const lineAlign = bitmapTextLineAlign(c.align);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
  const bt = scene.add.bitmapText(x, y, c.font, initial, renderSize, lineAlign);
  bt.setOrigin(o.x, o.y);
  const mainTint = hexStringToTint(c.color ?? '#ffffff');
  applyGuiBitmapTextFillTint(bt, mainTint);
  bt.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, mainTint);
  if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
    const maxW = evenWordWrapWidth(c.wordWrapWidth);
    if (maxW > 0) {
      bt.setMaxWidth(maxW);
    }
  }
  const letterSpacing = c.letterSpacing ?? fontEntry.defaultLetterSpacing ?? 0;
  if (letterSpacing !== 0) {
    bt.setLetterSpacing(letterSpacing);
  }
  bt.setScrollFactor(0, 0);
  const outlines = createGuiBitmapTextOutlines(scene, bt, c.textOutline, visible, depth - 0.0001);
  bt.setDepth(depth);
  bt.setVisible(visible);
  return { main: bt, outlines };
}

/**
 * Pixel-perfect alpha for GUI `image` sprites does not account for **draw order** — an opaque HUD texel
 * under a later-drawn inventory grid still tests “hit”. Combined with `input.topOnly`, that can steal
 * clicks from {@link buildGuiButton} hit targets and {@link fillInventoryPanelContent} slot rows.
 * When the pointer lies inside any of those regions, we yield so Phaser can deliver input there instead.
 */
function makeBenneGuiImagePixelPerfectHitCallback(
  scene: Phaser.Scene,
  alphaTolerance: number,
  deferBelow: readonly Phaser.GameObjects.GameObject[],
): Phaser.Types.Input.HitAreaCallback {
  const base = scene.input.makePixelPerfect(alphaTolerance);
  return (hitArea, x, y, gameObject) => {
    if (!base(hitArea, x, y, gameObject)) {
      return false;
    }
    const ptr = scene.input.activePointer;
    for (const target of deferBelow) {
      if (!target.scene) {
        continue;
      }
      const go = target as Phaser.GameObjects.GameObject & {
        active?: boolean;
        visible?: boolean;
        parentContainer?: Phaser.GameObjects.Container | null;
        getBounds?: () => Phaser.Geom.Rectangle;
      };
      if (go.active === false) {
        continue;
      }
      if (go.visible === false) {
        continue;
      }
      const parent = go.parentContainer ?? null;
      if (parent && !parent.visible) {
        continue;
      }
      if (typeof go.getBounds !== 'function') {
        continue;
      }
      const b = go.getBounds();
      if (b.width <= 0 || b.height <= 0) {
        continue;
      }
      if (Phaser.Geom.Rectangle.Contains(b, ptr.x, ptr.y)) {
        return false;
      }
    }
    return true;
  };
}

export function addGuiImageSprite(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiImageControl,
  depth: number,
  startVisible: boolean,
  extraSprites: Phaser.GameObjects.GameObject[],
  controlsById: Map<string, Phaser.GameObjects.GameObject>,
  /** In-world hit targets that must receive input ahead of this image (same overlay). Filled as controls are built. */
  imageInputDeferBelow: Phaser.GameObjects.GameObject[],
  /** When set, positions the sprite at `x`/`y` (local to `parent` when given) instead of the control’s authored `x`/`y`. */
  layout?: {
    x: number;
    y: number;
    parent?: Phaser.GameObjects.Container;
    /** Top-left of this control’s origin in GUI content root space — required for `screen` anchor under `parent`. */
    screenRootTopLeft?: { x: number; y: number };
    /**
     * From {@link tryResolveGridPlacement}: `x`/`y` are the **top-left** of this box inside the cell.
     * Width/height seed layout; after the sheet tag is applied, size is re-measured from the sprite.
     */
    gridContentBox?: { w: number; h: number };
    /**
     * True when `gridPlacement.align` is `"center"` (cell-centered box). Uses the **box center** for
     * trim math and Phaser origin `0.5,0.5` even if `backgroundAnchor` is omitted (defaults to top-left).
     */
    gridCenterAlign?: boolean;
  },
): Phaser.GameObjects.Sprite | null {
  if (!usesAsepriteDisplay(gui)) {
    return null;
  }
  const legacyDisplay = (c as GuiImageControl & { display?: { tag?: string; backgroundAnchor?: GuiSpriteAnchor } })
    .display;
  const tag = (c.tag ?? legacyDisplay?.tag)?.trim() ?? '';
  if (!tag) {
    return null;
  }
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  if (!scene.textures.exists(guiTextureKey)) {
    return null;
  }
  const anchor = guiSpriteAnchorOrDefault(c.backgroundAnchor ?? legacyDisplay?.backgroundAnchor);
  const bgOffX = c.backgroundOffsetX ?? 0;
  const bgOffY = c.backgroundOffsetY ?? 0;
  const lx = layout?.x ?? c.x;
  const ly = layout?.y ?? c.y;
  const gridCenterAlign = layout?.gridCenterAlign === true;
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  sprite.setScrollFactor(0, 0);
  sprite.setDepth(depth + (c.zIndex ?? 0));
  const vis = startVisible && c.visible !== false;
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag, gui.id)) {
    sprite.destroy();
    return null;
  }
  sprite.setVisible(vis);
  if (import.meta.env.DEV) {
    warnDevIfAsepriteJsonMissingSpriteSourceSize(sprite.frame, `GUI "${gui.id}" image control`);
  }

  let placementBox: { w: number; h: number } | undefined;
  if (layout?.gridContentBox) {
    placementBox = getAsepriteVisibleFrameSize(sprite.frame);
  }

  /**
   * `gridPlacement.align: "center"` centers the **content box** in the cell; `backgroundAnchor: "center"`
   * pins the sprite by its center. Either case needs the box center for trim-adjusted coordinates.
   * With default top-left anchor + center grid align, we still center the art in the cell (origin 0.5).
   */
  const useBoxCenterForTrim =
    anchor !== 'screen' && !!placementBox && (anchor === 'center' || gridCenterAlign);
  const effSpriteAnchor: GuiSpriteAnchor =
    anchor === 'screen' ? 'screen' : useBoxCenterForTrim ? 'center' : anchor;

  const placementAnchorX =
    placementBox && useBoxCenterForTrim ? lx + placementBox.w / 2 : lx;
  const placementAnchorY =
    placementBox && useBoxCenterForTrim ? ly + placementBox.h / 2 : ly;

  const parent = layout?.parent;
  const rootTL = anchor === 'screen' && parent ? layout?.screenRootTopLeft : undefined;
  const needsAuthoredPlacementData =
    (anchor !== 'screen' && (effSpriteAnchor === 'top-left' || effSpriteAnchor === 'center')) ||
    (anchor === 'screen' && parent && !rootTL);
  if (needsAuthoredPlacementData) {
    const effAnchor: GuiSpriteAnchor =
      anchor === 'screen' && parent && !rootTL ? 'top-left' : effSpriteAnchor;
    const facadeX = anchor === 'screen' && parent && !rootTL ? lx : placementAnchorX;
    const facadeY = anchor === 'screen' && parent && !rootTL ? ly : placementAnchorY;
    sprite.setData('benneGuiUsesAuthoredAsepritePlacement', true);
    sprite.setData('benneGuiSpritePlacementAnchor', effAnchor);
    sprite.setData('benneGuiAuthoredX', facadeX);
    sprite.setData('benneGuiAuthoredY', facadeY);
    sprite.setData('benneGuiAuthoredOffsetX', bgOffX);
    sprite.setData('benneGuiAuthoredOffsetY', bgOffY);
  }

  if (anchor === 'screen' && parent) {
    if (rootTL) {
      sprite.setOrigin(0, 0);
      sprite.setPosition(Math.round(-rootTL.x + bgOffX), Math.round(-rootTL.y + bgOffY));
    } else {
      const p = resolveAuthoredPositionForAsepriteTrim('top-left', lx, ly, sprite.frame);
      applyGuiSpriteAnchor(sprite, 'top-left', p.x, p.y, bgOffX, bgOffY);
    }
    parent.add(sprite);
    extraSprites.push(sprite);
  } else if (anchor === 'screen') {
    applyGuiSpriteAnchor(sprite, anchor, lx, ly, bgOffX, bgOffY);
    extraSprites.push(sprite);
  } else {
    const p = resolveAuthoredPositionForAsepriteTrim(
      effSpriteAnchor,
      placementAnchorX,
      placementAnchorY,
      sprite.frame,
    );
    applyGuiSpriteAnchor(sprite, effSpriteAnchor, p.x, p.y, bgOffX, bgOffY);
    if (parent) {
      parent.add(sprite);
    }
    extraSprites.push(sprite);
  }
  if (needsAuthoredPlacementData) {
    wireBenneGuiAsepriteTrimmedPlacementAfterFrameChanges(sprite);
  }
  /** Opaque pixels block room input unless a higher-priority GUI widget occupies the pointer (see defer list). */
  sprite.setInteractive({
    hitArea: {},
    hitAreaCallback: makeBenneGuiImagePixelPerfectHitCallback(scene, 8, imageInputDeferBelow),
  });
  sprite.setData('benneGuiControl', true);
  const cid = c.id?.trim();
  if (cid) {
    controlsById.set(cid, sprite);
  }
  return sprite;
}

function collectGuiButtonIds(controls: readonly GuiControl[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const c of controls ?? []) {
    if (c.type === 'button') {
      const id = c.id.trim();
      if (id.length > 0) {
        ids.add(id);
      }
    }
  }
  return ids;
}

function inventoryPanelScrollConfigured(c: GuiInventoryPanelControl, buttonIds: Set<string>): boolean {
  if (c.scrollDirection !== 'horizontal' && c.scrollDirection !== 'vertical') {
    return false;
  }
  const back = c.backButton?.trim() ?? '';
  const fwd = c.forwardButton?.trim() ?? '';
  if (back.length === 0 || fwd.length === 0) {
    return false;
  }
  return buttonIds.has(back) && buttonIds.has(fwd);
}

function appendPreEmitForButtonId(map: Map<string, Array<() => void>>, buttonId: string, fn: () => void): void {
  const id = buttonId.trim();
  if (id.length === 0) {
    return;
  }
  const list = map.get(id);
  if (list) {
    list.push(fn);
  } else {
    map.set(id, [fn]);
  }
}

type GuiGridLayoutCache = {
  def: GuiGridControl;
  colOff: number[];
  rowOff: number[];
  colW: number[];
  rowH: number[];
};

type GridResolvedPlace = {
  parent: Phaser.GameObjects.Container;
  localX: number;
  localY: number;
  contentW: number;
  contentH: number;
  /** Top-left of this control’s origin in GUI content root space (same frame as authored overlay `x`/`y`). */
  rootTopLeft: { x: number; y: number };
};

function estimateInventoryPanelOuterSize(c: GuiInventoryPanelControl): { w: number; h: number } {
  const spacingX = c.spacingX ?? 0;
  const spacingY = c.spacingY ?? 0;
  const w = c.cols * c.slotWidth + Math.max(0, c.cols - 1) * spacingX;
  const h = c.rows * c.slotHeight + Math.max(0, c.rows - 1) * spacingY;
  return { w, h };
}

function estimateImageSizeForGridAlign(scene: Phaser.Scene, gui: GuiData, c: GuiImageControl): { w: number; h: number } {
  const fw = c.width;
  const fh = c.height;
  if (fw != null && Number.isFinite(fw) && fw > 0 && fh != null && Number.isFinite(fh) && fh > 0) {
    return { w: Math.round(fw), h: Math.round(fh) };
  }
  if (!usesAsepriteDisplay(gui)) {
    return { w: 32, h: 32 };
  }
  const legacyDisplay = (c as GuiImageControl & { display?: { tag?: string } }).display;
  const tag = (c.tag ?? legacyDisplay?.tag)?.trim() ?? '';
  const key = getAsepriteTextureKey(gui.id);
  if (!tag || !scene.textures.exists(key)) {
    return { w: 32, h: 32 };
  }
  try {
    ensureAsepriteAtlasAnimationsRegisteredOnce(scene, key);
    const spr = scene.add.sprite(0, 0, key);
    spr.setVisible(false);
    if (tryApplyGuiSheetTag(scene, spr, key, tag, gui.id)) {
      const { w, h } = getAsepriteVisibleFrameSize(spr.frame);
      spr.destroy();
      return { w, h };
    }
    spr.destroy();
  } catch {
    /* fall through */
  }
  return { w: 32, h: 32 };
}

function estimateTextBlockSizeForGrid(
  scene: Phaser.Scene,
  c: GuiTextControl,
  initial: string,
): { w: number; h: number } {
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (!fontEntry || !scene.cache.bitmapFont.exists(c.font)) {
    return { w: 64, h: 16 };
  }
  const lineAlign = bitmapTextLineAlign(c.align);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
  const tmp = scene.add.bitmapText(0, 0, c.font, initial, renderSize, lineAlign);
  tmp.setVisible(false);
  const o = originFromAlign(c.align);
  tmp.setOrigin(o.x, o.y);
  if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
    const maxW = evenWordWrapWidth(c.wordWrapWidth);
    if (maxW > 0) {
      tmp.setMaxWidth(maxW);
    }
  }
  const b = tmp.getBounds();
  tmp.destroy();
  const pad = guiTextOutlineMaxAbsOffsetForBounds(c.textOutline);
  return {
    w: Math.max(1, Math.round(b.width) + 2 * pad),
    h: Math.max(1, Math.round(b.height) + 2 * pad),
  };
}

function tryResolveGridPlacement(
  gui: GuiData,
  placement: GuiGridPlacement | undefined,
  gridsById: Map<string, Phaser.GameObjects.Container>,
  gridLayoutById: Map<string, GuiGridLayoutCache>,
  contentW: number,
  contentH: number,
  isFixed: boolean,
): GridResolvedPlace | null {
  if (isFixed || !isGuiGridPlacement(placement)) {
    return null;
  }
  const gid = placement.gridControlId.trim();
  const gridGo = gridsById.get(gid);
  const lay = gridLayoutById.get(gid);
  if (!gridGo || !lay) {
    console.warn(`[Benne] GUI "${gui.id}": gridPlacement references unknown grid "${gid}" — using x/y.`);
    return null;
  }
  const cell = spanCellRect(
    lay.colOff,
    lay.rowOff,
    lay.colW,
    lay.rowH,
    Math.max(0, Math.floor(placement.col)),
    Math.max(0, Math.floor(placement.row)),
    placement.colspan ?? 1,
    placement.rowspan ?? 1,
  );
  if (!cell) {
    console.warn(
      `[Benne] GUI "${gui.id}": gridPlacement for grid "${gid}" has out-of-range row/col/span — using x/y.`,
    );
    return null;
  }
  const bw = Math.max(1, contentW);
  const bh = Math.max(1, contentH);
  const { hx, vy } = parseGuiGridCellAlign(placement.align);
  const { dx, dy } = alignBoxTopLeftInCell(hx, vy, cell.w, cell.h, bw, bh);
  const localX = Math.round(cell.x + dx);
  const localY = Math.round(cell.y + dy);
  const gx = Math.round(lay.def.x);
  const gy = Math.round(lay.def.y);
  return {
    parent: gridGo,
    localX,
    localY,
    contentW: bw,
    contentH: bh,
    rootTopLeft: { x: gx + localX, y: gy + localY },
  };
}

function addInventorySlotSheetSprite(
  scene: Phaser.Scene,
  guiTextureKey: string,
  guiId: string,
  tagRaw: string | undefined,
  anchorRaw: GuiSpriteAnchor | undefined,
  slotCx: number,
  slotCy: number,
  slotContainer: Phaser.GameObjects.Container,
  offX = 0,
  offY = 0,
): void {
  const tag = tagRaw?.trim() ?? '';
  if (!tag || !scene.textures.exists(guiTextureKey)) {
    return;
  }
  const anchor = guiSpriteAnchorOrDefault(anchorRaw);
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag, guiId)) {
    sprite.destroy();
    return;
  }
  sprite.setVisible(true);
  if (import.meta.env.DEV) {
    warnDevIfAsepriteJsonMissingSpriteSourceSize(sprite.frame, `GUI "${guiId}" inventory slot sheet`);
  }
  const inset = getAsepriteSpriteSourceInset(sprite.frame);
  /** Inside a slot container, `screen` is treated like top-left at the slot origin (full-slot art). */
  if (anchor === 'center') {
    const p = resolveAuthoredPositionForAsepriteTrim('center', slotCx, slotCy, sprite.frame);
    applyGuiSpriteAnchor(sprite, anchor, p.x, p.y, offX, offY);
  } else {
    applyGuiSpriteAnchor(sprite, 'top-left', -inset.x, -inset.y, offX, offY);
  }
  slotContainer.add(sprite);
}

/**
 * Rebuilds all children of `panel` (backdrop + slot rows) for the current inventory slice starting at
 * `scrollState.offset` (row-major: slot `(r,c)` shows item index `offset + r * cols + c`).
 */
function fillInventoryPanelContent(
  panel: Phaser.GameObjects.Container,
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiInventoryPanelControl,
  scrollState: { offset: number },
  startVisible: boolean,
  invPointerCtx: InventoryPanelPointerContext | undefined,
  /**
   * Top-left of the panel’s origin `(0,0)` in **GUI content root** space — used for `backgroundAnchor: 'screen'`
   * so the backdrop can offset to canvas `(0,0)`. When omitted, uses the control’s authored `x`/`y`.
   */
  panelAnchorInRoot?: { x: number; y: number },
): void {
  panel.removeAll(true);

  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const anchorRootX = Math.round(panelAnchorInRoot?.x ?? px);
  const anchorRootY = Math.round(panelAnchorInRoot?.y ?? py);

  const panelVisible = startVisible && c.visible !== false;
  panel.setVisible(panelVisible);

  const spacingX = c.spacingX ?? 0;
  const spacingY = c.spacingY ?? 0;
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const wantsGuiSheet = usesAsepriteDisplay(gui) && scene.textures.exists(guiTextureKey);

  const panelW = c.cols * c.slotWidth + Math.max(0, c.cols - 1) * spacingX;
  const panelH = c.rows * c.slotHeight + Math.max(0, c.rows - 1) * spacingY;

  let inventoryItems: ReadonlyArray<{ id: string; quantity: number }> = [];
  let gameState: GameStateManager | undefined;
  try {
    gameState = resolveGameStateManager(scene.game);
    inventoryItems = gameState.getInventoryItems();
  } catch {
    /* e.g. GUI preview without GameStateManager on game.registry */
  }

  const capacity = Math.max(0, c.rows * c.cols);
  const n = inventoryItems.length;
  const baseMaxOffset = Math.max(0, n - capacity);
  /**
   * With `showEmptySlots`, allow scrolling until the **first slot** can show the first index of the
   * last row of items in row-major order (`floor((n-1)/cols)*cols`). That yields trailing empty slots
   * when the last row is short (e.g. 9 items, 6 cols → offset up to 6 shows three items + three empties).
   * For `rows === 1`, `n - cols` equals `n - capacity`, so the old `n - cols` extension never helped;
   * this formula covers single-row and multi-row grids.
   */
  let maxOffset = baseMaxOffset;
  if (c.showEmptySlots && capacity > 0 && n > 0 && c.cols > 0) {
    const lastRowFirstIndex = Math.floor((n - 1) / c.cols) * c.cols;
    maxOffset = Math.max(maxOffset, lastRowFirstIndex);
  }
  scrollState.offset = Math.max(0, Math.min(maxOffset, scrollState.offset));

  const bgTag = c.backgroundTag?.trim() ?? '';
  const panelBgOffX = c.backgroundOffsetX ?? 0;
  const panelBgOffY = c.backgroundOffsetY ?? 0;
  const slotBgOffX = c.slotBackgroundOffsetX ?? 0;
  const slotBgOffY = c.slotBackgroundOffsetY ?? 0;
  const hiOffX = c.highlightOffsetX ?? 0;
  const hiOffY = c.highlightOffsetY ?? 0;
  if (bgTag && wantsGuiSheet) {
    const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
    const backdrop = scene.add.sprite(0, 0, guiTextureKey);
    backdrop.setVisible(false);
    backdrop.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, backdrop, guiTextureKey, bgTag, gui.id)) {
      backdrop.destroy();
    } else {
      backdrop.setVisible(true);
      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(backdrop.frame, `GUI "${gui.id}" inventoryPanel backdrop`);
      }
      const bgInset = getAsepriteSpriteSourceInset(backdrop.frame);
      if (bgAnchor === 'screen') {
        /** World (0,0) while staying parented so `panel.setVisible` still toggles the backdrop. */
        backdrop.setOrigin(0, 0);
        backdrop.setPosition(
          Math.round(-anchorRootX + panelBgOffX),
          Math.round(-anchorRootY + panelBgOffY),
        );
      } else if (bgAnchor === 'center') {
        const p = resolveAuthoredPositionForAsepriteTrim('center', panelW / 2, panelH / 2, backdrop.frame);
        applyGuiSpriteAnchor(backdrop, bgAnchor, p.x, p.y, panelBgOffX, panelBgOffY);
      } else {
        applyGuiSpriteAnchor(backdrop, 'top-left', -bgInset.x, -bgInset.y, panelBgOffX, panelBgOffY);
      }
      panel.add(backdrop);
    }
  }

  const showGuiSlotOutlines = getGameSettings().debug?.showGuiOutlines === true;
  const slotCx = c.slotWidth / 2;
  const slotCy = c.slotHeight / 2;

  for (let row = 0; row < c.rows; row += 1) {
    for (let col = 0; col < c.cols; col += 1) {
      const invIndex = scrollState.offset + row * c.cols + col;
      if (invIndex >= inventoryItems.length && !c.showEmptySlots) {
        continue;
      }

      const slotX = col * (c.slotWidth + spacingX);
      const slotY = row * (c.slotHeight + spacingY);
      const slotContainer = scene.add.container(slotX, slotY);

      if (wantsGuiSheet) {
        addInventorySlotSheetSprite(
          scene,
          guiTextureKey,
          gui.id,
          c.slotBackgroundTag,
          c.slotBackgroundAnchor,
          slotCx,
          slotCy,
          slotContainer,
          slotBgOffX,
          slotBgOffY,
        );
      }

      if (showGuiSlotOutlines) {
        const slotOutline = scene.add.graphics();
        slotOutline.lineStyle(1, DEBUG_GUI_INVENTORY_SLOT_STROKE, 1);
        slotOutline.strokeRect(0.5, 0.5, c.slotWidth - 1, c.slotHeight - 1);
        slotContainer.add(slotOutline);
      }

      if (invIndex < inventoryItems.length) {
        const entry = inventoryItems[invIndex]!;
        const defRaw = getInventoryDefinition(entry.id);
        const def = defRaw as InventoryItemData | undefined;
        const iconTag =
          def && gameState
            ? readEffectiveInventoryDefaultAnimationTag(gameState, def)
            : def?.defaultAnimation?.trim() || entry.id;

        let iconAdded = false;
        if (usesAsepriteDisplay(gui) && iconTag) {
          const guiKey = getAsepriteTextureKey(gui.id);
          if (scene.textures.exists(guiKey)) {
            const iconSprite = scene.add.sprite(slotCx, slotCy, guiKey).setScale(c.itemScale ?? 1).setOrigin(0.5, 0.5);
            iconSprite.setVisible(false);
            if (tryApplyGuiSheetTag(scene, iconSprite, guiKey, iconTag, gui.id)) {
              if (import.meta.env.DEV) {
                warnDevIfAsepriteJsonMissingSpriteSourceSize(
                  iconSprite.frame,
                  `GUI "${gui.id}" inventoryPanel icon (GUI sheet)`,
                );
              }
              const p = resolveAuthoredPositionForAsepriteTrim('center', slotCx, slotCy, iconSprite.frame);
              iconSprite.setPosition(p.x, p.y);
              iconSprite.setVisible(true);
              slotContainer.add(iconSprite);
              iconAdded = true;
            } else {
              iconSprite.destroy();
            }
          }
        }

        if (
          !iconAdded &&
          def &&
          (usesSharedInventoryAseprite(def) || usesPerItemInventoryAseprite(def))
        ) {
          const texKey = usesSharedInventoryAseprite(def)
            ? sharedInventoryTextureKey
            : getPerItemInventoryTextureKey(entry.id);
          const animKey = inventoryPhaserAnimationKeyForTag(def, iconTag);
          if (scene.textures.exists(texKey)) {
            ensureAsepriteAtlasAnimationsRegisteredOnce(scene, texKey);
            const playKey = scene.anims.exists(animKey) ? animKey : null;
            if (playKey) {
              const iconSprite = scene
                .add.sprite(slotCx, slotCy, texKey)
                .setScale(c.itemScale ?? 1)
                .setOrigin(0.5, 0.5);
              iconSprite.play(playKey);
              if (import.meta.env.DEV) {
                warnDevIfAsepriteJsonMissingSpriteSourceSize(
                  iconSprite.frame,
                  `GUI "${gui.id}" inventoryPanel icon (inventory sheet)`,
                );
              }
              const p = resolveAuthoredPositionForAsepriteTrim('center', slotCx, slotCy, iconSprite.frame);
              iconSprite.setPosition(p.x, p.y);
              slotContainer.add(iconSprite);
              iconAdded = true;
            }
          }
        }

        if (!iconAdded) {
          const label = scene.add
            .text(slotCx, slotCy, entry.id.slice(0, 6), {
              fontSize: '10px',
              color: '#e0e0e0',
            })
            .setOrigin(0.5, 0.5);
          slotContainer.add(label);
        }
      }

      if (wantsGuiSheet) {
        addInventorySlotSheetSprite(
          scene,
          guiTextureKey,
          gui.id,
          c.highlightTag,
          c.highlightAnchor,
          slotCx,
          slotCy,
          slotContainer,
          hiOffX,
          hiOffY,
        );
      }

      if (invPointerCtx && invIndex < inventoryItems.length) {
        const itemId = inventoryItems[invIndex]!.id;
        const hit = new Phaser.Geom.Rectangle(0, 0, c.slotWidth, c.slotHeight);
        slotContainer.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
        if (slotContainer.input) {
          const showOsHand = !isBenneGameCursorAsepriteEnabled(getGameSettings());
          slotContainer.input.cursor = showOsHand ? 'pointer' : false;
        }
        slotContainer.setData('benneInventorySlot', true);
        slotContainer.setData('benneInventoryItemId', itemId);
        slotContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (invPointerCtx.tryConsumeDialogClickToSkip(pointer)) {
            return;
          }
          if (invPointerCtx.isInputSuppressed()) {
            return;
          }
          const profile = getEffectiveInputProfile(getGameSettings());
          const manager = resolveGameStateManager(scene.game);
          const invDef = getInventoryDefinition(itemId) as InventoryItemData | undefined;
          const resolution = resolvePointerVerbForInventoryItem(
            pointer,
            profile,
            { defaultVerb: invDef?.defaultVerb },
            manager.getActiveVerb(),
            manager.getActiveInventoryItemId(),
          );
          if (resolution.kind === 'none') {
            return;
          }
          if (resolution.kind === 'clearActive') {
            manager.clearActiveInventoryItem();
            manager.clearActiveVerb();
            return;
          }
          if (resolution.kind === 'walkToTarget') {
            return;
          }
          if (resolution.kind === 'verb') {
            if (shouldDispatchInventoryUsedOnVerbForGame(manager, resolution.verbId, resolution)) {
              const sourceItemId = manager.getActiveInventoryItemId();
              if (sourceItemId) {
                const shouldDrop = shouldDropActiveInventoryOnUse(sourceItemId);
                console.log(
                  `[Benne] inventory-on "${resolution.verbId}" item ${sourceItemId} → inventory row ${itemId}`,
                );
                const handled = dispatchInventoryOnInventoryItemInteraction(
                  gameEvents,
                  sourceItemId,
                  resolution.verbId,
                  itemId,
                  invPointerCtx.roomId,
                  invDef?.description,
                );
                if (!handled && shouldDrop) {
                  manager.clearActiveInventoryItem();
                  manager.clearActiveVerb();
                }
                return;
              }
            }
          }
          dispatchInventoryVerbInteraction(
            gameEvents,
            resolution.verbId,
            itemId,
            invPointerCtx.roomId,
          );
          trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch(
            manager,
            getGameSettings(),
            resolution.verbId,
            itemId,
          );
          if (resolution.consumeActive) {
            const clickedItemId = itemId;
            queueMicrotask(() => {
              if (manager.getActiveInventoryItemId() === clickedItemId) {
                return;
              }
              manager.clearActiveVerb();
            });
          }
        });
      }

      panel.add(slotContainer);
    }
  }
}

/** When set (in {@link RoomScene}), occupied inventory slots dispatch verbs like room props. Omitted in editor previews. */
export interface InventoryPanelPointerContext {
  roomId: string;
  isInputSuppressed: () => boolean;
  tryConsumeDialogClickToSkip: (pointer: Phaser.Input.Pointer) => boolean;
}

export interface BuildGuiOverlayOptions {
  depth?: number;
  /** When true, text starts visible (e.g. VS Code GUI preview). Default false for in-game overlays. */
  startVisible?: boolean;
  /** Shown when a control's `text` is missing or whitespace-only; omit to use empty string. */
  emptyTextPlaceholder?: string;
  /** Enables interactive inventory slots that emit inventory verb events (requires `roomId`). */
  inventoryPanelPointerContext?: InventoryPanelPointerContext;
  /**
   * When provided and returns **`true`**, GUI button `pointerup` clicks are swallowed.
   * Used by {@link RoomScene} to block buttons during cutscene mode. Inventory slots are gated
   * separately via {@link InventoryPanelPointerContext.isInputSuppressed}.
   */
  isButtonClickSuppressed?: () => boolean;
  /**
   * Raw / disk-shaped GUI sheet JSON (`meta.slices`, frame tags). VS Code GUI preview and room
   * preview inject this when `import.meta.glob` cannot supply {@link getBundledGuiAsepriteRawJson}.
   */
  previewGuiAsepriteSheetJson?: Record<string, unknown>;
}

/**
 * Builds screen-space GUI controls from `gui.controls` (`text`, `inventoryPanel`, `image`, `nineSliceImage`, `button`, `trigger`, `grid`).
 * Starts hidden unless `startVisible`. Font ids resolve via `fonts/fonts.json` (`load.bitmapFont` keys).
 */
/**
 * Builds {@link GuiOverlayHandle.setDisplayTextLayout} for the reserved **`display-text`** overlay.
 */
function wireDisplayTextOverlayLayout(
  gui: GuiData,
  controlsById: Map<string, Phaser.GameObjects.GameObject>,
  linesById: Map<string, Phaser.GameObjects.BitmapText>,
): ((text: string) => void) | null {
  if (gui.id !== 'display-text') {
    return null;
  }
  const controls = gui.controls ?? [];
  const nineCtl = controls.find(
    (cc): cc is GuiNineSliceImageControl =>
      cc.type === 'nineSliceImage' && typeof cc.id === 'string' && cc.id === 'displayTextBg',
  );
  const textCtl = controls.find(
    (cc): cc is GuiTextControl =>
      cc.type === 'text' && typeof cc.id === 'string' && cc.id === 'text',
  );
  const bgRt = controlsById.get('displayTextBg');
  const textLine = linesById.get('text');
  if (!nineCtl || !textCtl || !bgRt || !textLine) {
    return null;
  }
  if (!(bgRt instanceof Phaser.GameObjects.NineSlice)) {
    return null;
  }

  const authoredBgW = Math.round(nineCtl.width);
  const wrapInner =
    textCtl.wordWrapWidth != null && textCtl.wordWrapWidth > 0
      ? evenWordWrapWidth(textCtl.wordWrapWidth)
      : 0;

  /**
   * Measure padding once after {@link buildGuiOverlay} parents controls under `guiContentRoot`. Using JSON `y`
   * plus `getBounds().height` mixes anchor space with AABB space (BitmapText tops rarely equal `.y`), and using
   * the placeholder's height for bottom chrome while sizing with live `b.height` biases short strings downward.
   */
  const refTextBounds = textLine.getBounds();
  const refBgBounds = bgRt.getBounds();
  const authoredPadTop = Math.max(0, Math.round(refTextBounds.top - refBgBounds.top));
  // Use symmetric chrome: the space from the text top to the panel top defines the chrome on
  // every side. Deriving bottom padding from the placeholder's bottom is unreliable — if the
  // placeholder is short it inflates the gap, and if it overflows the panel it collapses to 0.
  const authoredPadBottom = authoredPadTop;

  return (text: string): void => {
    syncOutlinedGuiBitmapTextAll(textLine, text);
    const b = textLine.getBounds();
    const padX = Math.max(0, authoredBgW - wrapInner);
    const newBgW = Math.max(32, Math.ceil(b.width + padX));
    const newBgH = Math.max(32, Math.ceil(authoredPadTop + b.height + authoredPadBottom));

    tryResizeGuiNineSlicePanel(bgRt, newBgW, newBgH);

    const bgAfter = bgRt.getBounds();
    const textAfter = textLine.getBounds();
    const padTopNow = textAfter.top - bgAfter.top;
    textLine.setY(textLine.y + Math.round(authoredPadTop - padTopNow));
    syncOutlinedGuiBitmapTextPositions(textLine);
  };
}

export function buildGuiOverlay(
  scene: Phaser.Scene,
  gui: GuiData,
  options?: BuildGuiOverlayOptions,
): BuiltGuiOverlay | null {
  const depth = options?.depth ?? GUI_TEXT_OVERLAY_DEPTH;
  const startVisible = options?.startVisible ?? false;
  const placeholder = options?.emptyTextPlaceholder;
  const invPointerCtx = options?.inventoryPanelPointerContext;
  const isButtonClickSuppressed = options?.isButtonClickSuppressed;
  const previewGuiAsepriteSheetJson = options?.previewGuiAsepriteSheetJson;
  const allLines: Phaser.GameObjects.BitmapText[] = [];
  const inventoryPanels: Phaser.GameObjects.Container[] = [];
  const guiButtons: BuiltGuiButton[] = [];
  const triggerZones: Phaser.GameObjects.Rectangle[] = [];
  const linesById = new Map<string, Phaser.GameObjects.BitmapText>();
  const controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  const extraSprites: Phaser.GameObjects.GameObject[] = [];
  const overlayDisposers: Array<() => void> = [];
  const runtimeExtraGameObjects: Phaser.GameObjects.GameObject[] = [];
  let disposeGuiRuntime: (() => void) | null = null;

  type DepthGameObject = Phaser.GameObjects.GameObject & {
    depth: number;
    setDepth(value: number): Phaser.GameObjects.GameObject;
  };
  const fixedControlIds = new Set(
    (gui.fixedControls ?? [])
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0),
  );
  const isGuiFixedControlId = (raw: string | undefined): boolean => {
    const id = raw?.trim() ?? '';
    return id.length > 0 && fixedControlIds.has(id);
  };
  const movablePackedParts: DepthGameObject[] = [];
  const fixedPackedGameObjects: Phaser.GameObjects.GameObject[] = [];
  /** Populated during the control loop so {@link addGuiImageSprite} can defer hits to widgets drawn above the sheet. */
  const guiImageInputDeferBelow: Phaser.GameObjects.GameObject[] = [];

  if (usesAsepriteDisplay(gui)) {
    const guiKey = getAsepriteTextureKey(gui.id);
    if (scene.textures.exists(guiKey)) {
      ensureAsepriteAtlasAnimationsRegisteredOnce(scene, guiKey);
    }
  }

  const controls = gui.controls ?? [];
  const buttonIds = collectGuiButtonIds(controls);
  type InvScrollState = { offset: number; refresh: () => void };
  const invScrollStateByControlIndex = new Map<number, InvScrollState>();
  const buttonPreEmitById = new Map<string, Array<() => void>>();

  const gridsById = new Map<string, Phaser.GameObjects.Container>();
  const gridLayoutById = new Map<string, GuiGridLayoutCache>();
  const gridContainers: Phaser.GameObjects.Container[] = [];

  for (let gi = 0; gi < controls.length; gi += 1) {
    const gc = controls[gi]!;
    if (gc.type !== 'grid') {
      continue;
    }
    const gidc = gc.id.trim();
    if (!gidc) {
      console.warn(`[Benne] GUI "${gui.id}": grid control at index ${gi} is missing id — skipping.`);
      continue;
    }
    if (gridsById.has(gidc)) {
      console.warn(`[Benne] GUI "${gui.id}": duplicate grid id "${gidc}" — skipping duplicate.`);
      continue;
    }
    const gpx = Math.round(gc.x);
    const gpy = Math.round(gc.y);
    const gridCont = scene.add.container(gpx, gpy);
    gridCont.setScrollFactor(0, 0);
    gridCont.setDepth(depth + (gc.zIndex ?? 0));
    gridCont.setVisible(startVisible && gc.visible !== false);
    const track = layoutGuiGridTracks(gc);
    const colOff = cumulativeOffsets(track.colWidths);
    const rowOff = cumulativeOffsets(track.rowHeights);
    gridLayoutById.set(gidc, {
      def: gc,
      colOff,
      rowOff,
      colW: track.colWidths,
      rowH: track.rowHeights,
    });
    if (getGameSettings().debug?.showGuiOutlines === true) {
      const gdraw = scene.add.graphics();
      gdraw.lineStyle(1, DEBUG_GUI_GRID_CELL_STROKE, 0.9);
      for (let rr = 0; rr < gc.rows; rr += 1) {
        for (let cc = 0; cc < gc.columns; cc += 1) {
          const cell = spanCellRect(colOff, rowOff, track.colWidths, track.rowHeights, cc, rr, 1, 1);
          if (cell && cell.w > 1 && cell.h > 1) {
            gdraw.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
          }
        }
      }
      gridCont.add(gdraw);
    }
    gridsById.set(gidc, gridCont);
    gridContainers.push(gridCont);
    controlsById.set(gidc, gridCont);
    ;(isGuiFixedControlId(gc.id) ? fixedPackedGameObjects : movablePackedParts).push(gridCont as DepthGameObject);
  }

  for (let i = 0; i < controls.length; i += 1) {
    const c = controls[i]!;
    if (c.type !== 'inventoryPanel' || !inventoryPanelScrollConfigured(c, buttonIds)) {
      continue;
    }
    const st: InvScrollState = { offset: 0, refresh: () => {} };
    invScrollStateByControlIndex.set(i, st);
    const step = c.scrollDirection === 'horizontal' ? 1 : c.cols;
    appendPreEmitForButtonId(buttonPreEmitById, c.forwardButton!, () => {
      st.offset += step;
      st.refresh();
    });
    appendPreEmitForButtonId(buttonPreEmitById, c.backButton!, () => {
      st.offset -= step;
      st.refresh();
    });
  }

  for (let i = 0; i < controls.length; i += 1) {
    const c = controls[i]!;
    if (c.type === 'grid') {
      continue;
    }
    if (c.type === 'inventoryPanel') {
      const px = Math.round(c.x);
      const py = Math.round(c.y);
      const invOuter = estimateInventoryPanelOuterSize(c);
      const invPlace = tryResolveGridPlacement(
        gui,
        c.gridPlacement,
        gridsById,
        gridLayoutById,
        invOuter.w,
        invOuter.h,
        isGuiFixedControlId(c.id),
      );
      const panelAnchorInRoot = invPlace ? invPlace.rootTopLeft : { x: px, y: py };
      const panel = scene.add.container(0, 0);
      panel.setScrollFactor(0, 0);
      panel.setDepth(depth + (c.zIndex ?? 0));
      if (invPlace) {
        invPlace.parent.add(panel);
        panel.setPosition(invPlace.localX, invPlace.localY);
      } else {
        panel.setPosition(px, py);
      }
      const scrollSt = invScrollStateByControlIndex.get(i);
      const offsetState = scrollSt ?? { offset: 0 };
      const refreshInventoryPanel = (): void => {
        fillInventoryPanelContent(
          panel,
          scene,
          gui,
          c,
          offsetState,
          startVisible,
          invPointerCtx,
          panelAnchorInRoot,
        );
      };
      if (scrollSt) {
        scrollSt.refresh = refreshInventoryPanel;
      }
      const onGameStateInventory = (): void => {
        refreshInventoryPanel();
      };
      const onInventoryAnimationVariable = (payload: unknown): void => {
        const p = payload as GameStateVariableChangedPayload;
        if (typeof p.key === 'string' && isPersistedInventoryAnimationVariableKey(p.key)) {
          refreshInventoryPanel();
        }
      };
      gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
      gameEvents.on(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
      gameEvents.on(GAME_STATE_VARIABLE_CHANGED_EVENT, onInventoryAnimationVariable);
      overlayDisposers.push(() => {
        gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
        gameEvents.off(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
        gameEvents.off(GAME_STATE_VARIABLE_CHANGED_EVENT, onInventoryAnimationVariable);
      });
      refreshInventoryPanel();
      inventoryPanels.push(panel);
      const pid = c.id?.trim();
      if (pid) {
        controlsById.set(pid, panel);
      }
      guiImageInputDeferBelow.push(panel);
      if (!invPlace) {
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(panel as DepthGameObject);
      }
      continue;
    }

    if (c.type === 'nineSliceImage') {
      const ns = c as GuiNineSliceImageControl;
      const imgSz = estimateNineSliceSizeForGridAlign(ns);
      const imgPlace = tryResolveGridPlacement(
        gui,
        ns.gridPlacement,
        gridsById,
        gridLayoutById,
        imgSz.w,
        imgSz.h,
        isGuiFixedControlId(ns.id),
      );
      const { hx, vy } = parseGuiGridCellAlign(ns.gridPlacement?.align);
      const gridCenterAlign = hx === 0.5 && vy === 0.5;
      const panel = addGuiNineSliceImage(
        scene,
        gui,
        ns,
        depth,
        startVisible,
        extraSprites,
        controlsById,
        guiImageInputDeferBelow,
        overlayDisposers,
        imgPlace
          ? {
              x: imgPlace.localX,
              y: imgPlace.localY,
              parent: imgPlace.parent,
              screenRootTopLeft: imgPlace.rootTopLeft,
              gridContentBox: { w: imgSz.w, h: imgSz.h },
              gridCenterAlign,
            }
          : undefined,
        previewGuiAsepriteSheetJson,
      );
      if (panel) {
        if (!imgPlace) {
          ;(isGuiFixedControlId(ns.id) ? fixedPackedGameObjects : movablePackedParts).push(panel as DepthGameObject);
        }
      }
      continue;
    }

    if (c.type === 'image') {
      const imgSz = estimateImageSizeForGridAlign(scene, gui, c);
      const imgPlace = tryResolveGridPlacement(
        gui,
        c.gridPlacement,
        gridsById,
        gridLayoutById,
        imgSz.w,
        imgSz.h,
        isGuiFixedControlId(c.id),
      );
      const { hx, vy } = parseGuiGridCellAlign(c.gridPlacement?.align);
      const gridCenterAlign = hx === 0.5 && vy === 0.5;
      const spr = addGuiImageSprite(
        scene,
        gui,
        c,
        depth,
        startVisible,
        extraSprites,
        controlsById,
        guiImageInputDeferBelow,
        imgPlace
          ? {
              x: imgPlace.localX,
              y: imgPlace.localY,
              parent: imgPlace.parent,
              screenRootTopLeft: imgPlace.rootTopLeft,
              gridContentBox: { w: imgSz.w, h: imgSz.h },
              gridCenterAlign,
            }
          : undefined,
      );
      if (spr) {
        if (!imgPlace) {
          ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(spr as DepthGameObject);
        }
      }
      continue;
    }

    if (c.type === 'button') {
      const chain = buttonPreEmitById.get(c.id);
      const preEmit =
        chain && chain.length > 0
          ? (): void => {
              for (const fn of chain) {
                fn();
              }
            }
          : undefined;
      const btnPlace = tryResolveGridPlacement(
        gui,
        c.gridPlacement,
        gridsById,
        gridLayoutById,
        c.width,
        c.height,
        isGuiFixedControlId(c.id),
      );
      const btnModel: GuiButtonControl = btnPlace ? { ...c, x: btnPlace.localX, y: btnPlace.localY } : c;
      const built = buildGuiButton(
        scene,
        gui,
        btnModel,
        depth,
        startVisible,
        preEmit,
        btnPlace ? btnPlace.rootTopLeft : undefined,
        isButtonClickSuppressed,
      );
      if (built) {
        if (btnPlace) {
          btnPlace.parent.add(built.hitTarget);
        }
        guiImageInputDeferBelow.push(built.hitTarget);
        guiButtons.push(built);
        controlsById.set(c.id.trim(), built.hitTarget);
        if (!btnPlace) {
          const bucket = isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts;
          bucket.push(built.hitTarget as DepthGameObject);
        }
      }
      continue;
    }

    if (c.type === 'trigger') {
      const trPlace = tryResolveGridPlacement(
        gui,
        c.gridPlacement,
        gridsById,
        gridLayoutById,
        c.width,
        c.height,
        isGuiFixedControlId(c.id),
      );
      const trModel: GuiTriggerControl = trPlace ? { ...c, x: trPlace.localX, y: trPlace.localY } : c;
      const zone = buildGuiTriggerZone(
        scene,
        trModel,
        depth,
        startVisible,
        trPlace ? trPlace.parent : undefined,
      );
      if (zone) {
        triggerZones.push(zone);
        controlsById.set(c.id.trim(), zone);
        overlayDisposers.push(
          installGuiControlPointerHoverObserver(scene, gui, c.id, zone, {
            active: c.active !== false,
          }),
        );
        if (!trPlace) {
          ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(zone as DepthGameObject);
        }
      }
      continue;
    }

    if (c.type !== 'text') {
      continue;
    }
    const raw = c.text?.trim() ?? '';
    const initial = raw.length > 0 ? (c.text ?? '') : (placeholder ?? '');
    const lineVisible = startVisible && c.visible !== false;
    const txEst = estimateTextBlockSizeForGrid(scene, c, initial);
    const txPlace = tryResolveGridPlacement(
      gui,
      c.gridPlacement,
      gridsById,
      gridLayoutById,
      txEst.w,
      txEst.h,
      isGuiFixedControlId(c.id),
    );
    const textModel: GuiTextControl = txPlace ? { ...c, x: txPlace.localX, y: txPlace.localY } : c;
    const stack = addGuiBitmapLine(scene, textModel, initial, depth + (c.zIndex ?? 0), lineVisible);
    if (!stack) {
      continue;
    }
    const { main: line, outlines } = stack;
    if (txPlace) {
      for (const o of outlines) {
        txPlace.parent.add(o);
      }
      txPlace.parent.add(line);
    }
    allLines.push(...outlines, line);
    if (c.id) {
      linesById.set(c.id, line);
      controlsById.set(c.id, line);
      if (!txPlace) {
        for (const o of outlines) {
          ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(o as DepthGameObject);
        }
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(line as DepthGameObject);
      }
    } else if (!txPlace) {
      for (const o of outlines) {
        movablePackedParts.push(o as DepthGameObject);
      }
      movablePackedParts.push(line as DepthGameObject);
    }
  }

  if (
    allLines.length === 0 &&
    inventoryPanels.length === 0 &&
    extraSprites.length === 0 &&
    guiButtons.length === 0 &&
    triggerZones.length === 0 &&
    gridContainers.length === 0
  ) {
    return null;
  }

  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  const guiContentRoot = scene.add.container(rootX, rootY);
  guiContentRoot.setScrollFactor(0, 0);
  guiContentRoot.setDepth(depth);
  const indexed = movablePackedParts.map((go, index) => ({ go, index, depth: go.depth }));
  indexed.sort((a, b) => {
    const d = a.depth - b.depth;
    return d !== 0 ? d : a.index - b.index;
  });
  const minDepth = indexed.length > 0 ? indexed[0]!.depth : depth;
  for (const row of indexed) {
    guiContentRoot.add(row.go);
    row.go.setDepth(row.depth - minDepth);
  }

  const triggerZoneSet = new Set<Phaser.GameObjects.GameObject>(triggerZones);
  const guiButtonHitTargets = new Set<Phaser.GameObjects.GameObject>(
    guiButtons.map((b) => b.hitTarget as Phaser.GameObjects.GameObject),
  );

  /**
   * Pointer hover fan-out for every control with an **`id`**.
   *
   * - **Buttons** need `setInteractive` for real click handling and hover-tag swapping, so they stay interactive
   *   and we subscribe to Phaser's native `pointerover` / `pointerout` via {@link wireGuiControlHoverEvents}.
   * - **`image`** sprites use pixel-perfect `setInteractive` (see {@link makeBenneGuiImagePixelPerfectHitCallback})
   *   so non-transparent texels consume clicks while transparent regions reach the room; hits are suppressed
   *   when the pointer is over the same overlay’s `inventoryPanel` or `button` hit targets so draw-order
   *   occlusion does not steal their input. Hover still uses {@link installGuiControlPointerHoverObserver}.
   * - **Triggers and the remaining types** (`inventoryPanel`, `text`) stay **non-interactive** for hits and
   *   use pointer observers for `whenMouseEnter` / `whenMouseLeave` so the inventory bar and text lines do
   *   not steal clicks from props / hotspots (`input.topOnly` would otherwise deliver to the GUI first).
   */
  for (const [id, target] of controlsById.entries()) {
    if (triggerZoneSet.has(target)) {
      /** Already wired in the trigger branch above. */
      continue;
    }
    if (guiButtonHitTargets.has(target)) {
      overlayDisposers.push(wireGuiControlHoverEvents(gui, id, target));
      continue;
    }
    overlayDisposers.push(
      installGuiControlPointerHoverObserver(scene, gui, id, target as GuiHoverObservableGameObject),
    );
  }

  /** Dialogue / `setPrimaryText` target — first `id: line` or first `text` control. */
  const primaryLine = linesById.get('line') ?? allLines[0];
  const primaryInitialX = primaryLine?.x ?? 0;
  const primaryInitialY = primaryLine?.y ?? 0;
  const primaryInitialOriginX = primaryLine?.originX ?? 0;
  const primaryInitialOriginY = primaryLine?.originY ?? 0;

  const runDisplayTextLayout =
    wireDisplayTextOverlayLayout(gui, controlsById, linesById) ?? ((_t: string) => {});

  const handle: GuiOverlayHandle = {
    setPrimaryText(text: string) {
      if (primaryLine) {
        syncOutlinedGuiBitmapTextAll(primaryLine, text);
      }
    },
    setPrimaryScreenPositionBottomCenter(x: number, y: number) {
      if (primaryLine) {
        clampPrimaryLineBottomCenterToScreen(
          primaryLine,
          x,
          y,
          getInternalWidth(),
          PRIMARY_LINE_SCREEN_EDGE_INSET,
        );
      }
    },
    resetPrimaryScreenPosition() {
      if (primaryLine) {
        primaryLine.setOrigin(primaryInitialOriginX, primaryInitialOriginY);
        primaryLine.setPosition(primaryInitialX, primaryInitialY);
        syncOutlinedGuiBitmapTextPositions(primaryLine);
      }
    },
    setControlText(id: string, text: string) {
      const ln = linesById.get(id);
      if (ln) {
        syncOutlinedGuiBitmapTextAll(ln, text);
      }
    },
    setDisplayTextLayout(text: string) {
      runDisplayTextLayout(text);
    },
    setVisible(visible: boolean) {
      for (const line of allLines) {
        line.setVisible(visible);
      }
      for (const panel of inventoryPanels) {
        panel.setVisible(visible);
      }
      for (const s of extraSprites) {
        (s as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(visible);
      }
      for (const b of guiButtons) {
        b.hitTarget.setVisible(visible);
        b.background?.setVisible(visible);
        b.label?.setVisible(visible);
        for (const lo of b.labelOutlines) {
          lo.setVisible(visible);
        }
        if (visible && b.enabled) {
          applyGuiButtonInteractivity(b.hitTarget, b.width, b.height, b.enabled);
        } else {
          b.hitTarget.disableInteractive();
        }
      }
      for (const z of triggerZones) {
        z.setVisible(visible);
      }
      for (const g of gridContainers) {
        g.setVisible(visible);
      }
    },
    setLetterSpacing(spacing: number) {
      for (const line of allLines) {
        line.setLetterSpacing(spacing);
      }
    },
    get gameObjects(): Phaser.GameObjects.GameObject[] {
      return [guiContentRoot, ...fixedPackedGameObjects, ...runtimeExtraGameObjects];
    },
    destroy() {
      disposeGuiRuntime?.();
      disposeGuiRuntime = null;
      runtimeExtraGameObjects.length = 0;
      for (const d of overlayDisposers) {
        d();
      }
      overlayDisposers.length = 0;
      guiContentRoot.destroy(true);
      for (const go of fixedPackedGameObjects) {
        go.destroy();
      }
      fixedPackedGameObjects.length = 0;
      allLines.length = 0;
      inventoryPanels.length = 0;
      extraSprites.length = 0;
      guiButtons.length = 0;
      triggerZones.length = 0;
      linesById.clear();
    },
  };

  const controlSnapshot = new Map(controlsById);

  return {
    handle,
    createGuiRuntime(queueInteraction: (factory: () => Promise<unknown>) => void): GuiRuntime {
      disposeGuiRuntime?.();
      disposeGuiRuntime = null;
      runtimeExtraGameObjects.length = 0;
      const runtime = new GuiRuntime({
        scene,
        guiId: gui.id,
        baseDepth: depth,
        contentRoot: guiContentRoot,
        controlGameObjectsById: controlSnapshot,
        queueInteraction,
      });
      disposeGuiRuntime = (): void => {
        runtime.dispose();
        runtimeExtraGameObjects.length = 0;
      };
      return runtime;
    },
  };
}
