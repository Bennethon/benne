import * as Phaser from 'phaser';
import type { GuiData, GuiTextAlign, GuiTextInputControl } from '../../types/gui';
import { gameEvents } from '../events/EventBus';
import {
  guiTextInputSubmitEventId,
  guiTextInputValueChangedEventId,
  type GuiTextInputSubmitPayload,
  type GuiTextInputValueChangedPayload,
} from '../events/guiTextInputEvents';
import {
  BENNE_GUI_TEXT_INPUT_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_READ_ENABLED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_READ_FOCUSED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_READ_TEXT_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_ENABLED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_FOCUSED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_TEXT_DATA_KEY,
  type BenneGuiTextInputSetEnabledFn,
  type BenneGuiTextInputSetFocusedFn,
  type BenneGuiTextInputSetTextFn,
} from './guiTextInputRuntime';
import { applyGuiButtonInteractivity } from './buildGuiOverlay';
import {
  applyGuiBitmapTextFillTint,
  attachGuiBitmapTextOutlineList,
  BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY,
  BENNE_GUI_OUTLINE_DX_KEY,
  BENNE_GUI_OUTLINE_DY_KEY,
  BENNE_GUI_OUTLINE_FILL_ALPHA_KEY,
  BENNE_GUI_OUTLINE_FILL_TINT_KEY,
  resolveEffectiveGuiTextOutline,
  syncOutlinedGuiBitmapTextAll,
  syncOutlinedGuiBitmapTextPositions,
} from './guiTextOutline';

const GUI_TEXT_INPUT_BG_DEPTH = 0;
const GUI_TEXT_INPUT_BORDER_DEPTH = 1;
const GUI_TEXT_INPUT_OUTLINE_DEPTH = 2;
const GUI_TEXT_INPUT_LABEL_DEPTH = 3;
const GUI_TEXT_INPUT_CARET_DEPTH = 4;
const GUI_TEXT_INPUT_PADDING_X = 4;

export interface BuiltGuiTextInput {
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Rectangle;
  readonly border: Phaser.GameObjects.Rectangle;
  readonly textSurface: Phaser.GameObjects.BitmapText;
  readonly textOutlines: Phaser.GameObjects.BitmapText[];
  readonly caret: Phaser.GameObjects.Rectangle;
  readonly enabled: boolean;
  readonly width: number;
  readonly height: number;
  dispose(): void;
}

function hexStringToTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0xffffff;
  }
}

function normalizeTextAlign(align: GuiTextAlign | undefined): GuiTextAlign {
  if (align === 'center' || align === 'right') {
    return align;
  }
  return 'left';
}

/**
 * BMFont XML can use negative `info size`; when sign mismatches requested size, Phaser flips glyphs.
 * Match existing GUI text/button behavior by enforcing the cache font-data sign.
 */
function effectiveBitmapFontRenderSize(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  const entry = scene.cache.bitmapFont.get(fontKey) as { data?: { size?: number } } | null;
  const dataSize = entry?.data?.size;
  if (dataSize == null || dataSize === 0) {
    return fontSize;
  }
  return dataSize < 0 ? -Math.abs(fontSize) : Math.abs(fontSize);
}

function alignToLineAlign(align: GuiTextAlign): number {
  if (align === 'center') {
    return 1;
  }
  if (align === 'right') {
    return 2;
  }
  return 0;
}

function pointerInsideHitTarget(
  pointer: Phaser.Input.Pointer,
  hitTarget: Phaser.GameObjects.Container,
  width: number,
  height: number,
): boolean {
  const matrix = hitTarget.getWorldTransformMatrix();
  const local = matrix.applyInverse(pointer.worldX, pointer.worldY);
  return local.x >= 0 && local.y >= 0 && local.x <= width && local.y <= height;
}

function capToMaxLength(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }
  return Array.from(value).slice(0, maxLength).join('');
}

