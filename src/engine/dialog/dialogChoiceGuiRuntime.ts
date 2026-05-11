import * as Phaser from 'phaser';
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
import { guiTextLineSetAlpha } from '../gui/guiTextSurface.js';
import {
  alignBoxTopLeftInCell,
  cumulativeOffsets,
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

/** Vertical space (px) available for dialog option rows under `Option-Grid`. */
export function getDialogChoiceAvailableHeightPx(
  gridDef: GuiGridControl | undefined,
  guiRootY: number,
  viewportBottomExclusivePx: number,
): number {
  const gridTop = Math.round(guiRootY + (gridDef?.y ?? 0));
  return Math.max(
    0,
    viewportBottomExclusivePx - DIALOG_CHOICE_VIEWPORT_BOTTOM_MARGIN_PX - gridTop,
  );
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

export type DialogChoicePackedRow = {
  option: DialogOption;
  rowHeightPx: number;
};

/**
 * Fills the viewport with whole options starting at `scrollOffset`, using per-option height (wrapped text).
 */
export function packDialogChoiceOptionRows(params: {
  scene: Phaser.Scene;
  gridDef: GuiGridControl | undefined;
  buttonDef: GuiButtonControl;
  controls: readonly GuiControl[] | undefined;
  visibleOptions: readonly DialogOption[];
  scrollOffset: number;
  viewportAvailableHeightPx: number;
}): { rows: DialogChoicePackedRow[]; clampedScrollOffset: number } {
  const {
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    scrollOffset,
    viewportAvailableHeightPx,
  } = params;

  const n = visibleOptions.length;
  if (n === 0) {
    return { rows: [], clampedScrollOffset: 0 };
  }

  /** Match template `Dialog-Option` width / wrap used by {@link buildGuiOverlay} so row heights match drawn rows. */
  const optionButtonWidthPx = Math.max(1, Math.round(buttonDef.width));
  const wrapPx = resolveDialogChoiceOptionWordWrapMaxPx(buttonDef, optionButtonWidthPx);
  const start = Math.max(0, Math.min(Math.floor(scrollOffset), n - 1));

  let yAcc = 0;
  const rows: DialogChoicePackedRow[] = [];

  for (let i = start; i < n; i += 1) {
    const option = visibleOptions[i]!;
    const rowH = measureDialogChoiceRowHeightPx(
      scene,
      buttonDef,
      gridDef,
      controls,
      option.text,
      wrapPx,
    );
    if (yAcc + rowH > viewportAvailableHeightPx && rows.length > 0) {
      break;
    }
    rows.push({ option, rowHeightPx: rowH });
    yAcc += rowH;
  }

  if (rows.length === 0) {
    const option = visibleOptions[start]!;
    const rowH = measureDialogChoiceRowHeightPx(
      scene,
      buttonDef,
      gridDef,
      controls,
      option.text,
      wrapPx,
    );
    rows.push({ option, rowHeightPx: rowH });
  }

  return { rows, clampedScrollOffset: start };
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
  scrollOffset: number;
  guiRootY: number;
  viewportBottomExclusivePx: number;
}): { needScroll: boolean; showUp: boolean; showDown: boolean } {
  const {
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    scrollOffset,
    guiRootY,
    viewportBottomExclusivePx,
  } = params;

  if (!buttonDef || visibleOptions.length === 0) {
    return { needScroll: false, showUp: false, showDown: false };
  }

  const viewportH = getDialogChoiceAvailableHeightPx(gridDef, guiRootY, viewportBottomExclusivePx);
  const n = visibleOptions.length;
  const clamped = Math.max(0, Math.min(Math.floor(scrollOffset), n - 1));

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

  const { rows } = packDialogChoiceOptionRows({
    scene,
    gridDef,
    buttonDef,
    controls,
    visibleOptions,
    scrollOffset: clamped,
    viewportAvailableHeightPx: viewportH,
  });

  const last = visibleOptions[n - 1]!;
  const pageShowsLast = rows.some((r) => r.option.id === last.id);

  return {
    needScroll: true,
    showUp: clamped > 0,
    showDown: !pageShowsLast,
  };
}

export class DialogChoiceDynamicRowState {
  private readonly builtButtons: BuiltGuiButton[] = [];
  private readonly extraSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly hoverDisposers: Array<() => void> = [];
  private readonly controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly deferBelow: Phaser.GameObjects.GameObject[] = [];

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
    scrollOffset: number;
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
      scrollOffset,
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

    const { rows: page, clampedScrollOffset: off } = packDialogChoiceOptionRows({
      scene,
      gridDef,
      buttonDef,
      controls,
      visibleOptions: visibleOpts,
      scrollOffset,
      viewportAvailableHeightPx,
    });

    const rowHeights = page.map((p) => p.rowHeightPx);
    const rowOff = cumulativeOffsets(rowHeights);

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
    ): { localX: number; localY: number; rootTopLeft: { x: number; y: number } } => {
      const cw = Math.max(1, Math.round(cellW));
      const ch = Math.max(1, Math.round(cellH));
      const bw = Math.max(1, contentW);
      const bh = Math.max(1, contentH);
      const { hx, vy } = parseGuiGridCellAlign(align);
      const { dx, dy } = alignBoxTopLeftInCell(hx, vy, cw, ch, bw, bh);
      const localX = Math.round(cellX + dx);
      const localY = Math.round(cellY + dy);
      return { localX, localY, rootTopLeft: { x: gx + localX, y: gy + localY } };
    };

    for (let i = 0; i < page.length; i += 1) {
      const { option: opt, rowHeightPx } = page[i]!;
      const row = i;
      const rowTop = rowOff[row] ?? 0;
      const used = readEffectiveDialogOptionUsed(manager, definition, opt.id);

      let bulletLocalX: number;
      let bulletLocalY: number;
      let bulletRoot: { x: number; y: number };
      let btnLocalX: number;
      let btnLocalY: number;

      if (useTemplateOptionAnchor) {
        btnLocalX = Math.round(tplOptionXY!.x);
        btnLocalY = Math.round(rowTop + tplOptionXY!.y);
      } else {
        const btnPlace = placeAnchoredContent(
          colLayout.textColumnLeftPx,
          rowTop,
          colLayout.textColumnWidthPx,
          rowHeightPx,
          colLayout.optionButtonWidthPx,
          rowHeightPx,
          buttonDef.gridPlacement?.align,
        );
        btnLocalX = btnPlace.localX;
        btnLocalY = btnPlace.localY;
      }

      if (useTemplateOptionAnchor) {
        /** Keep bullet centered in column 0 relative to the resolved option-column x. */
        bulletLocalX = Math.round(btnLocalX - colLayout.textColumnLeftPx / 2);
        bulletLocalY = Math.round(rowTop + rowHeightPx / 2);
        bulletRoot = { x: gx + bulletLocalX, y: gy + bulletLocalY };
      } else {
        const bulletPlace = placeAnchoredContent(
          0,
          rowTop,
          colLayout.bulletColumnWidthPx,
          rowHeightPx,
          imgEstW,
          rowHeightPx,
          bulletDef.gridPlacement?.align,
        );
        bulletLocalX = bulletPlace.localX;
        bulletLocalY = bulletPlace.localY;
        bulletRoot = bulletPlace.rootTopLeft;
      }

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
              parent: gridContainer,
              screenRootTopLeft: bulletRoot,
            }
          : {
              x: bulletLocalX,
              y: bulletLocalY,
              parent: gridContainer,
              screenRootTopLeft: bulletRoot,
              gridContentBox: { w: imgEstW, h: rowHeightPx },
              gridCenterAlign: bulletDef.gridPlacement?.align === 'center',
            },
      );
      if (spr) {
        spr.disableInteractive();
        spr.setAlpha(used ? 0.45 : 1);
      }

      const synId = dialogChoiceSyntheticButtonId(opt.id);
      const rowW = useTemplateOptionAnchor ? templateOptionWidthPx : fallbackOptionWidthPx;
      const rowWrap = useTemplateOptionAnchor ? templateOptionWrapPx : fallbackOptionWrapPx;
      const rowModel: GuiButtonControl = {
        ...buttonDef,
        id: synId,
        text: opt.text,
        width: rowW,
        height: rowHeightPx,
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
      gridContainer.add(built.hitTarget);
      built.hitTarget.setAlpha(used ? 0.45 : 1);
      if (built.labelLine) {
        guiTextLineSetAlpha(built.labelLine, used ? 0.45 : 1);
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
