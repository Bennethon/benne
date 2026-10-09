import * as Phaser from 'phaser';
import { BENNE_AUDIO_SCRIPT_DISABLED_KEY } from '../../engine/sound/benneSoundRegistry';
import { BENNE_VIDEO_SCRIPT_DISABLED_KEY } from '../../engine/video/benneVideoRegistry';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { getBenneRendererConfigFields } from '../../engine/gameConfig';
import { buildGuiOverlay, GUI_TEXT_OVERLAY_DEPTH } from '../../engine/gui/buildGuiOverlay';
import type { BuiltGuiOverlay } from '../../engine/gui/buildGuiOverlay';
import { syncOutlinedGuiBitmapTextPositions } from '../../engine/gui/guiTextOutline';
import {
  buildGuiGridLayoutRuntimeMap,
  cumulativeOffsets,
  isGuiGridPlacement,
  layoutGuiGridTracks,
  resolveGuiControlRootTopLeft,
  spanCellRect,
} from '../../engine/gui/guiGridLayout';
import type { GuiControl, GuiData, GuiGridControl, GuiInventoryPanelControl } from '../../types/gui';
import {
  PreviewPolygonOverlay,
  type PreviewStrokeRectOverlayExtras,
} from './previewPolygonOverlay';
import {
  applyMoveGizmoDelta,
  hitMoveGizmo,
  type MoveGizmoPart,
} from './previewMoveGizmo';
import { guiPreviewSelectBridge } from './guiPreviewSelectBridge';
import {
  buildInitialInventoryByCharacter,
  normalizeSerializedInventory,
} from '../../engine/gameState/characterInventory';
import { GameStateManager } from '../../engine/gameState/GameStateManager';
import { getStartingPlayerCharacterId } from '../../engine/content/constants';
import { BENNE_GAME_STATE_REGISTRY_KEY } from '../../engine/gameState/registryKey';
import {
  guiHasButtonControls,
  guiHasCheckboxControls,
  guiHasGridControls,
  guiHasImageControls,
  guiHasTextControls,
  guiHasTriggerControls,
  type GuiFontLoadRequest,
} from '../../engine/content/collectFontLoadsForGui';
import type { GameSettingsInitialGameState } from '../../types/game';
import { resolveGameStateManager, setActiveGameStateManager } from '../../engine/gameState/resolveGameStateManager';
import {
  wireBenneVerbContextGameStateRelay,
  unwireBenneVerbContextGameStateRelay,
} from '../../engine/verbs/verbContext';

const BOOT = 'BenneGuiPreviewBoot';
const PREVIEW = 'BenneGuiPreview';

export type GuiPreviewAsepritePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
};

export type GuiPreviewGamePayload = {
  guiData: GuiData;
  fontLoads: GuiFontLoadRequest[];
  internalWidth: number;
  internalHeight: number;
  revokeObjectUrls: string[];
  /** On-disk-shaped sheet JSON (`meta.slices`) when the preview bundle has no Vite glob for this GUI. */
  previewGuiAsepriteSheetJson?: Record<string, unknown>;
  /** When set, loads and plays the Aseprite sheet; otherwise text-only preview. */
  aseprite: GuiPreviewAsepritePayload | null;
  /**
   * Same slice as `game-config.json` `initialGameState` — used so GUI inventory panels match runtime starting inventory.
   */
  previewInitialGameState?: GameSettingsInitialGameState;
  /**
   * When set, preloads the shared inventory sheet (`images/inventory/inventory.{png,json}`) for `inventoryPanel` icons.
   */
  sharedInventoryAseprite?: {
    textureKey: string;
    textureURL: string;
    atlasURL: string;
  } | null;
  /** Host URI of the `*.gui.json` being previewed (for position patches). */
  guiJsonUri?: string;
  /** Persist a control's authored x/y or grid offsets after a gizmo drag. */
  onControlPositionPatch?: (index: number, patch: Record<string, unknown>) => void;
};

function parseGuiControlKeyIndex(key: string): number | null {
  const i = key.lastIndexOf(':');
  if (i < 0) {
    return null;
  }
  const n = Number(key.slice(i + 1));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

type PositionableGo = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  setPosition(x: number, y: number): unknown;
  getWorldTransformMatrix?: () => { tx: number; ty: number };
};

