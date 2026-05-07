import * as Phaser from 'phaser';
import { guiPhaserAnimationKey } from '../../game/asepritePhaserAnimationKeys.js';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/guiAseprite.js';
import { getBundledGuiAsepriteRawJson } from '../../game/loadAsepriteAtlasData.js';
import type {
  GuiData,
  GuiNineSliceImageControl,
  GuiNineSliceImageSliceNames,
  GuiSpriteAnchor,
} from '../../types/gui.js';
import { ensureAsepriteAtlasAnimationsRegisteredOnce } from '../aseprite/ensureAsepriteAtlasAnimationsOnce.js';
import {
  getAsepriteSpriteSourceInset,
  resolveAuthoredPositionForAsepriteTrim,
  warnDevIfAsepriteJsonMissingSpriteSourceSize,
} from '../aseprite/asepriteFramePlacement.js';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Registry key on nine-slice {@link Phaser.GameObjects.RenderTexture} for {@link tryResizeGuiNineSlicePanel}.
 */
export const BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY = 'benneGuiNineSliceResizeFn';

/**
 * Resizes a GUI nine-slice panel built by {@link addGuiNineSliceImage} (updates DynamicTexture, mask, hit area,
 * and redraws tiles). Returns false when **`rt`** is not a nine-slice control with a resize hook.
 */
export function tryResizeGuiNineSlicePanel(
  rt: Phaser.GameObjects.RenderTexture,
  width: number,
  height: number,
): boolean {
  const fn = rt.getData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY) as ((w: number, h: number) => void) | undefined;
  if (typeof fn !== 'function') {
    return false;
  }
  fn(width, height);
  return true;
}

type AsepriteSliceEntry = {
  name: string;
  keys: { frame: number; bounds: Rect }[];
};

/** @internal Exported for tests; mirrors {@link tryApplyGuiSheetTag} in buildGuiOverlay. */
export function applyGuiSheetTagToNineSliceProbe(
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
    if (sprite.anims?.isPlaying) {
      sprite.anims.stop();
    }
    sprite.setFrame(animKey);
    return true;
  } catch {
    return false;
  }
}

function readAsepriteSliceMap(raw: Record<string, unknown>): Map<string, AsepriteSliceEntry> {
  const meta = raw.meta;
  if (!meta || typeof meta !== 'object') {
    return new Map();
  }
  const slices = (meta as { slices?: unknown }).slices;
  if (!Array.isArray(slices)) {
    return new Map();
  }
  const m = new Map<string, AsepriteSliceEntry>();
  for (const s of slices) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      continue;
    }
    const name = (s as { name?: unknown }).name;
    const keys = (s as { keys?: unknown }).keys;
    if (typeof name !== 'string' || name.length === 0 || !Array.isArray(keys)) {
      continue;
    }
    const parsedKeys: AsepriteSliceEntry['keys'] = [];
    for (const k of keys) {
      if (!k || typeof k !== 'object' || Array.isArray(k)) {
        continue;
      }
      const frame = (k as { frame?: unknown }).frame;
      const bounds = (k as { bounds?: unknown }).bounds;
      if (typeof frame !== 'number' || !Number.isFinite(frame) || !bounds || typeof bounds !== 'object') {
        continue;
      }
      const b = bounds as Record<string, unknown>;
      const x = b.x,
        y = b.y,
        w = b.w,
        h = b.h;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof w !== 'number' ||
        typeof h !== 'number' ||
        !Number.isFinite(x + y + w + h)
      ) {
        continue;
      }
      parsedKeys.push({ frame, bounds: { x, y, w, h } });
    }
    if (parsedKeys.length > 0) {
      m.set(name, { name, keys: parsedKeys });
    }
  }
  return m;
}

function pickSliceBoundsForTimelineFrame(slice: AsepriteSliceEntry, timelineFrame: number): Rect | null {
  const keys = slice.keys;
  const exact = keys.find((k) => k.frame === timelineFrame);
  if (exact) {
    return exact.bounds;
  }
  let best = keys[0]!;
  for (const k of keys) {
    if (k.frame <= timelineFrame && k.frame >= best.frame) {
      best = k;
    }
  }
  return best?.bounds ?? null;
}

