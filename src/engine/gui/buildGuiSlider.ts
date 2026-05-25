import * as Phaser from 'phaser';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/boot/guiAseprite';
import type { GuiData, GuiSliderControl } from '../../types/gui';
import { gameEvents } from '../events/EventBus';
import {
  guiSliderValueChangedEventId,
  type GuiSliderValueChangedPayload,
} from '../events/guiSliderEvents';
import {
  getAsepriteSpriteSourceInset,
  getAsepriteVisibleFrameSize,
  warnDevIfAsepriteJsonMissingSpriteSourceSize,
} from '../aseprite/asepriteFramePlacement';
import {
  applyGuiButtonInteractivity,
  guiSpriteAnchorOrDefault,
  placeGuiButtonBackgroundSpriteLocal,
  reapplyGuiSheetTag,
  tryApplyGuiSheetTag,
} from './buildGuiOverlay';
import {
  BENNE_GUI_SLIDER_APPLY_VISUAL_DATA_KEY,
  BENNE_GUI_SLIDER_DATA_KEY,
  BENNE_GUI_SLIDER_READ_DISABLED_DATA_KEY,
  BENNE_GUI_SLIDER_READ_VALUE_DATA_KEY,
  BENNE_GUI_SLIDER_SET_DISABLED_DATA_KEY,
  BENNE_GUI_SLIDER_SET_VALUE_DATA_KEY,
  type BenneGuiSliderApplyVisualFn,
  type BenneGuiSliderSetDisabledFn,
  type BenneGuiSliderSetValueFn,
} from './guiSliderRuntime';

const GUI_SLIDER_TRACK_DEPTH = 0;
const GUI_SLIDER_HANDLE_DEPTH = 1;

export interface BuiltGuiSlider {
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly trackSprite: Phaser.GameObjects.Sprite | null;
  readonly handleSprite: Phaser.GameObjects.Sprite | null;
  readonly enabled: boolean;
  readonly value: number;
  readonly width: number;
  readonly height: number;
}

export interface GuiSliderRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export function resolveGuiSliderRange(c: GuiSliderControl): GuiSliderRange {
  const min = c.min ?? 0;
  const max = c.max ?? 100;
  const step = c.step != null && c.step > 0 ? c.step : 1;
  return { min, max, step };
}

export function snapGuiSliderValue(raw: number, range: GuiSliderRange): number {
  const { min, max, step } = range;
  const span = max - min;
  if (span <= 0) {
    return min;
  }
  if (!Number.isFinite(raw)) {
    return min;
  }
  const steps = Math.round((raw - min) / step);
  const snapped = min + steps * step;
  return Math.min(max, Math.max(min, snapped));
}

function resolveSliderTags(
  c: GuiSliderControl,
  hover: boolean,
  disabled: boolean,
): { track: string; handle: string } {
  const trackDefault = c.trackTag.trim();
  const handleDefault = c.handleTag.trim();
  if (disabled) {
    return {
      track: c.states?.disabled?.track?.trim() || trackDefault,
      handle: c.states?.disabled?.handle?.trim() || handleDefault,
    };
  }
  if (hover) {
    return {
      track: trackDefault,
      handle: c.states?.hover?.handle?.trim() || handleDefault,
    };
  }
  return { track: trackDefault, handle: handleDefault };
}

function getHandleTravelBounds(hitWidth: number): { minX: number; maxX: number } {
  const minX = 0;
  const maxX = Math.max(minX, hitWidth);
  return { minX, maxX };
}

function getVisibleSpriteLocalBounds(sprite: Phaser.GameObjects.Sprite): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const inset = getAsepriteSpriteSourceInset(sprite.frame);
  const visible = getAsepriteVisibleFrameSize(sprite.frame);
  const left = sprite.x - sprite.displayOriginX + inset.x;
  const top = sprite.y - sprite.displayOriginY + inset.y;
  return {
    left,
    top,
    right: left + visible.w,
    bottom: top + visible.h,
  };
}

function resolveSliderTravelBounds(
  hitWidth: number,
  hitHeight: number,
  trackSprite: Phaser.GameObjects.Sprite | null,
): { minX: number; maxX: number; centerY: number } {
  const fallback = getHandleTravelBounds(hitWidth);
  const fallbackY = hitHeight / 2;
  const b = trackSprite != null ? getVisibleSpriteLocalBounds(trackSprite) : null;
  const rawMinX = b && Number.isFinite(b.left) ? b.left : fallback.minX;
  const rawMaxX = b && Number.isFinite(b.right) ? b.right : fallback.maxX;
  const centerY =
    b && Number.isFinite(b.top) && Number.isFinite(b.bottom) ? (b.top + b.bottom) / 2 : fallbackY;
  return {
    minX: Math.min(rawMinX, rawMaxX),
    maxX: Math.max(rawMinX, rawMaxX),
    centerY,
  };
}

