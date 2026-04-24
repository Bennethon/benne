/**
 * Composes GUI `BitmapText` overlays. The shipped game uses the **Canvas** renderer (`gameConfig.ts`) so glyphs
 * respect `roundPixels`; Phaser’s **WebGL** `BitmapText` path does not round per character — avoid switching the
 * main game to WebGL without revisiting dialogue crispness.
 */
import * as Phaser from 'phaser';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';
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
  GuiButtonControl,
  GuiControl,
  GuiData,
  GuiImageControl,
  GuiInventoryPanelControl,
  GuiSpriteAnchor,
  GuiTextAlign,
  GuiTextControl,
  GuiTriggerControl,
  GuiVerbLineControl,
} from '../../types/gui';
import type { InventoryItemData } from '../../types/inventory';
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
} from '../../types/gameState.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';
import { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  dispatchInventoryOnInventoryItemInteraction,
  dispatchInventoryVerbInteraction,
  shouldDispatchInventoryUsedOnVerbForGame,
  shouldDropActiveInventoryOnUse,
  trySyncActiveInventoryAfterInventoryUseOrGiveRowDispatch,
} from '../verbs/dispatchInventoryVerb';
import { composeVerbLineText, getEffectiveInputProfile } from '../verbs/verbConfig';
import { resolvePointerVerbForInventoryItem } from '../verbs/resolvePointerVerb';

/** Slot stroke for `game-config.json` `debug.showGuiOutlines` (distinct from walkable / prop debug colors). */
const DEBUG_GUI_INVENTORY_SLOT_STROKE = 0x66ccff;

const manifest = gameFontsManifest as GameFontsManifest;

/** Renders above the room stack (`RoomScene` assigns sequential depths from `ROOM_STACK_DEPTH_BASE`). */
export const GUI_TEXT_OVERLAY_DEPTH = 25_000;

/**
 * Base depth increment between stacked GUI overlays in the room (must match `RoomScene` stack math).
 * One stride must fit every authored `zIndex` / panel depth within a single overlay.
 */
export const GUI_OVERLAY_DEPTH_STRIDE = 10_000;

