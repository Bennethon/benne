import * as Phaser from 'phaser';
import type { Dialog } from '../../types/dialogue.js';
import type { GuiButtonControl, GuiData, GuiGridCellAlign, GuiGridControl, GuiImageControl } from '../../types/gui.js';
import type { GuiRuntime } from '../scripting/GuiRuntime.js';
import {
  addGuiImageSprite,
  buildGuiButton,
  wireGuiControlHoverEvents,
  type BuiltGuiButton,
} from '../gui/buildGuiOverlay.js';
import {
  alignBoxTopLeftInCell,
  cumulativeOffsets,
  layoutGuiGridTracks,
  parseGuiGridCellAlign,
  spanCellRect,
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

export class DialogChoiceDynamicRowState {
  private readonly builtButtons: BuiltGuiButton[] = [];
  private readonly extraSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly hoverDisposers: Array<() => void> = [];
  private readonly controlsById = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly deferBelow: Phaser.GameObjects.GameObject[] = [];
  private templateHidden = false;

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
    if (this.templateHidden) {
      return;
    }
    this.templateHidden = true;
    const bullet = runtime.getControl(TEMPLATE_BULLET_ID);
    const opt = runtime.getControl(TEMPLATE_OPTION_ID);
    bullet?.setVisible(false);
    opt?.setVisible(false);
  }

  /**
   * Rebuilds dynamic bullet + option button rows inside `Option-Grid` for the current scroll page.
   */
  refresh(params: {
    scene: Phaser.Scene;
    gui: GuiData;
    baseDepth: number;
    gridContainer: Phaser.GameObjects.Container;
    definition: Dialog;
    manager: GameStateManager;
    scrollOffset: number;
    pageSize: number;
  }): number {
    this.clear();
    const { scene, gui, baseDepth, gridContainer, definition, manager, scrollOffset, pageSize } = params;

    const gridDef = gui.controls?.find((c): c is GuiGridControl => c.type === 'grid' && c.id === DIALOG_CHOICE_GRID_ID);
    if (!gridDef) {
      return 0;
    }

    const bulletDef = gui.controls?.find((c): c is GuiImageControl => c.type === 'image' && c.id === TEMPLATE_BULLET_ID);
    const buttonDef = gui.controls?.find((c): c is GuiButtonControl => c.type === 'button' && c.id === TEMPLATE_OPTION_ID);
    if (!bulletDef || !buttonDef) {
      return 0;
    }

    const visibleOpts = definition.options.filter((o) => readEffectiveDialogOptionEnabled(manager, definition, o.id));
    const maxOffset = Math.max(0, visibleOpts.length - pageSize);
    const off = Math.max(0, Math.min(scrollOffset, maxOffset));
    const page = visibleOpts.slice(off, off + pageSize);
    const numRows = Math.max(1, page.length);

    const track = layoutGuiGridTracks(gridDef);
    const rowH0 = track.rowHeights[0] ?? 14;
    const rowHeights = Array.from({ length: numRows }, () => rowH0);
    const rowOff = cumulativeOffsets(rowHeights);
    const colOff = cumulativeOffsets(track.colWidths);

    const gx = Math.round(gridDef.x);
    const gy = Math.round(gridDef.y);

    const placeCell = (
      row: number,
      col: number,
      contentW: number,
      contentH: number,
      align: GuiGridCellAlign | undefined,
    ): { localX: number; localY: number; rootTopLeft: { x: number; y: number } } | null => {
      const cell = spanCellRect(colOff, rowOff, track.colWidths, rowHeights, col, row, 1, 1);
      if (!cell) {
        return null;
      }
      const bw = Math.max(1, contentW);
      const bh = Math.max(1, contentH);
      const { hx, vy } = parseGuiGridCellAlign(align);
      const { dx, dy } = alignBoxTopLeftInCell(hx, vy, cell.w, cell.h, bw, bh);
      const localX = Math.round(cell.x + dx);
      const localY = Math.round(cell.y + dy);
      return { localX, localY, rootTopLeft: { x: gx + localX, y: gy + localY } };
    };

    const imgEstW = Math.max(4, track.colWidths[0] ?? 10);
    const imgEstH = rowH0;

    for (let i = 0; i < page.length; i += 1) {
      const opt = page[i]!;
      const row = i;
      const used = readEffectiveDialogOptionUsed(manager, definition, opt.id);

      const bulletPlace = placeCell(row, 0, imgEstW, imgEstH, bulletDef.gridPlacement?.align);
      if (bulletPlace) {
        const spr = addGuiImageSprite(
          scene,
          gui,
          bulletDef,
          baseDepth + (bulletDef.zIndex ?? 0),
          true,
          this.extraSprites,
          this.controlsById,
          this.deferBelow,
          {
            x: bulletPlace.localX,
            y: bulletPlace.localY,
            parent: gridContainer,
            screenRootTopLeft: bulletPlace.rootTopLeft,
            gridContentBox: { w: imgEstW, h: imgEstH },
            gridCenterAlign: bulletDef.gridPlacement?.align === 'center',
          },
        );
        if (spr) {
          spr.disableInteractive();
          spr.setAlpha(used ? 0.45 : 1);
        }
      }

      const btnPlace = placeCell(row, 1, buttonDef.width, buttonDef.height, buttonDef.gridPlacement?.align);
      if (!btnPlace) {
        continue;
      }

      const synId = dialogChoiceSyntheticButtonId(opt.id);
      const rowModel: GuiButtonControl = {
        ...buttonDef,
        id: synId,
        text: opt.text,
        x: btnPlace.localX,
        y: btnPlace.localY,
        enabled: true,
        gridPlacement: undefined,
      };
      const built = buildGuiButton(scene, gui, rowModel, baseDepth, true, undefined, btnPlace.rootTopLeft);
      if (!built) {
        continue;
      }
      gridContainer.add(built.hitTarget);
      built.hitTarget.setAlpha(used ? 0.45 : 1);
      if (built.label) {
        built.label.setAlpha(used ? 0.45 : 1);
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

export function computeDialogChoicePageSize(gridDef: GuiGridControl | undefined): number {
  if (!gridDef) {
    return 4;
  }
  const track = layoutGuiGridTracks(gridDef);
  const rowH = track.rowHeights[0] ?? 14;
  const gh = track.contentH;
  const n = Math.max(1, Math.floor(gh / Math.max(1, rowH)));
  return n;
}