function resolveHandlePlacementOffsetX(
  hitWidth: number,
  handleSprite: Phaser.GameObjects.Sprite | null,
): number {
  if (!handleSprite) {
    return 0;
  }
  const frameData = (handleSprite.frame as unknown as { data?: { trim?: boolean } }).data;
  const isTrimmed = frameData?.trim === true;
  const handleVisibleW = getAsepriteVisibleFrameSize(handleSprite.frame).w;
  const isFullWidthCanvasHandle = !isTrimmed && handleVisibleW >= Math.max(1, hitWidth) * 0.9;
  return isFullWidthCanvasHandle ? handleVisibleW / 2 : 0;
}

function valueToHandleLocalX(
  value: number,
  range: GuiSliderRange,
  minX: number,
  maxX: number,
): number {
  const span = range.max - range.min;
  if (span <= 0) {
    return minX;
  }
  const t = (value - range.min) / span;
  if (!Number.isFinite(t)) {
    return minX;
  }
  return minX + t * (maxX - minX);
}

function localXToValue(localX: number, range: GuiSliderRange, minX: number, maxX: number): number {
  const travel = maxX - minX;
  if (travel <= 0) {
    return range.min;
  }
  const t = (localX - minX) / travel;
  return snapGuiSliderValue(range.min + t * (range.max - range.min), range);
}

