import * as Phaser from 'phaser';
import type { GameSettingsDialog } from '../../types/game.js';
import type { Dialog, DialogOption } from '../../types/dialogue.js';
import type {
  GuiButtonControl,
  GuiControl,
  GuiData,
  GuiGridCellAlign,
  GuiGridControl,
  GuiImageControl,
} from '../../types/gui.js';
import type { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  addGuiImageSprite,
  buildGuiButton,
  measureGuiButtonTextBlockSize,
  wireGuiControlHoverEvents,
  type BuiltGuiButton,
} from '../gui/buildGuiOverlay.js';
import {
  alignBoxTopLeftInCell,
  layoutGuiGridTracks,
  parseGuiGridCellAlign,
} from '../gui/guiGridLayout.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import {
  readEffectiveDialogOptionEnabled,
  readEffectiveDialogOptionUsed,
} from './dialogOptionVariables.js';
import { dialogChoiceSyntheticButtonId } from '../events/dialogEvents.js';

export const DIALOG_CHOICE_GRID_ID = 'Option-Grid';
const TEMPLATE_BULLET_ID = 'Bullet';
const TEMPLATE_OPTION_ID = 'Dialog-Option';

function guiGameObjectGridLocalTopLeft(
  go: Phaser.GameObjects.GameObject,
  gridContainer: Phaser.GameObjects.Container,
  gridDef: GuiGridControl,
): { x: number; y: number } {
  const p = go as unknown as {
    x: number;
    y: number;
    parentContainer?: Phaser.GameObjects.Container | null;
    displayOriginX?: number;
    displayOriginY?: number;
  };
  const inGrid = p.parentContainer === gridContainer;
  const gx = Math.round(gridDef.x);
  const gy = Math.round(gridDef.y);
  let x = inGrid ? p.x : p.x - gx;
  let y = inGrid ? p.y : p.y - gy;
  if (Number.isFinite(p.displayOriginX) && Number.isFinite(p.displayOriginY)) {
    x -= p.displayOriginX ?? 0;
    y -= p.displayOriginY ?? 0;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/** Pixels kept clear above internal canvas bottom so option paging matches on-screen fold, not authored grid bbox. */
export const DIALOG_CHOICE_VIEWPORT_BOTTOM_MARGIN_PX = 4;

/** Extra vertical space around measured wrapped text inside one option row (both sides of the text block). */
const DIALOG_OPTION_ROW_TEXT_V_PAD_PX = 4;

/** Inner width for `setMaxWidth`: {@link buildGuiButton} uses 4px inset on left/right for labels. */
export function resolveDialogChoiceWordWrapInnerWidth(buttonDef: GuiButtonControl): number {
  return Math.max(2, Math.round(buttonDef.width) - 8);
}

/**
 * Dialog option geometry using **integer-rounded** authored column widths (not fractional `normalizeGridTracks` totals).
 * Prevents column-2 placements from creeping left into the bullet gutter; trims text width to stay inside grid.
 */
export function computeDialogChoiceOptionColumnLayoutPx(gridDef: GuiGridControl | undefined, buttonDef: GuiButtonControl): {
  bulletColumnWidthPx: number;
  /** Left edge of the text/button column — immediately right of snapped bullet column. */
  textColumnLeftPx: number;
  textColumnWidthPx: number;
  optionButtonWidthPx: number;
} {
  const btnW = Math.max(1, Math.round(buttonDef.width));
  if (!gridDef) {
    return {
      bulletColumnWidthPx: 0,
      textColumnLeftPx: 0,
      textColumnWidthPx: btnW,
      optionButtonWidthPx: btnW,
    };
  }
  const track = layoutGuiGridTracks(gridDef);
  const cols = track.colWidths;
  const gridWInt = Math.max(1, Math.round(track.contentW));
  const n = cols.length;
  const c0snap = n >= 1 ? Math.max(1, Math.round(cols[0] ?? 0)) : 1;
  const textLeft = n >= 2 ? c0snap : 0;
  const rawTextW = n >= 2 ? Math.max(1, Math.round(cols[1] ?? 0)) : Math.max(1, gridWInt - textLeft);
  const textW = Math.max(1, Math.min(rawTextW, gridWInt - textLeft));
  const optionBtnW = Math.min(btnW, textW);

  return {
    bulletColumnWidthPx: c0snap,
    textColumnLeftPx: textLeft,
    textColumnWidthPx: textW,
    optionButtonWidthPx: Math.max(1, optionBtnW),
  };
}

/** @deprecated Prefer {@link computeDialogChoiceOptionColumnLayoutPx} — kept name for callers that only need width. */
export function resolveDialogChoiceTextColumnLayoutPx(
  gridDef: GuiGridControl | undefined,
  buttonDef: GuiButtonControl,
): { textColumnWidthPx: number; optionButtonWidthPx: number } {
  const c = computeDialogChoiceOptionColumnLayoutPx(gridDef, buttonDef);
  return { textColumnWidthPx: c.textColumnWidthPx, optionButtonWidthPx: c.optionButtonWidthPx };
}

/** `wordWrapWidth` passed to {@link buildGuiButton} / {@link measureGuiButtonTextBlockSize} for one option row. */
export function resolveDialogChoiceOptionWordWrapMaxPx(
  buttonDef: GuiButtonControl,
  optionButtonWidthPx: number,
): number {
  const innerCap = resolveDialogChoiceWordWrapInnerWidth({ ...buttonDef, width: Math.max(1, optionButtonWidthPx) });
  const auth = buttonDef.wordWrapWidth;
  if (auth != null && auth > 0) {
    return Math.min(auth, innerCap);
  }
  return innerCap;
}

/**
 * Resolved cap for choice option stacking: per-GUI override, then `game-config` `dialog` block.
 * Returns `undefined` when neither is set (extend to screen bottom).
 */
export function resolveDialogChoiceViewportHeightPx(
  guiData: Pick<GuiData, 'choiceOptionsViewportHeightPx'>,
  dialogSettings: Pick<GameSettingsDialog, 'choiceOptionsViewportHeightPx'>,
): number | undefined {
  const guiCap = guiData.choiceOptionsViewportHeightPx;
  if (typeof guiCap === 'number' && Number.isFinite(guiCap) && guiCap > 0) {
    return guiCap;
  }
  const configCap = dialogSettings.choiceOptionsViewportHeightPx;
  if (typeof configCap === 'number' && Number.isFinite(configCap) && configCap > 0) {
    return configCap;
  }
  return undefined;
}

/** Vertical space (px) available for dialog option rows under `Option-Grid`. */
export function getDialogChoiceAvailableHeightPx(
  gridDef: GuiGridControl | undefined,
  guiRootY: number,
  viewportBottomExclusivePx: number,
  maxViewportHeightPx?: number,
): number {
  const gridTop = Math.round(guiRootY + (gridDef?.y ?? 0));
  const toBottom = Math.max(
    0,
    viewportBottomExclusivePx - DIALOG_CHOICE_VIEWPORT_BOTTOM_MARGIN_PX - gridTop,
  );
  if (
    typeof maxViewportHeightPx === 'number' &&
    Number.isFinite(maxViewportHeightPx) &&
    maxViewportHeightPx > 0
  ) {
    return Math.min(toBottom, maxViewportHeightPx);
  }
  return toBottom;
}

/** Minimum option row height from the template (matches template button height when present). */
export function resolveDialogChoiceOptionRowHeightPx(
  gridDef: GuiGridControl | undefined,
  controls: readonly GuiControl[] | undefined,
): number {
  const btnDef = controls?.find(
    (c): c is GuiButtonControl => c.type === 'button' && c.id === TEMPLATE_OPTION_ID,
  );
  const fromButton =
    btnDef?.height !== undefined && Number.isFinite(btnDef.height) ? Math.round(btnDef.height) : 0;
  if (fromButton > 0) {
    return Math.max(1, fromButton);
  }
  if (!gridDef) {
    return 14;
  }
  const track = layoutGuiGridTracks(gridDef);
  return Math.max(1, Math.round(track.rowHeights[0] ?? 14));
}

function measureDialogChoiceRowHeightPx(
  scene: Phaser.Scene,
  buttonDef: GuiButtonControl,
  gridDef: GuiGridControl | undefined,
  controls: readonly GuiControl[] | undefined,
  optionText: string,
  wrapInnerWidth: number,
): number {
  const minRowH = resolveDialogChoiceOptionRowHeightPx(gridDef, controls);
  const { h } = measureGuiButtonTextBlockSize(
    scene,
    {
      font: buttonDef.font,
      fontSize: buttonDef.fontSize,
      text: optionText,
      textAlign: buttonDef.textAlign,
    },
    wrapInnerWidth,
  );
  return Math.max(minRowH, h + DIALOG_OPTION_ROW_TEXT_V_PAD_PX);
}

export type DialogChoiceOptionLayout = {
  option: DialogOption;
  topPx: number;
  heightPx: number;
};

/** One pixel slice of an option row visible in the current viewport window. */
export type DialogChoiceViewportSegment = {
  option: DialogOption;
  fullRowHeightPx: number;
  rowTopInViewportPx: number;
  clipTopPx: number;
  visibleHeightPx: number;
};

/** Cumulative layout of enabled options in list order (heights match drawn rows). */
export function measureDialogChoiceOptionsLayout(params: {
  scene: Phaser.Scene;
  gridDef: GuiGridControl | undefined;
  buttonDef: GuiButtonControl;
  controls: readonly GuiControl[] | undefined;
  visibleOptions: readonly DialogOption[];
  wrapInnerWidth: number;
}): { layouts: DialogChoiceOptionLayout[]; totalHeightPx: number } {
  const { scene, gridDef, buttonDef, controls, visibleOptions, wrapInnerWidth } = params;
  const layouts: DialogChoiceOptionLayout[] = [];
  let topPx = 0;
  for (const option of visibleOptions) {
    const heightPx = measureDialogChoiceRowHeightPx(
      scene,
      buttonDef,
      gridDef,
      controls,
      option.text,
      wrapInnerWidth,
    );
    layouts.push({ option, topPx, heightPx });
    topPx += heightPx;
  }
  return { layouts, totalHeightPx: topPx };
}

function clampDialogChoiceScrollTopPx(scrollTopPx: number, totalHeightPx: number, viewportH: number): number {
  const maxScroll = Math.max(0, totalHeightPx - viewportH);
  return Math.max(0, Math.min(Math.floor(scrollTopPx), maxScroll));
}

/**
 * Discrete scroll positions: each page fills the viewport (last page may be shorter).
 * Avoids line-by-line stops that split multi-line options awkwardly.
 */
export function computeDialogChoiceScrollPageStarts(
  totalHeightPx: number,
  viewportHeightPx: number,
): number[] {
  if (viewportHeightPx <= 0 || totalHeightPx <= viewportHeightPx + 1e-6) {
    return [0];
  }
  const maxScroll = Math.max(0, totalHeightPx - viewportHeightPx);
  const starts: number[] = [0];
  let pos = 0;
  while (pos < maxScroll - 1e-6) {
    pos = Math.min(Math.floor(pos + viewportHeightPx), maxScroll);
    if (starts[starts.length - 1] === pos) {
      break;
    }
    starts.push(pos);
  }
  return starts;
}

export function snapDialogChoiceScrollTopToPage(
  scrollTopPx: number,
  totalHeightPx: number,
  viewportHeightPx: number,
): number {
  const pages = computeDialogChoiceScrollPageStarts(totalHeightPx, viewportHeightPx);
  let idx = 0;
  for (let i = 0; i < pages.length; i += 1) {
    if (pages[i]! <= scrollTopPx + 0.5) {
      idx = i;
    }
  }
  return pages[idx] ?? 0;
}

export function advanceDialogChoiceScrollTopPx(
  scrollTopPx: number,
  deltaPages: number,
  totalHeightPx: number,
  viewportHeightPx: number,
): number {
  const pages = computeDialogChoiceScrollPageStarts(totalHeightPx, viewportHeightPx);
  if (pages.length === 0) {
    return 0;
  }
  let idx = 0;
  for (let i = 0; i < pages.length; i += 1) {
    if (pages[i]! <= scrollTopPx + 0.5) {
      idx = i;
    }
  }
  const nextIdx = Math.max(0, Math.min(idx + deltaPages, pages.length - 1));
  return pages[nextIdx]!;
}

/**
 * Slices the virtual option list to what fits in `[scrollTopPx, scrollTopPx + viewportH)`, including partial rows.
 */
export function layoutDialogChoiceViewportSegments(params: {
  scene: Phaser.Scene;
  gridDef: GuiGridControl | undefined;
  buttonDef: GuiButtonControl;
  controls: readonly GuiControl[] | undefined;
  visibleOptions: readonly DialogOption[];
  scrollTopPx: number;
  viewportAvailableHeightPx: number;
}): {
  segments: DialogChoiceViewportSegment[];
  clampedScrollTopPx: number;
  totalHeightPx: number;
} {
  const {
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    scrollTopPx,
    viewportAvailableHeightPx,
  } = params;

  const optionButtonWidthPx = Math.max(1, Math.round(buttonDef.width));
  const wrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, optionButtonWidthPx);
  const { layouts, totalHeightPx } = measureDialogChoiceOptionsLayout({
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    wrapInnerWidth: wrapPx,
  });

  if (layouts.length === 0 || viewportAvailableHeightPx <= 0) {
    return { segments: [], clampedScrollTopPx: 0, totalHeightPx };
  }

  const clampedScrollTopPx = snapDialogChoiceScrollTopToPage(
    clampDialogChoiceScrollTopPx(scrollTopPx, totalHeightPx, viewportAvailableHeightPx),
    totalHeightPx,
    viewportAvailableHeightPx,
  );
  const windowEnd = clampedScrollTopPx + viewportAvailableHeightPx;
  const segments: DialogChoiceViewportSegment[] = [];

  for (const { option, topPx, heightPx } of layouts) {
    const optionEnd = topPx + heightPx;
    const intersectStart = Math.max(clampedScrollTopPx, topPx);
    const intersectEnd = Math.min(windowEnd, optionEnd);
    if (intersectStart >= intersectEnd) {
      continue;
    }
    segments.push({
      option,
      fullRowHeightPx: heightPx,
      rowTopInViewportPx: intersectStart - clampedScrollTopPx,
      clipTopPx: intersectStart - topPx,
      visibleHeightPx: intersectEnd - intersectStart,
    });
  }

  if (segments.length === 0) {
    const first = layouts[0]!;
    const clipTop = Math.min(first.heightPx, clampedScrollTopPx);
    const visibleHeightPx = Math.min(first.heightPx - clipTop, viewportAvailableHeightPx);
    segments.push({
      option: first.option,
      fullRowHeightPx: first.heightPx,
      rowTopInViewportPx: 0,
      clipTopPx: clipTop,
      visibleHeightPx: Math.max(1, visibleHeightPx),
    });
  }

  return { segments, clampedScrollTopPx, totalHeightPx };
}

function sumAllDialogChoiceRowHeightsPx(
  scene: Phaser.Scene,
  gridDef: GuiGridControl | undefined,
  buttonDef: GuiButtonControl,
  controls: readonly GuiControl[] | undefined,
  visibleOptions: readonly DialogOption[],
  wrapInnerWidth: number,
): number {
  let s = 0;
  for (const o of visibleOptions) {
    s += measureDialogChoiceRowHeightPx(scene, buttonDef, gridDef, controls, o.text, wrapInnerWidth);
  }
  return s;
}

/** Whether every enabled option fits without scroll (total stacked height ≤ viewport). */
export function dialogChoiceAllOptionsFitInViewport(params: {
  scene: Phaser.Scene;
  gridDef: GuiGridControl | undefined;
  buttonDef: GuiButtonControl;
  controls: readonly GuiControl[] | undefined;
  visibleOptions: readonly DialogOption[];
  viewportAvailableHeightPx: number;
}): boolean {
  const { visibleOptions, viewportAvailableHeightPx } = params;
  if (visibleOptions.length === 0) {
    return true;
  }
  const optionButtonWidthPx = Math.max(1, Math.round(params.buttonDef.width));
  const wrapPx = resolveDialogChoiceOptionWordWrapMaxPx(params.buttonDef, optionButtonWidthPx);
  const total = sumAllDialogChoiceRowHeightsPx(
    params.scene,
    params.gridDef,
    params.buttonDef,
    params.controls,
    visibleOptions,
    wrapPx,
  );
  return total <= viewportAvailableHeightPx + 1e-6;
}

/** Scroll button visibility for variable-height option pages. */
export function getDialogChoiceScrollButtonState(params: {
  scene: Phaser.Scene;
  gridDef: GuiGridControl | undefined;
  buttonDef: GuiButtonControl | undefined;
  controls: readonly GuiControl[] | undefined;
  visibleOptions: readonly DialogOption[];
  scrollTopPx: number;
  guiRootY: number;
  viewportBottomExclusivePx: number;
  maxViewportHeightPx?: number;
}): { needScroll: boolean; showUp: boolean; showDown: boolean } {
  const {
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    scrollTopPx,
    guiRootY,
    viewportBottomExclusivePx,
    maxViewportHeightPx,
  } = params;

  if (!buttonDef || visibleOptions.length === 0) {
    return { needScroll: false, showUp: false, showDown: false };
  }

  const viewportH = getDialogChoiceAvailableHeightPx(
    gridDef,
    guiRootY,
    viewportBottomExclusivePx,
    maxViewportHeightPx,
  );

  const allFit = dialogChoiceAllOptionsFitInViewport({
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    viewportAvailableHeightPx: viewportH,
  });

  if (allFit) {
    return { needScroll: false, showUp: false, showDown: false };
  }

  const optionButtonWidthPx = Math.max(1, Math.round(buttonDef.width));
  const wrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, optionButtonWidthPx);
  const { totalHeightPx } = measureDialogChoiceOptionsLayout({
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    wrapInnerWidth: wrapPx,
  });
  const pages = computeDialogChoiceScrollPageStarts(totalHeightPx, viewportH);
  const clampedScrollTopPx = snapDialogChoiceScrollTopToPage(
    clampDialogChoiceScrollTopPx(scrollTopPx, totalHeightPx, viewportH),
    totalHeightPx,
    viewportH,
  );
  let pageIdx = 0;
  for (let i = 0; i < pages.length; i += 1) {
    if (pages[i] === clampedScrollTopPx) {
      pageIdx = i;
      break;
    }
  }

  return {
    needScroll: true,
    showUp: pageIdx > 0,
    showDown: pageIdx < pages.length - 1,
  };
}