export interface GuiOverlayHandle {
  /** Updates the dialogue line control (`id: line`) if present, else the first text control. */
  setPrimaryText(text: string): void;
  /**
   * Places the **bottom-center** of the primary line (after word wrap) at `(x, y)` in game-canvas space,
   * then rounds. Restores authored origin/position via {@link resetPrimaryScreenPosition}.
   */
  setPrimaryScreenPositionBottomCenter(x: number, y: number): void;
  /** Restores the primary line to its authored GUI position and display origin. */
  resetPrimaryScreenPosition(): void;
  setControlText(id: string, text: string): void;
  setVisible(visible: boolean): void;
  /** Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing). */
  setLetterSpacing(spacing: number): void;
  /**
   * Recomputes every `verbLine` control from the active verb plus optional hover description
   * (see {@link BuildGuiOverlayOptions.verbLineHoverDescription}). No-op when this overlay has no verb lines.
   */
  refreshVerbLineText(): void;
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

const ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX = '__benneAsepriteAnims:';

/**
 * Registers Aseprite frame-tag clips on the scene animation manager (matches GUI / inventory preview boot).
 * Safe to call repeatedly; runs {@link Phaser.Animations.AnimationManager#createFromAseprite} at most once per
 * texture key per {@link Phaser.Game}.
 */
function ensureAsepriteAnimationsFromAtlas(scene: Phaser.Scene, textureKey: string): void {
  if (!scene.textures.exists(textureKey)) {
    return;
  }
  const flagKey = `${ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX}${textureKey}`;
  if (scene.game.registry.get(flagKey)) {
    return;
  }
  scene.anims.createFromAseprite(textureKey);
  scene.game.registry.set(flagKey, true);
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
): boolean {
  stopSpriteAnimationIfPlaying(sprite);
  return tryApplyGuiSheetTag(scene, sprite, textureKey, tag);
}

function tryApplyGuiSheetTag(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  tag: string,
): boolean {
  const t = tag.trim();
  if (!t || !scene.textures.exists(textureKey)) {
    return false;
  }
  ensureAsepriteAnimationsFromAtlas(scene, textureKey);
  if (scene.anims.exists(t)) {
    sprite.play(t);
    return true;
  }
  try {
    const tex = scene.textures.get(textureKey);
    const names = tex.getFrameNames(false);
    if (!names.includes(t)) {
      return false;
    }
    sprite.setFrame(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Positions a GUI-sheet sprite for `top-left`, `center`, or `screen` anchor.
 * `screen`: top-left of the game canvas / internal resolution — ignores `x`/`y` for placement (full-frame HUD art).
 */
function applyGuiSpriteAnchor(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  x: number,
  y: number,
): void {
  switch (anchor) {
    case 'center':
      sprite.setOrigin(0.5, 0.5);
      sprite.setPosition(Math.round(x), Math.round(y));
      break;
    case 'screen':
      sprite.setOrigin(0, 0);
      /** Absolute screen / canvas coordinates; control `x`/`y` are ignored for draw position. */
      sprite.setPosition(0, 0);
      break;
    default:
      sprite.setOrigin(0, 0);
      sprite.setPosition(Math.round(x), Math.round(y));
  }
}

/**
 * Places the button’s sheet sprite using `anchor` **within the button’s logical bounds** (same idea as
 * {@link GuiInventoryPanelControl.backgroundAnchor} for the panel backdrop: `x`/`y` + `width`/`height` define the
 * control; anchor only affects where the art is pinned).
 */
function placeGuiButtonBackgroundSprite(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  px: number,
  py: number,
  w: number,
  h: number,
): void {
  switch (anchor) {
    case 'center':
      applyGuiSpriteAnchor(sprite, 'center', px + w / 2, py + h / 2);
      break;
    case 'screen':
      /** Full-canvas art; `x`/`y`/`width`/`height` still define the hit box only. */
      applyGuiSpriteAnchor(sprite, 'screen', px, py);
      break;
    default:
      applyGuiSpriteAnchor(sprite, 'top-left', px, py);
      break;
  }
}

interface BuiltGuiButton {
  /** Invisible hit box (`width` × `height`); carries pointer handlers. */
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Sprite | null;
  readonly label: Phaser.GameObjects.BitmapText | null;
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
 * Computes the current **screen-space** bounds of a `scrollFactor: 0` GUI control. Prefers `getBounds()` because
 * it handles arbitrary transforms / packed children (e.g. `inventoryPanel` containers); falls back to a centered
 * rect for plain `Rectangle` game objects (whose `getBounds()` is sometimes 0-sized on Phaser 4 when the Shape
 * has no stroke). `pointer.x` / `pointer.y` are already in screen space, and `scrollFactor: 0` keeps world ==
 * screen for these objects, so no camera math is needed in the non-editor runtime path.
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
    const inRect =
      pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
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
function wireGuiControlHoverEvents(
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

function buildGuiButton(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiButtonControl,
  baseDepth: number,
  startVisible: boolean,
  /** Runs after a successful click passes guards, before {@link gameEvents} button emits. */
  onBeforeEmit?: () => void,
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
  const px = Math.round(c.x);
  const py = Math.round(c.y);

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  /** Above label so the hit box receives input over the bitmap text. */
  hitTarget.setDepth(d + 2);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData('benneGuiButton', true);

  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const defaultBgTag = c.backgroundTag.trim();
  let bg: Phaser.GameObjects.Sprite | null = null;

  if (usesAsepriteDisplay(gui) && defaultBgTag && scene.textures.exists(guiTextureKey)) {
    const sprite = scene.add.sprite(0, 0, guiTextureKey);
    sprite.setVisible(false);
    sprite.setScrollFactor(0, 0);
    sprite.setDepth(d);
    if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, defaultBgTag)) {
      sprite.destroy();
    } else {
      sprite.setVisible(overlayVisible);
      placeGuiButtonBackgroundSprite(sprite, bgAnchor, px, py, w, h);
      bg = sprite;
    }
  }

  let label: Phaser.GameObjects.BitmapText | null = null;
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (fontEntry && scene.cache.bitmapFont.exists(c.font)) {
    const align = c.textAlign ?? 'center';
    const ox = c.textOffsetX ?? 0;
    const oy = c.textOffsetY ?? 0;
    const pad = 4;
    const bx = hitTarget.x;
    const by = hitTarget.y;
    const labelX = bx + (align === 'left' ? pad + ox : align === 'right' ? w - pad + ox : w / 2 + ox);
    const labelY = by + h / 2 + oy;
    const lineAlign = bitmapTextLineAlign(align);
    const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
    const bt = scene.add.bitmapText(labelX, labelY, c.font, c.text ?? '', renderSize, lineAlign);
    bt.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    bt.clearTint();
    bt.setTint(hexStringToTint(c.textColor));
    const letterSpacing = fontEntry.defaultLetterSpacing ?? 0;
    if (letterSpacing !== 0) {
      bt.setLetterSpacing(letterSpacing);
    }
    bt.setScrollFactor(0, 0);
    bt.setDepth(d + 1);
    bt.setVisible(overlayVisible);
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
    const dTag = c.states?.disabled?.trim();
    if (bg && dTag) {
      reapplyGuiSheetTag(scene, bg, guiTextureKey, dTag);
    }
  }

  if (overlayVisible && enabled) {
    applyGuiButtonInteractivity(hitTarget, w, h, enabled);
  }

  const hoverTag = c.states?.hover?.trim();
  const pressedTag = c.states?.pressed?.trim();
  const disabledTag = c.states?.disabled?.trim();

  if (bg && enabled && (hoverTag || pressedTag || disabledTag)) {
    const textureKey = guiTextureKey;
    const restoreDefault = (): void => {
      if (!bg) {
        return;
      }
      reapplyGuiSheetTag(scene, bg, textureKey, defaultBgTag);
    };

    hitTarget.on('pointerover', () => {
      if (!enabled || !bg) {
        return;
      }
      if (hoverTag && !reapplyGuiSheetTag(scene, bg, textureKey, hoverTag)) {
        restoreDefault();
      }
    });
    hitTarget.on('pointerout', () => {
      if (!bg) {
        return;
      }
      restoreDefault();
    });
    hitTarget.on('pointerdown', () => {
      if (!enabled || !bg) {
        return;
      }
      if (pressedTag && !reapplyGuiSheetTag(scene, bg, textureKey, pressedTag)) {
        restoreDefault();
      }
    });
    hitTarget.on('pointerup', () => {
      if (!enabled || !bg) {
        return;
      }
      restoreDefault();
    });
  }

  hitTarget.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !hitTarget.visible || !pointer.leftButtonReleased()) {
      return;
    }
    onBeforeEmit?.();
    gameEvents.emit(guiButtonClickEventId(gui.id, c.id));
    gameEvents.emit(guiAllButtonsClickEventId(gui.id), { buttonId: c.id } satisfies GuiAllButtonsClickPayload);
  });

  return { hitTarget, background: bg, label, enabled, width: w, height: h };
}

function verbLineControlToBitmapStyle(c: GuiVerbLineControl): GuiTextControl {
  return {
    type: 'text',
    x: c.x,
    y: c.y,
    zIndex: c.zIndex,
    visible: c.visible,
    text: '',
    font: c.font,
    fontSize: c.fontSize,
    color: c.color,
    align: c.align,
    wordWrapWidth: c.wordWrapWidth,
    letterSpacing: c.letterSpacing,
  };
}

function addGuiBitmapLine(
  scene: Phaser.Scene,
  c: GuiTextControl,
  initial: string,
  depth: number,
  visible: boolean,
): Phaser.GameObjects.BitmapText | null {
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
  bt.clearTint();
  bt.setTint(hexStringToTint(c.color));
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
  bt.setDepth(depth);
  bt.setVisible(visible);
  return bt;
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

function addGuiImageSprite(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiImageControl,
  depth: number,
  startVisible: boolean,
  extraSprites: Phaser.GameObjects.Sprite[],
  controlsById: Map<string, Phaser.GameObjects.GameObject>,
  /** In-world hit targets that must receive input ahead of this image (same overlay). Filled as controls are built. */
  imageInputDeferBelow: Phaser.GameObjects.GameObject[],
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
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  sprite.setScrollFactor(0, 0);
  sprite.setDepth(depth + (c.zIndex ?? 0));
  const vis = startVisible && c.visible !== false;
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag)) {
    sprite.destroy();
    return null;
  }
  sprite.setVisible(vis);
  if (anchor === 'screen') {
    applyGuiSpriteAnchor(sprite, anchor, c.x, c.y);
    extraSprites.push(sprite);
  } else {
    applyGuiSpriteAnchor(sprite, anchor, c.x, c.y);
    extraSprites.push(sprite);
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

function addInventorySlotSheetSprite(
  scene: Phaser.Scene,
  guiTextureKey: string,
  tagRaw: string | undefined,
  anchorRaw: GuiSpriteAnchor | undefined,
  slotCx: number,
  slotCy: number,
  slotContainer: Phaser.GameObjects.Container,
): void {
  const tag = tagRaw?.trim() ?? '';
  if (!tag || !scene.textures.exists(guiTextureKey)) {
    return;
  }
  const anchor = guiSpriteAnchorOrDefault(anchorRaw);
  const sprite = scene.add.sprite(0, 0, guiTextureKey);
  sprite.setVisible(false);
  if (!tryApplyGuiSheetTag(scene, sprite, guiTextureKey, tag)) {
    sprite.destroy();
    return;
  }
  sprite.setVisible(true);
  /** Inside a slot container, `screen` is treated like top-left at the slot origin (full-slot art). */
  if (anchor === 'center') {
    applyGuiSpriteAnchor(sprite, anchor, slotCx, slotCy);
  } else {
    applyGuiSpriteAnchor(sprite, 'top-left', 0, 0);
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
): void {
  panel.removeAll(true);

  const px = Math.round(c.x);
  const py = Math.round(c.y);

  const panelVisible = startVisible && c.visible !== false;
  panel.setVisible(panelVisible);

  const spacingX = c.spacingX ?? 0;
  const spacingY = c.spacingY ?? 0;
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const wantsGuiSheet = usesAsepriteDisplay(gui) && scene.textures.exists(guiTextureKey);

  const panelW = c.cols * c.slotWidth + Math.max(0, c.cols - 1) * spacingX;
  const panelH = c.rows * c.slotHeight + Math.max(0, c.rows - 1) * spacingY;

  let inventoryItems: ReadonlyArray<{ id: string; quantity: number }> = [];
  try {
    const gameState = resolveGameStateManager(scene.game);
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
  if (bgTag && wantsGuiSheet) {
    const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
    const backdrop = scene.add.sprite(0, 0, guiTextureKey);
    backdrop.setVisible(false);
    backdrop.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, backdrop, guiTextureKey, bgTag)) {
      backdrop.destroy();
    } else {
      backdrop.setVisible(true);
      if (bgAnchor === 'screen') {
        /** World (0,0) while staying parented so `panel.setVisible` still toggles the backdrop. */
        backdrop.setOrigin(0, 0);
        backdrop.setPosition(-px, -py);
      } else if (bgAnchor === 'center') {
        applyGuiSpriteAnchor(backdrop, bgAnchor, panelW / 2, panelH / 2);
      } else {
        applyGuiSpriteAnchor(backdrop, 'top-left', 0, 0);
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
          c.slotBackgroundTag,
          c.slotBackgroundAnchor,
          slotCx,
          slotCy,
          slotContainer,
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
        const iconTag = def?.defaultAnimation ?? entry.id;

        let iconAdded = false;
        if (usesAsepriteDisplay(gui) && iconTag) {
          const guiKey = getAsepriteTextureKey(gui.id);
          if (scene.textures.exists(guiKey)) {
            const iconSprite = scene.add.sprite(slotCx, slotCy, guiKey).setScale(c.itemScale ?? 1).setOrigin(0.5, 0.5);
            iconSprite.setVisible(false);
            if (tryApplyGuiSheetTag(scene, iconSprite, guiKey, iconTag)) {
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
            ensureAsepriteAnimationsFromAtlas(scene, texKey);
            const playKey = scene.anims.exists(animKey)
              ? animKey
              : usesSharedInventoryAseprite(def) && scene.anims.exists(iconTag)
                ? iconTag
                : null;
            if (playKey) {
              const iconSprite = scene
                .add.sprite(slotCx, slotCy, texKey)
                .setScale(c.itemScale ?? 1)
                .setOrigin(0.5, 0.5);
              iconSprite.play(playKey);
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
          c.highlightTag,
          c.highlightAnchor,
          slotCx,
          slotCy,
          slotContainer,
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
                }
                if (shouldDrop) {
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
            manager.clearActiveVerb();
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
   * When set, `verbLine` controls append the hovered prop / hotspot / inventory row description
   * (see {@link composeVerbLineText}). {@link RoomScene} wires hit-testing here.
   */
  verbLineHoverDescription?: () => string | null;
}

/**
 * Builds screen-space GUI controls from `gui.controls` (`text`, `verbLine`, `inventoryPanel`, `image`, `button`).
 * Starts hidden unless `startVisible`. Font ids resolve via `fonts/fonts.json` (`load.bitmapFont` keys).
 */
export function buildGuiOverlay(
  scene: Phaser.Scene,
  gui: GuiData,
  options?: BuildGuiOverlayOptions,
): BuiltGuiOverlay | null {
  const depth = options?.depth ?? GUI_TEXT_OVERLAY_DEPTH;
  const startVisible = options?.startVisible ?? false;
  const placeholder = options?.emptyTextPlaceholder;
  const invPointerCtx = options?.inventoryPanelPointerContext;
  const hoverDescFn = options?.verbLineHoverDescription;
  const readActiveInventoryVerbLineName = (): string | null => {
    try {
      const id = resolveGameStateManager(scene.game).getActiveInventoryItemId()?.trim() ?? '';
      if (id.length === 0) {
        return null;
      }
      const inv = getInventoryDefinition(id) as InventoryItemData | undefined;
      if (!inv) {
        return null;
      }
      const name = inv.name?.trim();
      if (name && name.length > 0) {
        return name;
      }
      const d = inv.description?.trim();
      return d && d.length > 0 ? d : null;
    } catch {
      return null;
    }
  };
  const readFullVerbLine = (): string => {
    let hover: string | null = null;
    try {
      hover = hoverDescFn?.() ?? null;
    } catch {
      hover = null;
    }
    const invName = readActiveInventoryVerbLineName();
    try {
      return composeVerbLineText(
        getGameSettings(),
        resolveGameStateManager(scene.game).getActiveVerb(),
        hover,
        invName,
      );
    } catch {
      return composeVerbLineText(getGameSettings(), null, hover, invName);
    }
  };
  const allLines: Phaser.GameObjects.BitmapText[] = [];
  const verbLines: Phaser.GameObjects.BitmapText[] = [];
  const inventoryPanels: Phaser.GameObjects.Container[] = [];
  const guiButtons: BuiltGuiButton[] = [];
  const triggerZones: Phaser.GameObjects.Rectangle[] = [];
  const linesById = new Map<string, Phaser.GameObjects.BitmapText>();
  const controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  const extraSprites: Phaser.GameObjects.Sprite[] = [];
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
      ensureAsepriteAnimationsFromAtlas(scene, guiKey);
    }
  }

  const controls = gui.controls ?? [];
  const buttonIds = collectGuiButtonIds(controls);
  type InvScrollState = { offset: number; refresh: () => void };
  const invScrollStateByControlIndex = new Map<number, InvScrollState>();
  const buttonPreEmitById = new Map<string, Array<() => void>>();

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
    if (c.type === 'inventoryPanel') {
      const px = Math.round(c.x);
      const py = Math.round(c.y);
      const panel = scene.add.container(px, py);
      panel.setScrollFactor(0, 0);
      panel.setDepth(depth + (c.zIndex ?? 0));
      const scrollSt = invScrollStateByControlIndex.get(i);
      if (scrollSt) {
        scrollSt.refresh = () =>
          fillInventoryPanelContent(panel, scene, gui, c, scrollSt, startVisible, invPointerCtx);
        const onGameStateInventory = (): void => {
          scrollSt.refresh();
        };
        gameEvents.on(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
        gameEvents.on(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
        overlayDisposers.push(() => {
          gameEvents.off(GAME_STATE_INVENTORY_CHANGED_EVENT, onGameStateInventory);
          gameEvents.off(GAME_STATE_REPLACED_EVENT, onGameStateInventory);
        });
        scrollSt.refresh();
      } else {
        fillInventoryPanelContent(panel, scene, gui, c, { offset: 0 }, startVisible, invPointerCtx);
      }
      inventoryPanels.push(panel);
      const pid = c.id?.trim();
      if (pid) {
        controlsById.set(pid, panel);
      }
      guiImageInputDeferBelow.push(panel);
      ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(panel as DepthGameObject);
      continue;
    }

    if (c.type === 'image') {
      const spr = addGuiImageSprite(
        scene,
        gui,
        c,
        depth,
        startVisible,
        extraSprites,
        controlsById,
        guiImageInputDeferBelow,
      );
      if (spr) {
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(spr as DepthGameObject);
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
      const built = buildGuiButton(scene, gui, c, depth, startVisible, preEmit);
      if (built) {
        guiImageInputDeferBelow.push(built.hitTarget);
        guiButtons.push(built);
        controlsById.set(c.id.trim(), built.hitTarget);
        const bucket = isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts;
        if (built.background) {
          bucket.push(built.background as DepthGameObject);
        }
        if (built.label) {
          bucket.push(built.label as DepthGameObject);
        }
        bucket.push(built.hitTarget as DepthGameObject);
      }
      continue;
    }

    if (c.type === 'trigger') {
      const zone = buildGuiTriggerZone(scene, c, depth, startVisible);
      if (zone) {
        triggerZones.push(zone);
        controlsById.set(c.id.trim(), zone);
        overlayDisposers.push(
          installGuiControlPointerHoverObserver(scene, gui, c.id, zone, {
            active: c.active !== false,
          }),
        );
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(zone as DepthGameObject);
      }
      continue;
    }

    if (c.type === 'verbLine') {
      const lineVisible = startVisible && c.visible !== false;
      const textStyle = verbLineControlToBitmapStyle(c);
      const line = addGuiBitmapLine(scene, textStyle, readFullVerbLine(), depth + (c.zIndex ?? 0), lineVisible);
      if (!line) {
        continue;
      }
      verbLines.push(line);
      const onVerbLineGameState = (): void => {
        line.setText(readFullVerbLine());
      };
      gameEvents.on(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, onVerbLineGameState);
      gameEvents.on(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, onVerbLineGameState);
      gameEvents.on(GAME_STATE_REPLACED_EVENT, onVerbLineGameState);
      overlayDisposers.push(() => {
        gameEvents.off(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, onVerbLineGameState);
        gameEvents.off(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, onVerbLineGameState);
        gameEvents.off(GAME_STATE_REPLACED_EVENT, onVerbLineGameState);
      });
      const vid = c.id?.trim();
      if (vid) {
        linesById.set(vid, line);
        controlsById.set(vid, line);
        ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(line as DepthGameObject);
      } else {
        movablePackedParts.push(line as DepthGameObject);
      }
      continue;
    }

    if (c.type !== 'text') {
      continue;
    }
    const raw = c.text?.trim() ?? '';
    const initial = raw.length > 0 ? (c.text ?? '') : (placeholder ?? '');
    const lineVisible = startVisible && c.visible !== false;
    const line = addGuiBitmapLine(scene, c, initial, depth + (c.zIndex ?? 0), lineVisible);
    if (!line) {
      continue;
    }
    allLines.push(line);
    if (c.id) {
      linesById.set(c.id, line);
      controlsById.set(c.id, line);
      ;(isGuiFixedControlId(c.id) ? fixedPackedGameObjects : movablePackedParts).push(line as DepthGameObject);
    } else {
      movablePackedParts.push(line as DepthGameObject);
    }
  }

  if (
    allLines.length === 0 &&
    verbLines.length === 0 &&
    inventoryPanels.length === 0 &&
    extraSprites.length === 0 &&
    guiButtons.length === 0 &&
    triggerZones.length === 0
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

  /** Dialogue / `setPrimaryText` target — text controls only (never a `verbLine`). */
  const primaryLine = linesById.get('line') ?? allLines[0];
  const primaryInitialX = primaryLine?.x ?? 0;
  const primaryInitialY = primaryLine?.y ?? 0;
  const primaryInitialOriginX = primaryLine?.originX ?? 0;
  const primaryInitialOriginY = primaryLine?.originY ?? 0;

  const handle: GuiOverlayHandle = {
    setPrimaryText(text: string) {
      primaryLine?.setText(text);
    },
    setPrimaryScreenPositionBottomCenter(x: number, y: number) {
      primaryLine?.setOrigin(0.5, 1);
      primaryLine?.setPosition(Math.round(x), Math.round(y));
    },
    resetPrimaryScreenPosition() {
      primaryLine?.setOrigin(primaryInitialOriginX, primaryInitialOriginY);
      primaryLine?.setPosition(primaryInitialX, primaryInitialY);
    },
    setControlText(id: string, text: string) {
      linesById.get(id)?.setText(text);
    },
    setVisible(visible: boolean) {
      for (const line of allLines) {
        line.setVisible(visible);
      }
      for (const line of verbLines) {
        line.setVisible(visible);
      }
      for (const panel of inventoryPanels) {
        panel.setVisible(visible);
      }
      for (const s of extraSprites) {
        s.setVisible(visible);
      }
      for (const b of guiButtons) {
        b.hitTarget.setVisible(visible);
        b.background?.setVisible(visible);
        b.label?.setVisible(visible);
        if (visible && b.enabled) {
          applyGuiButtonInteractivity(b.hitTarget, b.width, b.height, b.enabled);
        } else {
          b.hitTarget.disableInteractive();
        }
      }
      for (const z of triggerZones) {
        z.setVisible(visible);
      }
    },
    setLetterSpacing(spacing: number) {
      for (const line of allLines) {
        line.setLetterSpacing(spacing);
      }
    },
    refreshVerbLineText() {
      if (verbLines.length === 0) {
        return;
      }
      const t = readFullVerbLine();
      for (const line of verbLines) {
        line.setText(t);
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
      verbLines.length = 0;
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