export function buildGuiSlider(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiSliderControl,
  baseDepth: number,
  startVisible: boolean,
  screenBgWorldTopLeft?: { x: number; y: number },
  isClickSuppressed?: () => boolean,
): BuiltGuiSlider | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }
  const id = c.id.trim();
  if (!id) {
    return null;
  }

  const range = resolveGuiSliderRange(c);
  const initialValue = snapGuiSliderValue(c.defaultValue ?? range.min, range);

  const z = c.zIndex ?? 0;
  const d = baseDepth + z;
  const overlayVisible = startVisible && c.visible !== false;
  const bgAnchor = guiSpriteAnchorOrDefault(c.backgroundAnchor);
  const bgOffX = c.backgroundOffsetX ?? 0;
  const bgOffY = c.backgroundOffsetY ?? 0;
  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const worldTL = screenBgWorldTopLeft ?? { x: px, y: py };

  const enabled = c.enabled !== false;
  let value = initialValue;
  let disabled = !enabled;
  let pointerHover = false;
  let dragging = false;

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  hitTarget.setDepth(d);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData(BENNE_GUI_SLIDER_DATA_KEY, true);

  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const trackTagDefault = c.trackTag.trim();
  const handleTagDefault = c.handleTag.trim();

  let trackSprite: Phaser.GameObjects.Sprite | null = null;
  let handleSprite: Phaser.GameObjects.Sprite | null = null;

  if (
    usesAsepriteDisplay(gui) &&
    trackTagDefault &&
    handleTagDefault &&
    scene.textures.exists(guiTextureKey)
  ) {
    const track = scene.add.sprite(0, 0, guiTextureKey);
    track.setDepth(GUI_SLIDER_TRACK_DEPTH);
    track.setVisible(false);
    track.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, track, guiTextureKey, trackTagDefault, gui.id)) {
      track.destroy();
    } else {
      track.setVisible(overlayVisible);
      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(
          track.frame,
          `GUI "${gui.id}" slider "${c.id}" track`,
        );
      }
      placeGuiButtonBackgroundSpriteLocal(track, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
      hitTarget.add(track);
      trackSprite = track;
    }

    const handle = scene.add.sprite(0, 0, guiTextureKey);
    handle.setDepth(GUI_SLIDER_HANDLE_DEPTH);
    handle.setVisible(false);
    handle.setScrollFactor(0, 0);
    if (!tryApplyGuiSheetTag(scene, handle, guiTextureKey, handleTagDefault, gui.id)) {
      handle.destroy();
    } else {
      handle.setVisible(overlayVisible);
      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(
          handle.frame,
          `GUI "${gui.id}" slider "${c.id}" handle`,
        );
      }
      hitTarget.add(handle);
      handleSprite = handle;
    }
  }

  if (!trackSprite && !handleSprite) {
    hitTarget.destroy();
    return null;
  }

  const repositionHandle = (): void => {
    if (!handleSprite) {
      return;
    }
    const { minX, maxX, centerY } = resolveSliderTravelBounds(w, h, trackSprite);
    const handleOffsetX = resolveHandlePlacementOffsetX(w, handleSprite);
    const hx = valueToHandleLocalX(value, range, minX, maxX);
    const hy = centerY;
    handleSprite.setOrigin(0.5, 0.5);
    handleSprite.setPosition(Math.round(hx + handleOffsetX), Math.round(hy));
  };

  const repositionTrack = (): void => {
    if (trackSprite) {
      placeGuiButtonBackgroundSpriteLocal(trackSprite, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
    }
  };

  const applyTagsForVisual = (hover: boolean): void => {
    const tags = resolveSliderTags(c, hover, disabled);
    if (trackSprite && tags.track) {
      if (reapplyGuiSheetTag(scene, trackSprite, guiTextureKey, tags.track, gui.id)) {
        repositionTrack();
      }
    }
    if (handleSprite && tags.handle) {
      if (reapplyGuiSheetTag(scene, handleSprite, guiTextureKey, tags.handle, gui.id)) {
        repositionHandle();
      }
    }
  };

  const syncDisabledAlpha = (): void => {
    const a = disabled ? 0.45 : 1;
    hitTarget.setAlpha(a);
    trackSprite?.setAlpha(a);
    handleSprite?.setAlpha(a);
  };

  const applySliderVisual: BenneGuiSliderApplyVisualFn = (hover: boolean) => {
    pointerHover = hover;
    applyTagsForVisual(hover);
    syncDisabledAlpha();
  };

  const emitValueChangedIfPointer = (newValue: number): void => {
    gameEvents.emit(guiSliderValueChangedEventId(gui.id, id), {
      value: newValue,
    } satisfies GuiSliderValueChangedPayload);
  };

  const setValueInternal = (next: number, fromPointer: boolean): void => {
    const snapped = snapGuiSliderValue(next, range);
    if (snapped === value) {
      return;
    }
    value = snapped;
    applySliderVisual(pointerHover);
    repositionHandle();
    if (fromPointer) {
      emitValueChangedIfPointer(value);
    }
  };

  const setValueFromScript: BenneGuiSliderSetValueFn = (next: number) => {
    setValueInternal(next, false);
  };

  const refreshInteractivity = (): void => {
    hitTarget.disableInteractive();
    if (hitTarget.visible && !disabled) {
      applyGuiButtonInteractivity(hitTarget, w, h, true);
    }
  };

  let onPointerMove: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  let onPointerUp: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  function endDrag(): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    if (onPointerMove) {
      scene.input.off('pointermove', onPointerMove);
      onPointerMove = null;
    }
    if (onPointerUp) {
      scene.input.off('pointerup', onPointerUp);
      onPointerUp = null;
    }
  }

  const setDisabledFromScript: BenneGuiSliderSetDisabledFn = (next: boolean) => {
    disabled = next;
    if (disabled) {
      pointerHover = false;
      dragging = false;
      endDrag();
    }
    applySliderVisual(false);
    refreshInteractivity();
  };

  const updateFromPointer = (pointer: Phaser.Input.Pointer): void => {
    if (disabled || !hitTarget.visible) {
      return;
    }
    const matrix = hitTarget.getWorldTransformMatrix();
    const local = matrix.applyInverse(pointer.worldX, pointer.worldY);
    const { minX, maxX } = resolveSliderTravelBounds(w, h, trackSprite);
    const next = localXToValue(local.x, range, minX, maxX);
    setValueInternal(next, true);
  };

  const startDrag = (pointer: Phaser.Input.Pointer): void => {
    if (disabled || dragging) {
      return;
    }
    if (isClickSuppressed?.()) {
      return;
    }
    dragging = true;
    updateFromPointer(pointer);
    onPointerMove = (p: Phaser.Input.Pointer) => {
      if (!dragging) {
        return;
      }
      updateFromPointer(p);
    };
    onPointerUp = (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonReleased()) {
        return;
      }
      updateFromPointer(p);
      endDrag();
      applySliderVisual(false);
    };
    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerup', onPointerUp);
  };

  hitTarget.setData(BENNE_GUI_SLIDER_APPLY_VISUAL_DATA_KEY, applySliderVisual);
  hitTarget.setData(BENNE_GUI_SLIDER_SET_VALUE_DATA_KEY, setValueFromScript);
  hitTarget.setData(BENNE_GUI_SLIDER_SET_DISABLED_DATA_KEY, setDisabledFromScript);
  hitTarget.setData(BENNE_GUI_SLIDER_READ_VALUE_DATA_KEY, () => value);
  hitTarget.setData(BENNE_GUI_SLIDER_READ_DISABLED_DATA_KEY, () => disabled);

  applySliderVisual(false);
  repositionHandle();
  syncDisabledAlpha();
  refreshInteractivity();

  hitTarget.on('pointerover', () => {
    if (disabled) {
      return;
    }
    applySliderVisual(true);
  });
  hitTarget.on('pointerout', () => {
    if (disabled || dragging) {
      return;
    }
    applySliderVisual(false);
  });

  hitTarget.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.leftButtonDown() || disabled || !hitTarget.visible) {
      return;
    }
    startDrag(pointer);
  });

  hitTarget.once(Phaser.GameObjects.Events.DESTROY, () => {
    endDrag();
  });

  return {
    hitTarget,
    trackSprite,
    handleSprite,
    enabled: !disabled,
    value,
    width: w,
    height: h,
  };
}