function asPositionable(go: Phaser.GameObjects.GameObject | undefined): PositionableGo | null {
  if (!go) {
    return null;
  }
  const p = go as PositionableGo;
  if (typeof p.setPosition !== 'function' || typeof p.x !== 'number' || typeof p.y !== 'number') {
    return null;
  }
  return p;
}

function gameObjectWorldXY(go: PositionableGo): { x: number; y: number } {
  if (typeof go.getWorldTransformMatrix === 'function') {
    const m = go.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }
  return { x: go.x, y: go.y };
}

function syncMovedGuiRoot(go: Phaser.GameObjects.GameObject): void {
  if (go instanceof Phaser.GameObjects.BitmapText) {
    syncOutlinedGuiBitmapTextPositions(go);
    return;
  }
  const list = (go as Phaser.GameObjects.Container).list;
  if (!Array.isArray(list)) {
    return;
  }
  for (const child of list) {
    if (child instanceof Phaser.GameObjects.BitmapText) {
      syncOutlinedGuiBitmapTextPositions(child);
    }
  }
}

function authoredControlXY(c: GuiControl): { x: number; y: number } {
  if (c.type !== 'grid' && isGuiGridPlacement(c.gridPlacement)) {
    return {
      x: typeof c.gridPlacement.offsetX === 'number' && Number.isFinite(c.gridPlacement.offsetX) ? c.gridPlacement.offsetX : 0,
      y: typeof c.gridPlacement.offsetY === 'number' && Number.isFinite(c.gridPlacement.offsetY) ? c.gridPlacement.offsetY : 0,
    };
  }
  return { x: Math.round(c.x), y: Math.round(c.y) };
}

function applyAuthoredControlXY(c: GuiControl, x: number, y: number): Record<string, unknown> {
  if (c.type !== 'grid' && isGuiGridPlacement(c.gridPlacement)) {
    c.gridPlacement = { ...c.gridPlacement, offsetX: x, offsetY: y };
    return { gridPlacement: { ...c.gridPlacement } };
  }
  c.x = x;
  c.y = y;
  return { x, y };
}

function editorGameConfig(
  parent: HTMLElement,
  width: number,
  height: number,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    /** Renderer fields come from `getBenneRendererConfigFields` (`gameConfig.ts`) — keeps every
     * BENNE surface on the same Phaser renderer (see `benne-preview-rendering-parity.mdc`). */
    ...getBenneRendererConfigFields(),
    parent,
    width,
    height,
    /** GUI preview uses a solid black backdrop instead of the editor chrome colour so control
     * outlines and BitmapText read clearly at 1× zoom before `Scale.MAX_ZOOM`. */
    backgroundColor: '#000000',
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      width,
      height,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      /** Match runtime (`gameConfig.ts`): largest integer zoom that fits — avoids bilinear stretch blur. */
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
  };
}

class BenneGuiPreviewBoot extends Phaser.Scene {
  private readonly payload: GuiPreviewGamePayload;

  constructor(payload: GuiPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    for (const f of this.payload.fontLoads) {
      this.load.bitmapFont(f.fontId, f.textureUrl, f.dataUrl);
    }
    const a = this.payload.aseprite;
    if (a) {
      this.load.aseprite({
        key: a.textureKey,
        textureURL: a.textureURL,
        atlasURL: a.atlasURL,
      });
    }
    const inv = this.payload.sharedInventoryAseprite;
    if (inv) {
      this.load.aseprite({
        key: inv.textureKey,
        textureURL: inv.textureURL,
        atlasURL: inv.atlasURL,
      });
    }
  }

  create(): void {
    applyBootAudioSettings(this);
    const rawInit = this.payload.previewInitialGameState;
    const startingPlayer = getStartingPlayerCharacterId();
    const initial =
      rawInit != null
        ? {
            flags: rawInit.flags,
            variables: rawInit.variables,
            inventoryByCharacter: buildInitialInventoryByCharacter({
              inventoryByCharacter: rawInit.inventoryByCharacter,
              legacyInventory:
                rawInit.inventory !== undefined
                  ? normalizeSerializedInventory(rawInit.inventory)
                  : undefined,
              startingPlayerCharacterId: startingPlayer,
            }),
            activePlayerCharacterId: rawInit.activePlayerCharacterId ?? startingPlayer,
          }
        : undefined;
    const gameState = new GameStateManager(this.game.events, initial);
    this.game.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, gameState);
    setActiveGameStateManager(gameState);
    wireBenneVerbContextGameStateRelay(this.game.events);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      unwireBenneVerbContextGameStateRelay(this.game.events);
      setActiveGameStateManager(null);
    });
    this.scene.start(PREVIEW, this.payload);
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