function createGuiBitmapTextOutlines(
  scene: Phaser.Scene,
  main: Phaser.GameObjects.BitmapText,
  outline: GuiTextInputControl['textOutline'],
  visible: boolean,
): Phaser.GameObjects.BitmapText[] {
  const spec = resolveEffectiveGuiTextOutline(outline);
  if (!spec) {
    return [];
  }
  const outs: Phaser.GameObjects.BitmapText[] = [];
  const maxW = (main as { maxWidth?: number }).maxWidth;
  const letterSpacing = (main as { letterSpacing?: number }).letterSpacing ?? 0;
  for (const { dx, dy } of spec.offsets) {
    const o = scene.add.bitmapText(main.x + dx, main.y + dy, main.font, main.text, main.fontSize, main.align);
    o.setOrigin(main.originX, main.originY);
    if (letterSpacing !== 0) {
      o.setLetterSpacing(letterSpacing);
    }
    if (typeof maxW === 'number' && maxW > 0) {
      o.setMaxWidth(maxW);
    }
    o.setVisible(visible);
    o.setScrollFactor(0, 0);
    o.setDepth(GUI_TEXT_INPUT_OUTLINE_DEPTH);
    o.setData(BENNE_GUI_OUTLINE_DX_KEY, dx);
    o.setData(BENNE_GUI_OUTLINE_DY_KEY, dy);
    applyGuiBitmapTextFillTint(o, spec.tint);
    o.setAlpha(spec.alpha);
    o.setData(BENNE_GUI_OUTLINE_FILL_TINT_KEY, spec.tint);
    o.setData(BENNE_GUI_OUTLINE_FILL_ALPHA_KEY, spec.alpha);
    outs.push(o);
  }
  attachGuiBitmapTextOutlineList(main, outs);
  return outs;
}