function readFrameTagStartFrame(raw: Record<string, unknown>, authorTag: string, guiId: string): number {
  const meta = raw.meta;
  if (!meta || typeof meta !== 'object') {
    return 0;
  }
  const frameTags = (meta as { frameTags?: readonly { name: string; from: number }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return 0;
  }
  /** Disk JSON uses author tag names; Phaser-prefixed atlas JSON uses {@link guiPhaserAnimationKey}. */
  const names = [authorTag, guiPhaserAnimationKey(guiId, authorTag)];
  for (const n of names) {
    const hit = frameTags.find((ft) => ft.name === n);
    if (hit != null && Number.isFinite(hit.from)) {
      return hit.from;
    }
  }
  return 0;
}

function resolveAsepriteTimelineFrame(
  probe: Phaser.GameObjects.Sprite,
  raw: Record<string, unknown>,
  authorTag: string,
  guiId: string,
): number {
  const start = readFrameTagStartFrame(raw, authorTag, guiId);
  const anim = probe.anims.currentAnim;
  if (!anim || !probe.anims.isPlaying) {
    return start;
  }
  /** Index within this clip (`0` … `frames.length - 1`). */
  const inClip = probe.anims.currentFrame?.index ?? 0;
  return start + inClip;
}

function sliceInsetCrop(bounds: Rect, inset: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
  return {
    x: bounds.x - inset.x,
    y: bounds.y - inset.y,
    w: bounds.w,
    h: bounds.h,
  };
}

function guiSpriteAnchorOrDefault(a: GuiSpriteAnchor | undefined): GuiSpriteAnchor {
  return a ?? 'top-left';
}

function makeGuiRectHitWithDefer(
  scene: Phaser.Scene,
  rectLocal: Phaser.Geom.Rectangle,
  deferBelow: readonly Phaser.GameObjects.GameObject[],
): Phaser.Types.Input.HitAreaCallback {
  return (_hitArea, x, y) => {
    if (!Phaser.Geom.Rectangle.Contains(rectLocal, x, y)) {
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

type PositionableGo = { x: number; y: number; setPosition(x: number, y: number): void };

/**
 * Positions the top-left of a `width`×`height` panel using the same trim + anchor math as GUI `image` sprites.
 */
function positionNineSlicePanelContainer(args: {
  go: PositionableGo;
  anchor: GuiSpriteAnchor;
  effSpriteAnchor: GuiSpriteAnchor;
  lx: number;
  ly: number;
  placementAnchorX: number;
  placementAnchorY: number;
  bgOffX: number;
  bgOffY: number;
  outW: number;
  outH: number;
  frame: Phaser.Textures.Frame;
  parent?: Phaser.GameObjects.Container;
  rootTL?: { x: number; y: number };
}): void {
  const {
    go,
    anchor,
    effSpriteAnchor,
    lx,
    ly,
    placementAnchorX,
    placementAnchorY,
    bgOffX,
    bgOffY,
    outW,
    outH,
    frame,
    parent,
    rootTL,
  } = args;

  const topLeft = (px: number, py: number): void => {
    go.setPosition(Math.round(px), Math.round(py));
  };

  const fromCenterPoint = (cx: number, cy: number): void => {
    go.setPosition(Math.round(cx - outW / 2), Math.round(cy - outH / 2));
  };

  if (anchor === 'screen' && parent) {
    if (rootTL) {
      topLeft(-rootTL.x + bgOffX, -rootTL.y + bgOffY);
    } else {
      const p = resolveAuthoredPositionForAsepriteTrim('top-left', lx, ly, frame);
      topLeft(p.x + bgOffX, p.y + bgOffY);
    }
    return;
  }

  if (anchor === 'screen') {
    topLeft(bgOffX, bgOffY);
    return;
  }

  const p = resolveAuthoredPositionForAsepriteTrim(
    effSpriteAnchor,
    placementAnchorX,
    placementAnchorY,
    frame,
  );
  if (effSpriteAnchor === 'center') {
    fromCenterPoint(p.x + bgOffX, p.y + bgOffY);
  } else {
    topLeft(p.x + bgOffX, p.y + bgOffY);
  }
}

const CELL_ORDER: (keyof GuiNineSliceImageSliceNames)[] = [
  'topLeft',
  'topCenter',
  'topRight',
  'middleLeft',
  'center',
  'middleRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
];

/**
 * Draws the nine tiles directly to a Canvas 2D context (the RenderTexture's canvas).
 *
 * Using `ctx.drawImage` instead of Phaser's `batchSprite` is critical: `batchSprite` adds
 * `fw += 0.5` when `camera.roundPixels` is true to prevent inter-tile gaps.  For corner tiles
 * (scaleX = 1) this stretches e.g. 5 source pixels to 22 screen pixels at zoom 4 — a
 * non-uniform 4.4× mapping — causing transparent notch edges to appear blurry.
 * With direct `ctx.drawImage` the corner tiles get an exact 1:1 source→RT pixel mapping
 * (5 source → 5 RT pixels, then the RT itself is displayed at zoom scale with negligible
 * per-pixel error across its full width).
 */
function drawNineSliceTilesToCanvas(
  ctx: CanvasRenderingContext2D,
  probe: Phaser.GameObjects.Sprite,
  raw: Record<string, unknown>,
  sliceMap: Map<string, AsepriteSliceEntry>,
  sliceNames: GuiNineSliceImageSliceNames,
  authorTag: string,
  guiId: string,
  outW: number,
  outH: number,
): boolean {
  const timelineFrame = resolveAsepriteTimelineFrame(probe, raw, authorTag, guiId);
  const inset = getAsepriteSpriteSourceInset(probe.frame);
  const frame = probe.frame;
  const atlasImage = frame.source.image as unknown as CanvasImageSource;

  const rects: (Rect | null)[] = [];
  for (const cell of CELL_ORDER) {
    const sliceName = sliceNames[cell]?.trim() ?? '';
    if (!sliceName) {
      console.warn(`[Benne] nineSliceImage: missing sliceNames.${String(cell)}.`);
      return false;
    }
    const slice = sliceMap.get(sliceName);
    if (!slice) {
      console.warn(`[Benne] nineSliceImage: no Aseprite slice named "${sliceName}" in GUI sheet JSON.`);
      return false;
    }
    const b = pickSliceBoundsForTimelineFrame(slice, timelineFrame);
    if (!b) {
      console.warn(`[Benne] nineSliceImage: slice "${sliceName}" has no key for frame ${timelineFrame}.`);
      return false;
    }
    rects.push(b);
  }

  const tl = rects[0]!,
    tc = rects[1]!,
    tr = rects[2]!,
    ml = rects[3]!,
    c = rects[4]!,
    mr = rects[5]!,
    bl = rects[6]!,
    bc = rects[7]!,
    br = rects[8]!;

  const leftW = tl.w;
  const rightW = tr.w;
  const topH = tl.h;
  const bottomH = bl.h;

  if (import.meta.env.DEV) {
    const warn = (a: string, v1: number, v2: number) => {
      if (Math.abs(v1 - v2) > 0.5) {
        console.warn(`[Benne] nineSliceImage: ${a} width/height mismatch (${v1} vs ${v2}) — using top-left / top row / left column.`);
      }
    };
    warn('left column', leftW, ml.w);
    warn('left column', leftW, bl.w);
    warn('right column', rightW, mr.w);
    warn('right column', rightW, br.w);
    warn('top row', topH, tc.h);
    warn('top row', topH, tr.h);
    warn('bottom row', bottomH, bc.h);
    warn('bottom row', bottomH, br.h);
  }

  const midW = Math.max(0, Math.round(outW - leftW - rightW));
  const midH = Math.max(0, Math.round(outH - topH - bottomH));

  const layoutSpec: { crop: Rect; dx: number; dy: number; dw: number; dh: number }[] = [
    { crop: tl, dx: 0, dy: 0, dw: leftW, dh: topH },
    { crop: tc, dx: leftW, dy: 0, dw: midW, dh: topH },
    { crop: tr, dx: leftW + midW, dy: 0, dw: rightW, dh: topH },
    { crop: ml, dx: 0, dy: topH, dw: leftW, dh: midH },
    { crop: c, dx: leftW, dy: topH, dw: midW, dh: midH },
    { crop: mr, dx: leftW + midW, dy: topH, dw: rightW, dh: midH },
    { crop: bl, dx: 0, dy: topH + midH, dw: leftW, dh: bottomH },
    { crop: bc, dx: leftW, dy: topH + midH, dw: midW, dh: bottomH },
    { crop: br, dx: leftW + midW, dy: topH + midH, dw: rightW, dh: bottomH },
  ];

  for (const spec of layoutSpec) {
    const cr = sliceInsetCrop(spec.crop, inset);
    if (cr.w <= 0 || cr.h <= 0) continue;
    const dw = Math.max(0, Math.round(spec.dw));
    const dh = Math.max(0, Math.round(spec.dh));
    if (dw <= 0 || dh <= 0) continue;
    ctx.drawImage(
      atlasImage,
      frame.cutX + cr.x, frame.cutY + cr.y, cr.w, cr.h,
      Math.round(spec.dx), Math.round(spec.dy), dw, dh,
    );
  }

  return true;
}

export function estimateNineSliceSizeForGridAlign(c: GuiNineSliceImageControl): { w: number; h: number } {
  const w = c.width;
  const h = c.height;
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
    return { w: Math.round(w), h: Math.round(h) };
  }
  return { w: 32, h: 32 };
}

/**
 * Builds a 9-slice GUI control: tiles drawn directly to a RenderTexture (Canvas renderer).
 *
 * A RenderTexture is used instead of nine Sprite children in a Container so that tiles are
 * drawn with `ctx.drawImage` (exact integer pixel mapping) rather than Phaser's `batchSprite`
 * (which adds `fw += 0.5` when `camera.roundPixels` is true, causing non-uniform scaling that
 * blurs transparent notch corners in the corner tiles).
 */
export function addGuiNineSliceImage(
  scene: Phaser.Scene,
  gui: GuiData,
  c: GuiNineSliceImageControl,
  depth: number,
  startVisible: boolean,
  extraDrawables: Phaser.GameObjects.GameObject[],
  controlsById: Map<string, Phaser.GameObjects.GameObject>,
  imageInputDeferBelow: Phaser.GameObjects.GameObject[],
  overlayDisposers: Array<() => void>,
  layout?: {
    x: number;
    y: number;
    parent?: Phaser.GameObjects.Container;
    screenRootTopLeft?: { x: number; y: number };
    gridContentBox?: { w: number; h: number };
    gridCenterAlign?: boolean;
  },
  /** Editor previews: disk-shaped sheet JSON with `meta.slices` when bundled glob is unavailable. */
  previewSheetJson?: Record<string, unknown>,
): Phaser.GameObjects.RenderTexture | null {
  if (!usesAsepriteDisplay(gui)) {
    return null;
  }
  const legacyDisplay = (c as GuiNineSliceImageControl & { display?: { tag?: string; backgroundAnchor?: GuiSpriteAnchor } })
    .display;
  const authorTag = (c.tag ?? legacyDisplay?.tag)?.trim() ?? '';
  if (!authorTag) {
    return null;
  }
  const guiTextureKey = getAsepriteTextureKey(gui.id);
  if (!scene.textures.exists(guiTextureKey)) {
    return null;
  }

  let raw: Record<string, unknown>;
  if (previewSheetJson && typeof previewSheetJson === 'object' && !Array.isArray(previewSheetJson)) {
    raw = previewSheetJson;
  } else {
    try {
      raw = getBundledGuiAsepriteRawJson(gui.id);
    } catch {
      return null;
    }
  }
  const sliceMap = readAsepriteSliceMap(raw);
  if (sliceMap.size === 0) {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] GUI "${gui.id}" nineSliceImage: sheet JSON has no meta.slices — add slices in Aseprite.`);
    }
    return null;
  }

  let panelW = Math.round(c.width);
  let panelH = Math.round(c.height);
  if (panelW < 1 || panelH < 1) {
    return null;
  }

  const probe = scene.add.sprite(0, 0, guiTextureKey);
  probe.setVisible(false);
  probe.setScrollFactor(0, 0);
  probe.setDepth(depth + (c.zIndex ?? 0) - 0.001);
  if (!applyGuiSheetTagToNineSliceProbe(scene, probe, guiTextureKey, authorTag, gui.id)) {
    probe.destroy();
    return null;
  }
  if (import.meta.env.DEV) {
    warnDevIfAsepriteJsonMissingSpriteSourceSize(probe.frame, `GUI "${gui.id}" nineSliceImage`);
  }

  /**
   * RenderTexture sized exactly to the panel.  Tiles are drawn into it via `ctx.drawImage`
   * (bypassing `batchSprite`) so each tile gets exact integer pixel mapping with no `fw += 0.5`
   * stretch.  The RT is then displayed as a single game object; its own slight `fw += 0.5`
   * overdraw at the panel edges is handled by the GeometryMask below.
   */
  const rt = scene.add.renderTexture(0, 0, panelW, panelH);
  rt.setScrollFactor(0, 0);
  rt.setDepth(depth + (c.zIndex ?? 0));
  rt.setOrigin(0, 0);
  const vis = startVisible && c.visible !== false;
  rt.setVisible(vis);

  const relayout = (): void => {
    /**
     * RenderTexture in Phaser 4 is an Image backed by a DynamicTexture.
     * The 2D canvas context lives on the DynamicTexture (rt.texture), not on the RT itself.
     * In Canvas mode, batchSprite renders `frame.source.image` which IS that same canvas, so
     * drawing here directly (bypassing the command buffer) is safe in the default RENDER mode.
     */
    const ctx = (rt.texture as unknown as { context: CanvasRenderingContext2D | null }).context;
    if (!ctx) return;
    ctx.clearRect(0, 0, panelW, panelH);
    ctx.imageSmoothingEnabled = false;
    drawNineSliceTilesToCanvas(ctx, probe, raw, sliceMap, c.sliceNames, authorTag, gui.id, panelW, panelH);
  };

  const anchor = guiSpriteAnchorOrDefault(c.backgroundAnchor ?? legacyDisplay?.backgroundAnchor);
  const bgOffX = c.backgroundOffsetX ?? 0;
  const bgOffY = c.backgroundOffsetY ?? 0;
  const lx = layout?.x ?? c.x;
  const ly = layout?.y ?? c.y;
  const gridCenterAlign = layout?.gridCenterAlign === true;
  const placementBox = layout?.gridContentBox;

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

  const effPlacementAnchor: GuiSpriteAnchor =
    anchor === 'screen' && parent && !rootTL ? 'top-left' : effSpriteAnchor;
  const facadePlacementX = anchor === 'screen' && parent && !rootTL ? lx : placementAnchorX;
  const facadePlacementY = anchor === 'screen' && parent && !rootTL ? ly : placementAnchorY;

  const positionRT = (): void => {
    positionNineSlicePanelContainer({
      go: rt,
      anchor,
      effSpriteAnchor: effPlacementAnchor,
      lx,
      ly,
      placementAnchorX: facadePlacementX,
      placementAnchorY: facadePlacementY,
      bgOffX,
      bgOffY,
      outW: panelW,
      outH: panelH,
      frame: probe.frame,
      parent,
      rootTL,
    });
  };

  positionRT();
  relayout();

  /**
   * Phaser's `batchSprite` adds `fw += 0.5` / `fh += 0.5` when `camera.roundPixels` is true.
   * For the RT itself (displayed at scale 1) this adds ~0.5 canvas units of overdraw at the
   * panel's right/bottom edges.  A GeometryMask clips the RT to its exact bounds.
   * The mask Graphics lives in world space with scroll-factor 0, and is re-synced whenever
   * the RT is repositioned (e.g. on animation frame changes).
   */
  const clipMaskGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
  clipMaskGfx.setScrollFactor(0, 0);
  clipMaskGfx.fillStyle(0xffffff, 1);
  clipMaskGfx.fillRect(0, 0, panelW, panelH);
  clipMaskGfx.setPosition(rt.x, rt.y);
  rt.setMask(clipMaskGfx.createGeometryMask());

  const syncClipMask = (): void => {
    clipMaskGfx.setPosition(rt.x, rt.y);
  };

  const syncFrame = (): void => {
    positionRT();
    relayout();
    syncClipMask();
  };
  probe.on(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
  probe.on(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
  overlayDisposers.push(() => {
    probe.off(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
    probe.off(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
    rt.clearMask();
    rt.setData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY, undefined);
    clipMaskGfx.destroy();
  });

  const hitRect = new Phaser.Geom.Rectangle(0, 0, panelW, panelH);
  const wireNineSliceInteractivity = (): void => {
    rt.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: makeGuiRectHitWithDefer(scene, hitRect, imageInputDeferBelow),
      draggable: false,
    });
  };
  wireNineSliceInteractivity();
  rt.setData('benneGuiControl', true);

  /** Runtime resize for Display Text and similar dynamic nine-slice panels. */
  const applyNineSlicePanelSize = (nw: number, nh: number): void => {
    const W = Math.max(1, Math.round(nw));
    const H = Math.max(1, Math.round(nh));
    panelW = W;
    panelH = H;
    const tex = rt.texture as Phaser.Textures.DynamicTexture;
    tex.setSize(W, H);
    clipMaskGfx.clear();
    clipMaskGfx.fillStyle(0xffffff, 1);
    clipMaskGfx.fillRect(0, 0, W, H);
    hitRect.width = W;
    hitRect.height = H;
    wireNineSliceInteractivity();
    positionRT();
    relayout();
    syncClipMask();
  };
  rt.setData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY, applyNineSlicePanelSize);

  if (parent) {
    parent.add(rt);
  }
  extraDrawables.push(rt);
  overlayDisposers.push(() => {
    probe.destroy();
  });

  const cid = c.id?.trim();
  if (cid) {
    controlsById.set(cid, rt);
  }

  return rt;
}
