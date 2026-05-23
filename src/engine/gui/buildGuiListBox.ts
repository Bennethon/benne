import * as Phaser from 'phaser';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import type { GameBitmapFontDefinition, GameFontsManifest } from '../../types/fonts';
import type { GuiData, GuiListBoxControl, GuiTextOutline } from '../../types/gui';
import { gameEvents } from '../events/EventBus';
import {
  guiListBoxItemActivatedEventId,
  guiListBoxSelectionChangedEventId,
  type GuiListBoxItemActivatedPayload,
  type GuiListBoxSelectionChangedPayload,
} from '../events/guiListBoxEvents';
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
import {
  BENNE_GUI_LIST_BOX_DATA_KEY,
  BENNE_GUI_LIST_BOX_READ_ROW_COUNT_DATA_KEY,
  BENNE_GUI_LIST_BOX_READ_SELECTED_INDEX_DATA_KEY,
  BENNE_GUI_LIST_BOX_SET_ROW_TEXT_DATA_KEY,
  BENNE_GUI_LIST_BOX_SET_SELECTED_INDEX_DATA_KEY,
  type BenneGuiListBoxSetRowTextFn,
  type BenneGuiListBoxSetSelectedIndexFn,
} from './guiListBoxRuntime';

const manifest = gameFontsManifest as GameFontsManifest;

const GUI_LIST_BOX_BG_DEPTH = 0;
const GUI_LIST_BOX_TEXT_DEPTH = 2;
const GUI_LIST_BOX_OUTLINE_DEPTH = 1;
const GUI_LIST_BOX_TEXT_PADDING_X = 4;
const GUI_LIST_BOX_DOUBLE_CLICK_MS = 300;