export class DialogChoiceDynamicRowState {
  private readonly builtButtons: BuiltGuiButton[] = [];
  private readonly extraSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly hoverDisposers: Array<() => void> = [];
  private readonly controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly deferBelow: Phaser.GameObjects.GameObject[] = [];
  private viewportClipContainer: Phaser.GameObjects.Container | null = null;

  clear(): void {
    for (const d of this.hoverDisposers) {
      d();
    }
    this.hoverDisposers.length = 0;
    for (const b of this.builtButtons) {
      b.hitTarget.destroy(true);
    }
    this.builtButtons.length = 0;
    for (const s of this.extraSprites) {
      s.destroy();
    }
    this.extraSprites.length = 0;
    if (this.viewportClipContainer) {
      this.viewportClipContainer.destroy(true);
      this.viewportClipContainer = null;
    }
    this.controlsById.clear();
    this.deferBelow.length = 0;
  }

  hideTemplateRow(runtime: GuiRuntime): void {
    const bullet = runtime.getControl(TEMPLATE_BULLET_ID);
    const opt = runtime.getControl(TEMPLATE_OPTION_ID);
    bullet?.setVisible(false);
    opt?.setVisible(false);
  }

  /**
   * Duplicates the authored template row (bullet column + **`Dialog-Option`** column) once per visible option,
   * within the current scroll window. Uses the grid’s placement rules so additional rows stack like clones of row 0.
   */
  refresh(params: {
    scene: Phaser.Scene;
    gui: GuiData;
    baseDepth: number;
    gridContainer: Phaser.GameObjects.Container;
    guiRuntime: GuiRuntime;
    definition: Dialog;
    manager: GameStateManager;
    scrollTopPx: number;
    viewportAvailableHeightPx: number;
  }): number {
    this.clear();
    const {
      scene,
      gui,
      baseDepth,
      gridContainer,
      guiRuntime,
      definition,
      manager,
      scrollTopPx,
      viewportAvailableHeightPx,
    } = params;

    const gridDef = gui.controls?.find((c): c is GuiGridControl => c.type === 'grid' && c.id === DIALOG_CHOICE_GRID_ID);
    if (!gridDef) {
      return 0;
    }

    const bulletDef = gui.controls?.find((c): c is GuiImageControl => c.type === 'image' && c.id === TEMPLATE_BULLET_ID);
    const buttonDef = gui.controls?.find((c): c is GuiButtonControl => c.type === 'button' && c.id === TEMPLATE_OPTION_ID);
    if (!bulletDef || !buttonDef) {
      return 0;
    }

    const controls = gui.controls;
    const visibleOpts = definition.options.filter((o) => readEffectiveDialogOptionEnabled(manager, definition, o.id));
    if (visibleOpts.length === 0) {
      return 0;
    }

    const { segments: page, clampedScrollTopPx: off } = layoutDialogChoiceViewportSegments({
      scene,
      gridDef,
      buttonDef,
      controls,
      visibleOptions: visibleOpts,
      scrollTopPx,
      viewportAvailableHeightPx,
    });

    const gx = Math.round(gridDef.x);
    const gy = Math.round(gridDef.y);

    const colLayout = computeDialogChoiceOptionColumnLayoutPx(gridDef, buttonDef);
    const imgEstW = Math.max(4, colLayout.bulletColumnWidthPx);
    const templateOptionWidthPx = Math.max(1, Math.round(buttonDef.width));
    const templateOptionWrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, templateOptionWidthPx);
    const fallbackOptionWidthPx = colLayout.optionButtonWidthPx;
    const fallbackOptionWrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, fallbackOptionWidthPx);

    const tplOption = guiRuntime.getControl(TEMPLATE_OPTION_ID)?.gameObject;
    const tplOptionXY = tplOption != null ? guiGameObjectGridLocalTopLeft(tplOption, gridContainer, gridDef) : null;
    const useTemplateOptionAnchor =
      tplOptionXY != null && Number.isFinite(tplOptionXY.x) && Number.isFinite(tplOptionXY.y);

    const placeAnchoredContent = (
      cellX: number,
      cellY: number,
      cellW: number,
      cellH: number,
      contentW: number,
      contentH: number,
      align: GuiGridCellAlign | undefined,
      offsetX?: number,
      offsetY?: number,
    ): { localX: number; localY: number; rootTopLeft: { x: number; y: number } } => {
      const cw = Math.max(1, Math.round(cellW));
      const ch = Math.max(1, Math.round(cellH));
      const bw = Math.max(1, contentW);
      const bh = Math.max(1, contentH);
      const { hx, vy } = parseGuiGridCellAlign(align);
      const { dx, dy } = alignBoxTopLeftInCell(hx, vy, cw, ch, bw, bh);
      const offX = typeof offsetX === 'number' && Number.isFinite(offsetX) ? Math.round(offsetX) : 0;
      const offY = typeof offsetY === 'number' && Number.isFinite(offsetY) ? Math.round(offsetY) : 0;
      const localX = Math.round(cellX + dx + offX);
      const localY = Math.round(cellY + dy + offY);
      return { localX, localY, rootTopLeft: { x: gx + localX, y: gy + localY } };
    };

    const gridTrack = layoutGuiGridTracks(gridDef);
    const viewportClipW = Math.max(
      1,
      Math.round(gridTrack.contentW),
      colLayout.textColumnLeftPx + colLayout.textColumnWidthPx,
    );
    const viewportClip = scene.add.container(0, 0);
    viewportClip.setScrollFactor(0, 0);
    const viewportMask = scene.add.graphics();
    viewportMask.fillStyle(0xffffff);
    viewportMask.fillRect(0, 0, viewportClipW, viewportAvailableHeightPx);
    viewportMask.setVisible(false);
    viewportClip.add(viewportMask);
    viewportClip.setMask(viewportMask.createGeometryMask());
    gridContainer.add(viewportClip);
    this.viewportClipContainer = viewportClip;

    for (let i = 0; i < page.length; i += 1) {
      const { option: opt, fullRowHeightPx, rowTopInViewportPx, clipTopPx, visibleHeightPx } = page[i]!;
      const used = readEffectiveDialogOptionUsed(manager, definition, opt.id);

      let bulletLocalX: number;
      let bulletLocalY: number;
      let bulletRoot: { x: number; y: number };
      let btnLocalX: number;
      let btnLocalY: number;

      const contentShiftY = -clipTopPx;

      if (useTemplateOptionAnchor) {
        btnLocalX = Math.round(tplOptionXY!.x);
        btnLocalY = Math.round(rowTopInViewportPx + tplOptionXY!.y + contentShiftY);
      } else {
        const btnPlace = placeAnchoredContent(
          colLayout.textColumnLeftPx,
          rowTopInViewportPx,
          colLayout.textColumnWidthPx,
          visibleHeightPx,
          colLayout.optionButtonWidthPx,
          visibleHeightPx,
          buttonDef.gridPlacement?.align,
          buttonDef.gridPlacement?.offsetX,
          buttonDef.gridPlacement?.offsetY,
        );
        btnLocalX = btnPlace.localX;
        btnLocalY = btnPlace.localY + contentShiftY;
      }

      /** Bullet only when this option starts at the top of the slice (not a continuation from a prior page). */
      const showBullet = clipTopPx === 0;
      if (showBullet) {
        if (useTemplateOptionAnchor) {
          /**
           * Same layout as the hidden template row: bullet centered in column 0, vertically centered on the
           * option row (`backgroundAnchor: "center"` on the bullet image). Do not read `tplBullet.x` from
           * Phaser — that is the sprite anchor in built space and can sit near the grid horizontal center.
           */
          bulletLocalX = Math.round(btnLocalX - colLayout.bulletColumnWidthPx / 2);
          bulletLocalY = Math.round(rowTopInViewportPx + fullRowHeightPx / 2);
        } else {
          const bulletPlace = placeAnchoredContent(
            0,
            rowTopInViewportPx,
            colLayout.bulletColumnWidthPx,
            fullRowHeightPx,
            imgEstW,
            fullRowHeightPx,
            bulletDef.gridPlacement?.align,
            bulletDef.gridPlacement?.offsetX,
            bulletDef.gridPlacement?.offsetY,
          );
          bulletLocalX = bulletPlace.localX;
          bulletLocalY = bulletPlace.localY;
        }
        bulletRoot = { x: gx + bulletLocalX, y: gy + bulletLocalY };

        const spr = addGuiImageSprite(
          scene,
          gui,
          bulletDef,
          baseDepth,
          true,
          this.extraSprites,
          this.controlsById,
          this.deferBelow,
          useTemplateOptionAnchor
            ? {
                x: bulletLocalX,
                y: bulletLocalY,
                parent: viewportClip,
                screenRootTopLeft: bulletRoot,
              }
            : {
                x: bulletLocalX,
                y: bulletLocalY,
                parent: viewportClip,
                screenRootTopLeft: bulletRoot,
                gridContentBox: { w: imgEstW, h: fullRowHeightPx },
                gridCenterAlign: bulletDef.gridPlacement?.align === 'center',
              },
        );
        if (spr) {
          spr.disableInteractive();
          spr.setAlpha(used ? 0.45 : 1);
        }
      }

      const synId = dialogChoiceSyntheticButtonId(opt.id);
      const rowW = useTemplateOptionAnchor ? templateOptionWidthPx : fallbackOptionWidthPx;
      const rowWrap = useTemplateOptionAnchor ? templateOptionWrapPx : fallbackOptionWrapPx;
      const rowModel: GuiButtonControl = {
        ...buttonDef,
        id: synId,
        text: opt.text,
        width: rowW,
        height: fullRowHeightPx,
        wordWrapWidth: rowWrap,
        textOffsetX: buttonDef.textOffsetX ?? 0,
        x: btnLocalX,
        y: btnLocalY,
        enabled: true,
        gridPlacement: undefined,
      };
      const built = buildGuiButton(scene, gui, rowModel, baseDepth, true, undefined);
      if (!built) {
        continue;
      }
      viewportClip.add(built.hitTarget);
      if (clipTopPx > 0 || visibleHeightPx < fullRowHeightPx) {
        if (built.hitTarget.input) {
          built.hitTarget.disableInteractive();
          built.hitTarget.setInteractive(
            new Phaser.Geom.Rectangle(0, clipTopPx, rowW, visibleHeightPx),
            Phaser.Geom.Rectangle.Contains,
          );
        }
      }
      built.hitTarget.setAlpha(used ? 0.45 : 1);
      if (built.label) {
        built.label.setAlpha(used ? 0.45 : 1);
      }
      for (const lo of built.labelOutlines) {
        lo.setAlpha(used ? 0.45 : 1);
      }
      if (built.background) {
        built.background.setAlpha(used ? 0.45 : 1);
      }
      this.builtButtons.push(built);
      this.hoverDisposers.push(wireGuiControlHoverEvents(gui, synId, built.hitTarget));
    }

    return off;
  }
}