export function buildGuiTextInput(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiTextInputControl,
  baseDepth: number,
  startVisible: boolean,
  isInputSuppressed?: () => boolean,
): BuiltGuiTextInput | null {
  const id = c.id.trim();
  if (!id || c.width <= 0 || c.height <= 0) {
    return null;
  }
  if (!scene.cache.bitmapFont.exists(c.font)) {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] GUI "${gui.id}" textInput "${id}" uses unknown bitmap font "${c.font}".`);
    }
    return null;
  }

  const maxLength = Number.isFinite(c.maxLength) && (c.maxLength ?? 0) > 0 ? Math.floor(c.maxLength!) : Number.MAX_SAFE_INTEGER;
  let value = capToMaxLength(c.text ?? '', maxLength);
  let caretIndex = Array.from(value).length;
  let enabled = c.enabled !== false;
  let focused = false;
  let pointerHover = false;
  let blinkOn = true;

  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const w = Math.round(c.width);
  const h = Math.round(c.height);
  const overlayVisible = startVisible && c.visible !== false;
  const z = c.zIndex ?? 0;
  const d = baseDepth + z;

  const textAlign = normalizeTextAlign(c.textAlign);
  const textLineAlign = alignToLineAlign(textAlign);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  hitTarget.setDepth(d);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_DATA_KEY, true);

  const background = scene.add.rectangle(0, 0, w, h, 0xffffff, 1);
  background.setOrigin(0, 0);
  background.setDepth(GUI_TEXT_INPUT_BG_DEPTH);
  hitTarget.add(background);

  const border = scene.add.rectangle(0, 0, w, h, 0xffffff, 0);
  border.setOrigin(0, 0);
  border.setStrokeStyle(1, 0xffffff, 1);
  border.setDepth(GUI_TEXT_INPUT_BORDER_DEPTH);
  hitTarget.add(border);

  const baseTextX = textAlign === 'left' ? GUI_TEXT_INPUT_PADDING_X : textAlign === 'right' ? w - GUI_TEXT_INPUT_PADDING_X : Math.round(w / 2);
  const baseTextY = Math.round(h / 2);
  const textSurface = scene.add.bitmapText(baseTextX, baseTextY, c.font, '', renderSize, textLineAlign);
  textSurface.setOrigin(textAlign === 'left' ? 0 : textAlign === 'right' ? 1 : 0.5, 0.5);
  textSurface.setDepth(GUI_TEXT_INPUT_LABEL_DEPTH);
  textSurface.setScrollFactor(0, 0);
  const maxWidth = Math.max(0, Math.floor(c.wordWrapWidth ?? Math.max(0, w - GUI_TEXT_INPUT_PADDING_X * 2)));
  if (maxWidth > 0) {
    textSurface.setMaxWidth(maxWidth);
  }
  hitTarget.add(textSurface);

  const textOutlines = createGuiBitmapTextOutlines(scene, textSurface, c.textOutline, overlayVisible);
  for (const o of textOutlines) {
    hitTarget.add(o);
  }

  const caret = scene.add.rectangle(0, 0, 1, Math.max(2, Math.round(h - 6)), 0xffffff, 1);
  caret.setOrigin(0, 0.5);
  caret.setDepth(GUI_TEXT_INPUT_CARET_DEPTH);
  caret.setScrollFactor(0, 0);
  hitTarget.add(caret);

  const caretBlink = scene.time.addEvent({
    delay: 500,
    loop: true,
    callback: () => {
      blinkOn = !blinkOn;
      refreshVisualState();
    },
  });

  const emitValueChanged = (newValue: string, oldValue: string): void => {
    gameEvents.emit(guiTextInputValueChangedEventId(gui.id, id), {
      newValue,
      oldValue,
    } satisfies GuiTextInputValueChangedPayload);
  };

  const emitSubmit = (): void => {
    gameEvents.emit(guiTextInputSubmitEventId(gui.id, id), {
      finalValue: value,
    } satisfies GuiTextInputSubmitPayload);
  };

  const getPlaceholderVisible = (): boolean => value.length === 0 && !!c.placeholder && !focused;

  const getCurrentText = (): string => (getPlaceholderVisible() ? (c.placeholder ?? '') : value);

  const refreshInteractivity = (): void => {
    hitTarget.disableInteractive();
    if (hitTarget.visible && enabled) {
      applyGuiButtonInteractivity(hitTarget, w, h, true);
    }
  };

  const applyTextTint = (): void => {
    const tint = getPlaceholderVisible() ? hexStringToTint(c.outlineColor) : hexStringToTint(c.color);
    applyGuiBitmapTextFillTint(textSurface, tint);
    textSurface.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, tint);
  };

  const refreshCaretPosition = (): void => {
    const display = getCurrentText();
    const codepoints = Array.from(display);
    const maxCaret = codepoints.length;
    const safeCaret = Math.max(0, Math.min(maxCaret, focused ? caretIndex : maxCaret));
    const measureText = codepoints.slice(0, safeCaret).join('');
    const measure = scene.add.bitmapText(0, 0, c.font, measureText, renderSize, textLineAlign);
    measure.setVisible(false);
    if (maxWidth > 0) {
      measure.setMaxWidth(maxWidth);
    }
    const bounds = measure.getBounds();
    measure.destroy();
    const left = GUI_TEXT_INPUT_PADDING_X;
    const right = w - GUI_TEXT_INPUT_PADDING_X;
    let x = left + Math.round(bounds.width);
    if (textAlign === 'center') {
      x = Math.round(w / 2 + bounds.width / 2);
    } else if (textAlign === 'right') {
      x = Math.round(right);
    }
    caret.setPosition(Math.max(left, Math.min(right, x)), Math.round(h / 2));
  };

  function refreshVisualState(): void {
    const displayText = getCurrentText();
    syncOutlinedGuiBitmapTextAll(textSurface, displayText);
    applyTextTint();
    syncOutlinedGuiBitmapTextPositions(textSurface);
    const bgColor = focused || pointerHover ? c.hoverBackgroundColor ?? c.backgroundColor : c.backgroundColor;
    background.setFillStyle(hexStringToTint(bgColor), 1);
    const borderColor = focused ? c.focusedOutlineColor ?? c.outlineColor : c.outlineColor;
    border.setStrokeStyle(1, hexStringToTint(borderColor), 1);
    const caretColor = hexStringToTint(c.caretColor);
    caret.setFillStyle(caretColor, 1);
    refreshCaretPosition();
    const showCaret = enabled && focused && hitTarget.visible && blinkOn && !getPlaceholderVisible();
    caret.setVisible(showCaret);
    const alpha = enabled ? 1 : 0.45;
    hitTarget.setAlpha(alpha);
    background.setAlpha(alpha);
    border.setAlpha(alpha);
    textSurface.setAlpha(alpha);
    for (const o of textOutlines) {
      o.setAlpha(alpha);
    }
  }

  const setFocusedInternal = (next: boolean): void => {
    if (focused === next) {
      return;
    }
    focused = next;
    blinkOn = true;
    refreshVisualState();
  };

  const setTextInternal = (next: string, emitEvents: boolean): void => {
    const clipped = capToMaxLength(next, maxLength);
    if (clipped === value) {
      return;
    }
    const oldValue = value;
    value = clipped;
    caretIndex = Math.max(0, Math.min(Array.from(value).length, caretIndex));
    refreshVisualState();
    if (emitEvents) {
      emitValueChanged(value, oldValue);
    }
  };

  const setTextFromScript: BenneGuiTextInputSetTextFn = (next: string) => {
    setTextInternal(String(next ?? ''), false);
    caretIndex = Array.from(value).length;
    refreshVisualState();
  };
  const setFocusedFromScript: BenneGuiTextInputSetFocusedFn = (next: boolean) => {
    if (!enabled) {
      setFocusedInternal(false);
      return;
    }
    setFocusedInternal(next);
  };
  const setEnabledFromScript: BenneGuiTextInputSetEnabledFn = (next: boolean) => {
    enabled = next;
    if (!enabled) {
      setFocusedInternal(false);
    }
    refreshInteractivity();
    refreshVisualState();
  };

  hitTarget.setData(BENNE_GUI_TEXT_INPUT_SET_TEXT_DATA_KEY, setTextFromScript);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_SET_FOCUSED_DATA_KEY, setFocusedFromScript);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_SET_ENABLED_DATA_KEY, setEnabledFromScript);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_READ_TEXT_DATA_KEY, () => value);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_READ_FOCUSED_DATA_KEY, () => focused);
  hitTarget.setData(BENNE_GUI_TEXT_INPUT_READ_ENABLED_DATA_KEY, () => enabled);

  hitTarget.on('pointerover', () => {
    pointerHover = true;
    refreshVisualState();
  });
  hitTarget.on('pointerout', () => {
    pointerHover = false;
    refreshVisualState();
  });
  hitTarget.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !pointer.leftButtonDown()) {
      return;
    }
    if (isInputSuppressed?.()) {
      return;
    }
    setFocusedInternal(true);
  });

  const onScenePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!focused) {
      return;
    }
    if (pointerInsideHitTarget(pointer, hitTarget, w, h)) {
      return;
    }
    setFocusedInternal(false);
  };
  scene.input.on('pointerdown', onScenePointerDown);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!focused || !enabled || !hitTarget.visible) {
      return;
    }
    if (isInputSuppressed?.()) {
      return;
    }
    const key = event.key;
    if (key === 'Enter') {
      emitSubmit();
      return;
    }
    if (key === 'Escape') {
      setFocusedInternal(false);
      return;
    }
    if (key === 'Backspace') {
      const chars = Array.from(value);
      if (chars.length > 0 && caretIndex > 0) {
        chars.splice(caretIndex - 1, 1);
        caretIndex -= 1;
        setTextInternal(chars.join(''), true);
      }
      return;
    }
    if (key === 'Delete') {
      const chars = Array.from(value);
      if (chars.length > 0 && caretIndex < chars.length) {
        chars.splice(caretIndex, 1);
        setTextInternal(chars.join(''), true);
      }
      return;
    }
    if (key === 'ArrowLeft') {
      caretIndex = Math.max(0, caretIndex - 1);
      refreshVisualState();
      return;
    }
    if (key === 'ArrowRight') {
      caretIndex = Math.min(Array.from(value).length, caretIndex + 1);
      refreshVisualState();
      return;
    }
    if (key === 'Home') {
      caretIndex = 0;
      refreshVisualState();
      return;
    }
    if (key === 'End') {
      caretIndex = Array.from(value).length;
      refreshVisualState();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const chars = Array.from(value);
      if (chars.length >= maxLength) {
        return;
      }
      chars.splice(caretIndex, 0, key);
      caretIndex += 1;
      setTextInternal(chars.join(''), true);
    }
  };
  scene.input.keyboard?.on('keydown', onKeyDown);

  const dispose = (): void => {
    caretBlink.remove(false);
    scene.input.off('pointerdown', onScenePointerDown);
    scene.input.keyboard?.off('keydown', onKeyDown);
  };

  hitTarget.once(Phaser.GameObjects.Events.DESTROY, dispose);
  refreshInteractivity();
  refreshVisualState();

  return {
    hitTarget,
    background,
    border,
    textSurface,
    textOutlines,
    caret,
    enabled,
    width: w,
    height: h,
    dispose,
  };
}