export interface BuiltGuiListBox {
  readonly hitTarget: Phaser.GameObjects.Container;
  readonly rowBackgrounds: readonly Phaser.GameObjects.Rectangle[];
  readonly rowTexts: readonly Phaser.GameObjects.BitmapText[];
  readonly rowTextOutlines: ReadonlyArray<readonly Phaser.GameObjects.BitmapText[]>;
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

function effectiveBitmapFontRenderSize(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  const entry = scene.cache.bitmapFont.get(fontKey) as { data?: { size?: number } } | null;
  const dataSize = entry?.data?.size;
  if (dataSize == null || dataSize === 0) {
    return fontSize;
  }
  return dataSize < 0 ? -Math.abs(fontSize) : Math.abs(fontSize);
}

function pickAnyLoadedBitmapFont(scene: Phaser.Scene): string | null {
  for (const key of Object.keys(manifest)) {
    if (scene.cache.bitmapFont.exists(key)) {
      return key;
    }
  }
  return null;
}

function createGuiBitmapTextOutlines(
  scene: Phaser.Scene,
  main: Phaser.GameObjects.BitmapText,
  outline: GuiTextOutline | undefined,
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
    o.setDepth(GUI_LIST_BOX_OUTLINE_DEPTH);
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

function pointerRowIndex(
  pointer: Phaser.Input.Pointer,
  hitTarget: Phaser.GameObjects.Container,
  rowCount: number,
  rowHeight: number,
  rowPadding: number,
): number {
  const matrix = hitTarget.getWorldTransformMatrix();
  const local = matrix.applyInverse(pointer.worldX, pointer.worldY);
  if (local.x < 0 || local.y < 0) {
    return -1;
  }
  const stride = rowHeight + rowPadding;
  if (stride <= 0) {
    return -1;
  }
  const idx = Math.floor(local.y / stride);
  if (idx < 0 || idx >= rowCount) {
    return -1;
  }
  const inRowTop = idx * stride;
  if (local.y >= inRowTop + rowHeight) {
    return -1;
  }
  return idx;
}

export function buildGuiListBox(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiListBoxControl,
  baseDepth: number,
  startVisible: boolean,
  isInputSuppressed?: () => boolean,
): BuiltGuiListBox | null {
  const id = c.id.trim();
  const rowCount = Math.max(1, Math.floor(c.rowCount));
  if (!id || c.width <= 0 || c.height <= 0 || rowCount <= 0) {
    return null;
  }

  const px = Math.round(c.x);
  const py = Math.round(c.y);
  const w = Math.round(c.width);
  const h = Math.round(c.height);
  const rowPadding = Math.max(0, Math.floor(c.rowPadding ?? 0));
  const derivedRowHeight = Math.floor((h - rowPadding * (rowCount - 1)) / rowCount);
  const rowHeight = Math.max(1, Math.floor(c.rowHeight ?? derivedRowHeight));

  const authoredFont = (c.font ?? '').trim();
  let fontKey: string | null = null;
  if (authoredFont.length > 0) {
    if (!scene.cache.bitmapFont.exists(authoredFont)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Benne] GUI "${gui.id}" listBox "${id}" uses unknown bitmap font "${authoredFont}".`,
        );
      }
      return null;
    }
    fontKey = authoredFont;
  } else {
    fontKey = pickAnyLoadedBitmapFont(scene);
    if (!fontKey) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] GUI "${gui.id}" listBox "${id}" needs a loaded bitmap font.`);
      }
      return null;
    }
  }
  const fontEntry = manifest[fontKey] as GameBitmapFontDefinition | undefined;
  if (!fontEntry) {
    return null;
  }

  const rowTextColor = hexStringToTint(c.textColor);
  const rowSelectedTextColor = hexStringToTint(c.selectedTextColor);
  const rowPlaceholderTextColor = hexStringToTint(c.placeholderTextColor);
  const rowNormalBg = hexStringToTint(c.normalBackgroundColor);
  const rowHoverBg = hexStringToTint(c.hoverBackgroundColor);
  const rowSelectedBg = hexStringToTint(c.selectedBackgroundColor);
  const derivedRowFontSize = Math.max(1, Math.min(rowHeight - 2, 12));
  const rowFontSize =
    Number.isFinite(c.fontSize) && c.fontSize >= 1
      ? Math.floor(c.fontSize)
      : derivedRowFontSize;
  const renderSize = effectiveBitmapFontRenderSize(scene, fontKey, rowFontSize);

  let enabled = c.enabled !== false;
  let selectedIndex = -1;
  let hoverIndex = -1;
  let focused = false;
  let lastClickAt = 0;
  let lastClickIndex = -1;
  const rowTextsData = Array.from({ length: rowCount }, () => '');

  const overlayVisible = startVisible && c.visible !== false;
  const z = c.zIndex ?? 0;
  const d = baseDepth + z;

  const hitTarget = scene.add.container(px, py);
  hitTarget.setScrollFactor(0, 0);
  hitTarget.setDepth(d);
  hitTarget.setVisible(overlayVisible);
  hitTarget.setData(BENNE_GUI_LIST_BOX_DATA_KEY, true);

  const rowBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  const rowTexts: Phaser.GameObjects.BitmapText[] = [];
  const rowTextOutlines: Phaser.GameObjects.BitmapText[][] = [];
  const textOutline = (c as GuiListBoxControl & { textOutline?: GuiTextOutline }).textOutline;

  for (let row = 0; row < rowCount; row += 1) {
    const y = row * (rowHeight + rowPadding);
    const bg = scene.add.rectangle(0, y, w, rowHeight, rowNormalBg, 1);
    bg.setOrigin(0, 0);
    bg.setDepth(GUI_LIST_BOX_BG_DEPTH);
    hitTarget.add(bg);
    rowBackgrounds.push(bg);

    const text = scene.add.bitmapText(
      GUI_LIST_BOX_TEXT_PADDING_X,
      y + Math.round(rowHeight / 2),
      fontKey,
      '',
      renderSize,
      0,
    );
    text.setOrigin(0, 0.5);
    text.setScrollFactor(0, 0);
    text.setDepth(GUI_LIST_BOX_TEXT_DEPTH);
    const maxWidth = Math.max(0, w - GUI_LIST_BOX_TEXT_PADDING_X * 2);
    if (maxWidth > 0) {
      text.setMaxWidth(maxWidth);
    }
    const letterSpacing = fontEntry.defaultLetterSpacing ?? 0;
    if (letterSpacing !== 0) {
      text.setLetterSpacing(letterSpacing);
    }
    const outlines = createGuiBitmapTextOutlines(scene, text, textOutline, overlayVisible);
    for (const o of outlines) {
      hitTarget.add(o);
    }
    hitTarget.add(text);
    rowTexts.push(text);
    rowTextOutlines.push(outlines);
  }

  const emitSelectionChanged = (newIndex: number, oldIndex: number): void => {
    gameEvents.emit(guiListBoxSelectionChangedEventId(gui.id, id), {
      newIndex,
      oldIndex,
    } satisfies GuiListBoxSelectionChangedPayload);
  };
  const emitItemActivated = (index: number): void => {
    gameEvents.emit(guiListBoxItemActivatedEventId(gui.id, id), {
      index,
    } satisfies GuiListBoxItemActivatedPayload);
  };

  const refreshInteractivity = (): void => {
    hitTarget.disableInteractive();
    if (hitTarget.visible && enabled) {
      applyGuiButtonInteractivity(hitTarget, w, h, true);
    }
  };

  const setSelectedIndexInternal = (next: number, emitEvent: boolean): void => {
    const clamped = next >= 0 && next < rowCount ? Math.floor(next) : -1;
    if (clamped === selectedIndex) {
      return;
    }
    const oldIndex = selectedIndex;
    selectedIndex = clamped;
    refreshVisualState();
    if (emitEvent) {
      emitSelectionChanged(selectedIndex, oldIndex);
    }
  };

  const setRowTextInternal = (index: number, text: string): void => {
    if (index < 0 || index >= rowCount) {
      return;
    }
    rowTextsData[index] = String(text ?? '');
    syncOutlinedGuiBitmapTextAll(rowTexts[index]!, rowTextsData[index]!);
    refreshVisualState();
  };

  function refreshVisualState(): void {
    for (let i = 0; i < rowCount; i += 1) {
      const isSelected = i === selectedIndex;
      const isHover = !isSelected && enabled && i === hoverIndex;
      const bg = rowBackgrounds[i]!;
      const text = rowTexts[i]!;
      const rowValue = rowTextsData[i] ?? '';
      const isPlaceholder = rowValue.length === 0;
      const bgTint = isSelected ? rowSelectedBg : isHover ? rowHoverBg : rowNormalBg;
      const textTint = isSelected
        ? rowSelectedTextColor
        : isPlaceholder
          ? rowPlaceholderTextColor
          : rowTextColor;
      bg.setFillStyle(bgTint, 1);
      applyGuiBitmapTextFillTint(text, textTint);
      text.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, textTint);
      syncOutlinedGuiBitmapTextPositions(text);
      const alpha = enabled ? 1 : 0.45;
      bg.setAlpha(alpha);
      text.setAlpha(alpha);
      for (const o of rowTextOutlines[i] ?? []) {
        o.setAlpha(alpha);
      }
    }
  }

  hitTarget.setData(BENNE_GUI_LIST_BOX_SET_SELECTED_INDEX_DATA_KEY, ((index: number) => {
    setSelectedIndexInternal(index, false);
  }) satisfies BenneGuiListBoxSetSelectedIndexFn);
  hitTarget.setData(BENNE_GUI_LIST_BOX_READ_SELECTED_INDEX_DATA_KEY, () => selectedIndex);
  hitTarget.setData(BENNE_GUI_LIST_BOX_SET_ROW_TEXT_DATA_KEY, ((index: number, text: string) => {
    setRowTextInternal(index, text);
  }) satisfies BenneGuiListBoxSetRowTextFn);
  hitTarget.setData(BENNE_GUI_LIST_BOX_READ_ROW_COUNT_DATA_KEY, () => rowCount);

  hitTarget.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }
    hoverIndex = pointerRowIndex(pointer, hitTarget, rowCount, rowHeight, rowPadding);
    refreshVisualState();
  });
  hitTarget.on('pointerover', () => {
    refreshVisualState();
  });
  hitTarget.on('pointerout', () => {
    hoverIndex = -1;
    refreshVisualState();
  });
  hitTarget.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !pointer.leftButtonDown()) {
      return;
    }
    if (isInputSuppressed?.()) {
      return;
    }
    focused = true;
  });
  hitTarget.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!enabled || !hitTarget.visible || !pointer.leftButtonReleased()) {
      return;
    }
    if (isInputSuppressed?.()) {
      return;
    }
    const index = pointerRowIndex(pointer, hitTarget, rowCount, rowHeight, rowPadding);
    if (index < 0) {
      return;
    }
    setSelectedIndexInternal(index, true);
    const now = scene.time.now;
    if (lastClickIndex === index && now - lastClickAt <= GUI_LIST_BOX_DOUBLE_CLICK_MS) {
      emitItemActivated(index);
    }
    lastClickIndex = index;
    lastClickAt = now;
  });

  const onScenePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!focused) {
      return;
    }
    const matrix = hitTarget.getWorldTransformMatrix();
    const local = matrix.applyInverse(pointer.worldX, pointer.worldY);
    if (local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h) {
      return;
    }
    focused = false;
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!focused || !enabled || !hitTarget.visible) {
      return;
    }
    if (isInputSuppressed?.()) {
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    if (selectedIndex >= 0 && selectedIndex < rowCount) {
      emitItemActivated(selectedIndex);
    }
  };
  scene.input.on('pointerdown', onScenePointerDown);
  scene.input.keyboard?.on('keydown', onKeyDown);

  const dispose = (): void => {
    scene.input.off('pointerdown', onScenePointerDown);
    scene.input.keyboard?.off('keydown', onKeyDown);
  };

  hitTarget.once(Phaser.GameObjects.Events.DESTROY, dispose);
  refreshInteractivity();
  refreshVisualState();

  return {
    hitTarget,
    rowBackgrounds,
    rowTexts,
    rowTextOutlines,
    enabled,
    width: w,
    height: h,
    dispose,
  };
}