const PREVIEW_RESOLUTION_LABEL_DEPTH = 100;
/** Above Aseprite sprite so authored text is readable in the editor. */
const PREVIEW_GUI_TEXT_DEPTH = Math.max(GUI_TEXT_OVERLAY_DEPTH, PREVIEW_RESOLUTION_LABEL_DEPTH + 1);

/** Same as `RoomPolygonEditScene` `LINE_WIDTH_CSS` — room preview polygon overlay stroke. */
const PREVIEW_OVERLAY_LINE_WIDTH_CSS = 2;
/** Same stroke as inventory slot outlines in this preview (`RoomPolygonEditScene`-style overlay). */
const GUI_PREVIEW_CONTROL_OUTLINE_STROKE = '#7dd3fc';
/** Semi-transparent pink fill for `trigger` hit zones in the editor GUI preview (runtime triggers are not drawn). */
const GUI_PREVIEW_TRIGGER_ZONE_FILL = 'rgba(255, 105, 180, 0.3)';

function guiHasInventoryPanel(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c): c is GuiInventoryPanelControl => c.type === 'inventoryPanel');
}

function guiHasSliderControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'slider');
}

function guiHasTextInputControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'textInput');
}

function collectButtonControlWorldRects(gui: GuiData): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  const caches = buildGuiGridLayoutRuntimeMap(gui.controls ?? []);
  for (const c of gui.controls ?? []) {
    if (c.type === 'button' || c.type === 'checkbox' || c.type === 'slider' || c.type === 'textInput') {
      const tl = resolveGuiControlRootTopLeft(
        caches,
        rootX,
        rootY,
        c.gridPlacement,
        c.width,
        c.height,
        c.x,
        c.y,
      );
      rects.push({
        left: tl.x,
        top: tl.y,
        right: tl.x + c.width,
        bottom: tl.y + c.height,
      });
    }
  }
  return rects;
}

function collectTriggerPreviewOverlayEntries(gui: GuiData): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
  label: string;
}> {
  const out: Array<{
    left: number;
    top: number;
    right: number;
    bottom: number;
    label: string;
  }> = [];
  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  const fixedControlIds = new Set(
    (gui.fixedControls ?? [])
      .map((fid) => String(fid).trim())
      .filter((fid) => fid.length > 0),
  );
  const caches = buildGuiGridLayoutRuntimeMap(gui.controls ?? []);
  for (const c of gui.controls ?? []) {
    if (c.type !== 'trigger') {
      continue;
    }
    const id = c.id?.trim() ?? '';
    if (!id || c.width <= 0 || c.height <= 0) {
      continue;
    }
    /** Match {@link buildGuiOverlay}: fixed controls are not offset by `guiContentRoot` (`gui.x` / `gui.y`). */
    const ox = fixedControlIds.has(id) ? 0 : rootX;
    const oy = fixedControlIds.has(id) ? 0 : rootY;
    const tl = resolveGuiControlRootTopLeft(
      caches,
      ox,
      oy,
      c.gridPlacement,
      c.width,
      c.height,
      c.x,
      c.y,
    );
    const w = c.width;
    const h = c.height;
    out.push({
      left: tl.x,
      top: tl.y,
      right: tl.x + w,
      bottom: tl.y + h,
      label: `${tl.x}, ${tl.y} · ${w}×${h}`,
    });
  }
  return out;
}

function collectGridCellOutlineRects(gui: GuiData): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  for (const c of gui.controls ?? []) {
    if (c.type !== 'grid') {
      continue;
    }
    const g = c as GuiGridControl;
    const layout = layoutGuiGridTracks(g);
    const colOff = cumulativeOffsets(layout.colWidths);
    const rowOff = cumulativeOffsets(layout.rowHeights);
    const gx = rootX + Math.round(g.x);
    const gy = rootY + Math.round(g.y);
    for (let row = 0; row < g.rows; row += 1) {
      for (let col = 0; col < g.columns; col += 1) {
        const cell = spanCellRect(colOff, rowOff, layout.colWidths, layout.rowHeights, col, row, 1, 1);
        if (!cell || cell.w <= 0 || cell.h <= 0) {
          continue;
        }
        const left = gx + cell.x;
        const top = gy + cell.y;
        rects.push({ left, top, right: left + cell.w, bottom: top + cell.h });
      }
    }
  }
  return rects;
}

