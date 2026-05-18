import * as Phaser from 'phaser';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/guiAseprite';
import type { GuiCheckboxControl, GuiData } from '../../types/gui';
import { gameEvents } from '../events/EventBus';
import {
  guiCheckboxCheckEventId,
  guiCheckboxUncheckEventId,
} from '../events/guiCheckboxEvents';
import { warnDevIfAsepriteJsonMissingSpriteSourceSize } from '../aseprite/asepriteFramePlacement';
import {
  applyGuiButtonInteractivity,
  guiSpriteAnchorOrDefault,
  placeGuiButtonBackgroundSpriteLocal,
  reapplyGuiSheetTag,
  tryApplyGuiSheetTag,
} from './buildGuiOverlay';
import {
  BENNE_GUI_CHECKBOX_APPLY_VISUAL_DATA_KEY,
  BENNE_GUI_CHECKBOX_DATA_KEY,
  BENNE_GUI_CHECKBOX_READ_CHECKED_DATA_KEY,
  BENNE_GUI_CHECKBOX_READ_DISABLED_DATA_KEY,
  BENNE_GUI_CHECKBOX_SET_CHECKED_DATA_KEY,
  BENNE_GUI_CHECKBOX_SET_DISABLED_DATA_KEY,
  type BenneGuiCheckboxApplyVisualFn,
  type BenneGuiCheckboxSetCheckedFn,
  type BenneGuiCheckboxSetDisabledFn,
} from './guiCheckboxRuntime';

const GUI_CHECKBOX_SPRITE_DEPTH = 0;

export interface BuiltGuiCheckbox {
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite | null;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly width: number;
  readonly height: number;
}

function resolveCheckboxTag(
  c: GuiCheckboxControl,
  checked: boolean,
  disabled: boolean,
  hover: boolean,
): string {
  const states = c.states;
  const defaultTag = c.tag.trim();
  if (disabled) {
    if (checked) {
      return states?.disabledChecked?.trim() || states?.checked?.trim() || defaultTag;
    }
    return states?.disabled?.trim() || defaultTag;
  }
  if (checked) {
    if (hover) {
      return states?.checkedHover?.trim() || states?.checked?.trim() || defaultTag;
    }
    return states?.checked?.trim() || defaultTag;
  }
  if (hover) {
    return states?.uncheckedHover?.trim() || defaultTag;
  }
  return defaultTag;
}

export function buildGuiCheckbox(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiCheckboxControl,
  baseDepth: number,
  startVisible: boolean,
  screenBgWorldTopLeft?: { x: number; y: number },
  isClickSuppressed?: () => boolean,
): BuiltGuiCheckbox | null {
  const w = c.width;
  const h = c.height;
  if (w <= 0 || h <= 0) {
    return null;
  }
  const id = c.id.trim();
  if (!id) {
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

  const enabled = c.enabled !== false;
  let checked = c.checked === true;
  let disabled = !enabled;
  let pointerHover = false;

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  hitTarget.setDepth(d);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData(BENNE_GUI_CHECKBOX_DATA_KEY, true);

  const guiTextureKey = getAsepriteTextureKey(gui.id);
  const defaultTag = c.tag.trim();
  let sprite: Phaser.GameObjects.Sprite | null = null;

  if (usesAsepriteDisplay(gui) && defaultTag && scene.textures.exists(guiTextureKey)) {
    const spr = scene.add.sprite(0, 0, guiTextureKey);
    spr.setDepth(GUI_CHECKBOX_SPRITE_DEPTH);
    spr.setVisible(false);
    spr.setScrollFactor(0, 0);
    const initialTag = resolveCheckboxTag(c, checked, disabled, false);
    if (!tryApplyGuiSheetTag(scene, spr, guiTextureKey, initialTag, gui.id)) {
      spr.destroy();
    } else {
      spr.setVisible(overlayVisible);
      if (import.meta.env.DEV) {
        warnDevIfAsepriteJsonMissingSpriteSourceSize(
          spr.frame,
          `GUI "${gui.id}" checkbox "${c.id}"`,
        );
      }
      placeGuiButtonBackgroundSpriteLocal(spr, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
      hitTarget.add(spr);
      sprite = spr;
    }
  }

  if (!sprite) {
    hitTarget.destroy();
    return null;
  }

  const repositionSprite = (): void => {
    if (sprite) {
      placeGuiButtonBackgroundSpriteLocal(sprite, bgAnchor, w, h, worldTL, bgOffX, bgOffY);
    }
  };

  const applyTagForVisual = (hover: boolean): void => {
    if (!sprite) {
      return;
    }
    const tag = resolveCheckboxTag(c, checked, disabled, hover);
    if (reapplyGuiSheetTag(scene, sprite, guiTextureKey, tag, gui.id)) {
      repositionSprite();
    }
  };

  const syncDisabledAlpha = (): void => {
    const a = disabled ? 0.45 : 1;
    hitTarget.setAlpha(a);
    sprite?.setAlpha(a);
  };

  const applyCheckboxVisual: BenneGuiCheckboxApplyVisualFn = (hover: boolean) => {
    pointerHover = hover;
    applyTagForVisual(hover);
    syncDisabledAlpha();
  };

  const refreshInteractivity = (): void => {
    hitTarget.disableInteractive();
    if (overlayVisible && !disabled) {
      applyGuiButtonInteractivity(hitTarget, w, h, true);
    }
  };

  const setCheckedFromScript: BenneGuiCheckboxSetCheckedFn = (value: boolean) => {
    checked = value;
    applyCheckboxVisual(pointerHover);
  };

  const setDisabledFromScript: BenneGuiCheckboxSetDisabledFn = (value: boolean) => {
    disabled = value;
    if (disabled) {
      pointerHover = false;
    }
    applyCheckboxVisual(false);
    refreshInteractivity();
  };

  hitTarget.setData(BENNE_GUI_CHECKBOX_APPLY_VISUAL_DATA_KEY, applyCheckboxVisual);
  hitTarget.setData(BENNE_GUI_CHECKBOX_SET_CHECKED_DATA_KEY, setCheckedFromScript);
  hitTarget.setData(BENNE_GUI_CHECKBOX_SET_DISABLED_DATA_KEY, setDisabledFromScript);
  hitTarget.setData(BENNE_GUI_CHECKBOX_READ_CHECKED_DATA_KEY, () => checked);
  hitTarget.setData(BENNE_GUI_CHECKBOX_READ_DISABLED_DATA_KEY, () => disabled);

  syncDisabledAlpha();
  refreshInteractivity();

  hitTarget.on('pointerover', () => {
    if (disabled) {
      return;
    }
    applyCheckboxVisual(true);
  });
  hitTarget.on('pointerout', () => {
    if (disabled) {
      return;
    }
    applyCheckboxVisual(false);
  });

  hitTarget.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (disabled || !hitTarget.visible || !pointer.leftButtonReleased()) {
      return;
    }
    if (isClickSuppressed?.()) {
      return;
    }
    const wasChecked = checked;
    checked = !checked;
    applyCheckboxVisual(false);
    if (checked) {
      gameEvents.emit(guiCheckboxCheckEventId(gui.id, id));
    } else {
      gameEvents.emit(guiCheckboxUncheckEventId(gui.id, id));
    }
    void wasChecked;
  });

  return { hitTarget, sprite, enabled: !disabled, checked, width: w, height: h };
}