function collectInventoryPanelSlotWorldRects(gui: GuiData, inventoryItemCount: number): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const rootX = Math.round(gui.x ?? 0);
  const rootY = Math.round(gui.y ?? 0);
  const caches = buildGuiGridLayoutRuntimeMap(gui.controls ?? []);
  for (const c of gui.controls ?? []) {
    if (c.type !== 'inventoryPanel') {
      continue;
    }
    const spacingX = c.spacingX ?? 0;
    const spacingY = c.spacingY ?? 0;
    const panelW = c.cols * c.slotWidth + Math.max(0, c.cols - 1) * spacingX;
    const panelH = c.rows * c.slotHeight + Math.max(0, c.rows - 1) * spacingY;
    const tl = resolveGuiControlRootTopLeft(
      caches,
      rootX,
      rootY,
      c.gridPlacement,
      panelW,
      panelH,
      c.x,
      c.y,
    );
    const px = tl.x;
    const py = tl.y;
    for (let row = 0; row < c.rows; row += 1) {
      for (let col = 0; col < c.cols; col += 1) {
        const slotIndex = row * c.cols + col;
        if (slotIndex >= inventoryItemCount && !c.showEmptySlots) {
          continue;
        }
        const slotX = col * (c.slotWidth + spacingX);
        const slotY = row * (c.slotHeight + spacingY);
        const left = px + slotX;
        const top = py + slotY;
        rects.push({ left, top, right: left + c.slotWidth, bottom: top + c.slotHeight });
      }
    }
  }
  return rects;
}

function collectBitmapTextControlWorldRects(scene: Phaser.Scene): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const obj of scene.children.list) {
    if (obj instanceof Phaser.GameObjects.BitmapText) {
      const gr = obj.getBounds();
      if (gr.width > 0 && gr.height > 0) {
        rects.push({ left: gr.x, top: gr.y, right: gr.x + gr.width, bottom: gr.y + gr.height });
      }
    }
  }
  return rects;
}

class GuiPreviewScene extends Phaser.Scene {
  private payload!: GuiPreviewGamePayload;
  private guiOutlineOverlay?: PreviewPolygonOverlay;
  /** Redraw outlines when the webview panel resizes (Phaser `scale.resize` alone may not fire). */
  private guiOutlineLayoutObserver?: ResizeObserver;
  private builtOverlay: BuiltGuiOverlay | null = null;
  private unsubSelect?: () => void;
  private dragGizmo: MoveGizmoPart | null = null;
  private gizmoOriginStart = { x: 0, y: 0 };
  private gizmoPointerStart = { x: 0, y: 0 };
  private gizmoRootStart = { x: 0, y: 0 };
  private gizmoAuthoredStart = { x: 0, y: 0 };
  private readonly refreshGuiOutlineBound = (): void => {
    this.refreshGuiOutlineOverlay();
  };

  constructor() {
    super(PREVIEW);
  }

  init(data: GuiPreviewGamePayload): void {
    this.payload = data;
  }

  create(): void {
    const { internalWidth, internalHeight, guiData } = this.payload;
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x000000);

    this.builtOverlay =
      buildGuiOverlay(this, guiData, {
        depth: PREVIEW_GUI_TEXT_DEPTH,
        startVisible: true,
        emptyTextPlaceholder: 'Lorem ipsum dolor sit amet.',
        previewGuiAsepriteSheetJson: this.payload.previewGuiAsepriteSheetJson,
      }) ?? null;

    this.add
      .text(8, 6, `${internalWidth}×${internalHeight} · game resolution`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#9aa3b8',
      })
      .setScrollFactor(0)
      .setDepth(PREVIEW_RESOLUTION_LABEL_DEPTH);

    const mount = this.game.canvas.parentElement;
    if (
      mount &&
      (guiHasInventoryPanel(guiData) ||
        guiHasTextControls(guiData) ||
        guiHasImageControls(guiData) ||
        guiHasButtonControls(guiData) ||
        guiHasCheckboxControls(guiData) ||
        guiHasSliderControls(guiData) ||
        guiHasTextInputControls(guiData) ||
        guiHasTriggerControls(guiData) ||
        guiHasGridControls(guiData))
    ) {
      this.guiOutlineOverlay = new PreviewPolygonOverlay(this.game, mount);
      this.guiOutlineOverlay.setPointerEventsEnabled(false);
      this.guiOutlineOverlay.canvas.addEventListener('pointerdown', this.onOverlayPointerDown);
      this.guiOutlineOverlay.canvas.addEventListener('pointermove', this.onOverlayPointerMove);
      this.guiOutlineOverlay.canvas.addEventListener('pointerup', this.onOverlayPointerUp);
      this.guiOutlineOverlay.canvas.addEventListener('pointercancel', this.onOverlayPointerUp);
      this.scale.on('resize', this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver = new ResizeObserver(this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver.observe(mount);
    }

    this.unsubSelect = guiPreviewSelectBridge.subscribe(() => {
      this.syncGizmoPointerEvents();
    });
    this.syncGizmoPointerEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubSelect?.();
      this.unsubSelect = undefined;
      this.scale.off('resize', this.refreshGuiOutlineBound);
      this.guiOutlineLayoutObserver?.disconnect();
      this.guiOutlineLayoutObserver = undefined;
      const ov = this.guiOutlineOverlay;
      if (ov) {
        ov.canvas.removeEventListener('pointerdown', this.onOverlayPointerDown);
        ov.canvas.removeEventListener('pointermove', this.onOverlayPointerMove);
        ov.canvas.removeEventListener('pointerup', this.onOverlayPointerUp);
        ov.canvas.removeEventListener('pointercancel', this.onOverlayPointerUp);
        ov.destroy();
      }
      this.guiOutlineOverlay = undefined;
      this.builtOverlay = null;
    });
  }

  /**
   * Match `RoomPolygonEditScene.update`: sync overlay layout then redraw each frame so strokes stay
   * aligned with the Phaser canvas (FIT / camera / DPR) the same way room collider outlines do.
   */
  update(): void {
    this.refreshGuiOutlineOverlay();
  }

  private selectedControlIndex(): number | null {
    return parseGuiControlKeyIndex(guiPreviewSelectBridge.selectedControlKey);
  }

  private selectedControl(): GuiControl | null {
    const idx = this.selectedControlIndex();
    if (idx === null) {
      return null;
    }
    return this.payload.guiData.controls?.[idx] ?? null;
  }

  private selectedRoot(): PositionableGo | null {
    const idx = this.selectedControlIndex();
    if (idx === null) {
      return null;
    }
    return asPositionable(this.builtOverlay?.controlRootsByIndex.get(idx));
  }

  private gizmoWorldOrigin(): { x: number; y: number } | null {
    const root = this.selectedRoot();
    if (root) {
      return gameObjectWorldXY(root);
    }
    const c = this.selectedControl();
    if (!c) {
      return null;
    }
    const gui = this.payload.guiData;
    const caches = buildGuiGridLayoutRuntimeMap(gui.controls ?? []);
    const id = 'id' in c && typeof c.id === 'string' ? c.id.trim() : '';
    const fixed = (gui.fixedControls ?? []).some((fid) => fid.trim() === id);
    const ox = fixed ? 0 : Math.round(gui.x ?? 0);
    const oy = fixed ? 0 : Math.round(gui.y ?? 0);
    return resolveGuiControlRootTopLeft(
      caches,
      ox,
      oy,
      c.type === 'grid' ? undefined : c.gridPlacement,
      1,
      1,
      c.x,
      c.y,
    );
  }

  private syncGizmoPointerEvents(): void {
    const on = this.selectedControlIndex() !== null;
    this.guiOutlineOverlay?.setPointerEventsEnabled(on);
  }

  private pointerCss(e: PointerEvent): { cx: number; cy: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  }

  private readonly onOverlayPointerDown = (e: PointerEvent): void => {
    const ov = this.guiOutlineOverlay;
    if (!ov || e.button !== 0) {
      return;
    }
    const origin = this.gizmoWorldOrigin();
    if (!origin) {
      return;
    }
    const { cx, cy } = this.pointerCss(e);
    const cssOrigin = ov.worldToCanvasCss(origin, this.cameras.main);
    const part = hitMoveGizmo(cx, cy, cssOrigin);
    if (!part) {
      return;
    }
    e.preventDefault();
    ov.canvas.setPointerCapture(e.pointerId);
    this.dragGizmo = part;
    this.gizmoOriginStart = { ...origin };
    const world = ov.domToWorld(e.pageX, e.pageY, this.cameras.main);
    this.gizmoPointerStart = { x: world.x, y: world.y };
    const root = this.selectedRoot();
    this.gizmoRootStart = root ? { x: root.x, y: root.y } : { x: 0, y: 0 };
    const c = this.selectedControl();
    this.gizmoAuthoredStart = c ? authoredControlXY(c) : { x: 0, y: 0 };
  };

  private readonly onOverlayPointerMove = (e: PointerEvent): void => {
    if (!this.dragGizmo || !this.guiOutlineOverlay) {
      return;
    }
    const world = this.guiOutlineOverlay.domToWorld(e.pageX, e.pageY, this.cameras.main);
    const next = applyMoveGizmoDelta(this.dragGizmo, this.gizmoOriginStart, this.gizmoPointerStart, world);
    const dx = Math.round(next.x - this.gizmoOriginStart.x);
    const dy = Math.round(next.y - this.gizmoOriginStart.y);
    const nx = this.gizmoAuthoredStart.x + dx;
    const ny = this.gizmoAuthoredStart.y + dy;
    const c = this.selectedControl();
    if (c) {
      applyAuthoredControlXY(c, nx, ny);
    }
    const root = this.selectedRoot();
    if (root) {
      root.setPosition(this.gizmoRootStart.x + dx, this.gizmoRootStart.y + dy);
      syncMovedGuiRoot(root);
    }
  };

  private readonly onOverlayPointerUp = (e: PointerEvent): void => {
    if (!this.dragGizmo) {
      return;
    }
    this.dragGizmo = null;
    try {
      this.guiOutlineOverlay?.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
    const idx = this.selectedControlIndex();
    const c = this.selectedControl();
    if (idx === null || !c) {
      return;
    }
    const authored = authoredControlXY(c);
    const patch = applyAuthoredControlXY(c, authored.x, authored.y);
    this.payload.onControlPositionPatch?.(idx, patch);
  };

  private refreshGuiOutlineOverlay(): void {
    const ov = this.guiOutlineOverlay;
    if (!ov) {
      return;
    }
    ov.syncLayout();
    let count = 0;
    try {
      count = resolveGameStateManager(this.game).getInventoryItems().length;
    } catch {
      count = 0;
    }
    const inventoryRects = collectInventoryPanelSlotWorldRects(this.payload.guiData, count);
    const textRects = guiHasTextControls(this.payload.guiData)
      ? collectBitmapTextControlWorldRects(this)
      : [];
    const buttonRects =
      guiHasButtonControls(this.payload.guiData) ||
      guiHasCheckboxControls(this.payload.guiData) ||
      guiHasSliderControls(this.payload.guiData) ||
      guiHasTextInputControls(this.payload.guiData)
        ? collectButtonControlWorldRects(this.payload.guiData)
        : [];
    const gridRects = guiHasGridControls(this.payload.guiData) ? collectGridCellOutlineRects(this.payload.guiData) : [];
    const outlineRects = inventoryRects.concat(textRects).concat(buttonRects).concat(gridRects);
    const triggerEntries = collectTriggerPreviewOverlayEntries(this.payload.guiData);
    const triggerExtras: PreviewStrokeRectOverlayExtras | undefined =
      triggerEntries.length > 0
        ? {
            filledUnderlays: [
              {
                rects: triggerEntries,
                fillStyle: GUI_PREVIEW_TRIGGER_ZONE_FILL,
                fillAlpha: 1,
              },
            ],
            rectCornerLabels: triggerEntries.map((e) => ({
              rect: { left: e.left, top: e.top, right: e.right, bottom: e.bottom },
              text: e.label,
            })),
          }
        : undefined;
    ov.clearAndDrawStrokeRects(outlineRects, this.cameras.main, {
      strokeStyle: GUI_PREVIEW_CONTROL_OUTLINE_STROKE,
      lineWidthCss: PREVIEW_OVERLAY_LINE_WIDTH_CSS,
    }, triggerExtras);
    const gizmo = this.gizmoWorldOrigin();
    if (gizmo) {
      ov.drawMoveGizmo(gizmo, this.cameras.main, this.dragGizmo);
    }
  }
}

export function createGuiPreviewPhaserGame(
  parent: HTMLElement,
  payload: GuiPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent, payload.internalWidth, payload.internalHeight),
    callbacks: {
      preBoot: (game: Phaser.Game) => {
        game.registry.set(BENNE_AUDIO_SCRIPT_DISABLED_KEY, true);
        game.registry.set(BENNE_VIDEO_SCRIPT_DISABLED_KEY, true);
      },
    },
    scene: [new BenneGuiPreviewBoot(payload), GuiPreviewScene],
  });
}
