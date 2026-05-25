import * as Phaser from 'phaser';
import { guiPhaserAnimationKey } from '../../game/boot/asepritePhaserAnimationKeys.js';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/boot/guiAseprite.js';
import { getBundledGuiAsepriteRawJson } from '../../game/boot/loadAsepriteAtlasData.js';
import type {
  GuiData,
  GuiNineSliceImageControl,
  GuiNineSliceImageSliceNames,
  GuiSpriteAnchor,
} from '../../types/gui.js';
import { ensureAsepriteAtlasAnimationsRegisteredOnce } from '../aseprite/ensureAsepriteAtlasAnimationsOnce.js';
import {
  resolveAuthoredPositionForAsepriteTrim,
  warnDevIfAsepriteJsonMissingSpriteSourceSize,
} from '../aseprite/asepriteFramePlacement.js';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Registry key on a nine-slice {@link Phaser.GameObjects.NineSlice} for {@link tryResizeGuiNineSlicePanel}.
 */
export const BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY = 'benneGuiNineSliceResizeFn';

/**
 * Resizes a GUI nine-slice panel built by {@link addGuiNineSliceImage} (updates NineSlice geometry,
 * hit area, and repositions). Returns false when `ns` is not a nine-slice control with a resize hook.
 */
export function tryResizeGuiNineSlicePanel(
  ns: Phaser.GameObjects.NineSlice,
  width: number,
  height: number,
): boolean {
  const fn = ns.getData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY) as ((w: number, h: number) => void) | undefined;
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

type NineSliceParams = {
  leftW: number;
  rightW: number;
  topH: number;
  bottomH: number;
  sourceRect: Rect | null;
};

/**
 * Reads the four border measurements from Aseprite `meta.slices` data for the given animation frame.
 * These map directly to Phaser's `NineSlice` constructor parameters.
 *
 * The widths/heights of slices are invariant to any sprite trim inset (only positions are affected by
 * insets, not dimensions), so they can be passed to `NineSlice` without adjustment.
 */
function readNineSliceParams(
  probe: Phaser.GameObjects.Sprite,
  raw: Record<string, unknown>,
  sliceMap: Map<string, AsepriteSliceEntry>,
  sliceNames: GuiNineSliceImageSliceNames,
  authorTag: string,
  guiId: string,
): NineSliceParams | null {
  const timelineFrame = resolveAsepriteTimelineFrame(probe, raw, authorTag, guiId);

  const getRect = (cell: keyof GuiNineSliceImageSliceNames): Rect | null => {
    const sliceName = sliceNames[cell]?.trim() ?? '';
    if (!sliceName) {
      console.warn(`[Benne] nineSliceImage: missing sliceNames.${String(cell)}.`);
      return null;
    }
    const slice = sliceMap.get(sliceName);
    if (!slice) {
      console.warn(`[Benne] nineSliceImage: no Aseprite slice named "${sliceName}" in GUI sheet JSON.`);
      return null;
    }
    const b = pickSliceBoundsForTimelineFrame(slice, timelineFrame);
    if (!b) {
      console.warn(`[Benne] nineSliceImage: slice "${sliceName}" has no key for frame ${timelineFrame}.`);
      return null;
    }
    return b;
  };

  const tl = getRect('topLeft');
  const tr = getRect('topRight');
  const bl = getRect('bottomLeft');
  if (!tl || !tr || !bl) return null;

  const tc = getRect('topCenter');
  const ml = getRect('middleLeft');
  const cRect = getRect('center');
  const mr = getRect('middleRight');
  const bc = getRect('bottomCenter');
  const br = getRect('bottomRight');

  const sourceRects: Rect[] = [tl, tr, bl];
  if (tc) sourceRects.push(tc);
  if (ml) sourceRects.push(ml);
  if (cRect) sourceRects.push(cRect);
  if (mr) sourceRects.push(mr);
  if (bc) sourceRects.push(bc);
  if (br) sourceRects.push(br);

  let sourceRect: Rect | null = null;
  if (sourceRects.length > 0) {
    const minX = Math.min(...sourceRects.map((r) => r.x));
    const minY = Math.min(...sourceRects.map((r) => r.y));
    const maxX = Math.max(...sourceRects.map((r) => r.x + r.w));
    const maxY = Math.max(...sourceRects.map((r) => r.y + r.h));
    const w = maxX - minX;
    const h = maxY - minY;

    if (
      Number.isFinite(minX + minY + w + h) &&
      w > 0 &&
      h > 0 &&
      minX >= 0 &&
      minY >= 0 &&
      maxX <= probe.frame.realWidth &&
      maxY <= probe.frame.realHeight
    ) {
      sourceRect = { x: minX, y: minY, w, h };
    } else if (import.meta.env.DEV) {
      console.warn(
        `[Benne] nineSliceImage: slice bounds are invalid/outside the tagged frame ` +
          `(rect=${JSON.stringify({ x: minX, y: minY, w, h })}, ` +
          `frame=${probe.frame.realWidth}x${probe.frame.realHeight}) — ` +
          `using full tagged frame as nine-slice source.`,
      );
    }
  }

  if (import.meta.env.DEV) {
    const warn = (label: string, v1: number, v2: number) => {
      if (Math.abs(v1 - v2) > 0.5) {
        console.warn(
          `[Benne] nineSliceImage: ${label} mismatch (${v1} vs ${v2}) — using top-left / top row / left column.`,
        );
      }
    };
    if (ml) warn('left column width', tl.w, ml.w);
    if (bl) warn('left column width', tl.w, bl.w);
    if (mr) warn('right column width', tr.w, mr.w);
    if (br) warn('right column width', tr.w, br.w);
    if (tc) warn('top row height', tl.h, tc.h);
    if (tr) warn('top row height', tl.h, tr.h);
    if (bc) warn('bottom row height', bl.h, bc.h);
    if (br) warn('bottom row height', bl.h, br.h);
  }

  return { leftW: tl.w, rightW: tr.w, topH: tl.h, bottomH: bl.h, sourceRect };
}

/**
 * Phaser's `NineSlice.updateUVs()` normalises slice pixel positions by `frame.realWidth/realHeight`
 * and uses those values as final texture UVs (0-1). This is correct only when `frame.u0=0, frame.u1=1`
 * AND `frame.cutWidth = frame.realWidth` (no atlas padding).
 *
 * Aseprite's "Power of 2" export option pads the atlas to the next power-of-two, so the frame may be
 * 32×32 while `sourceSize` (= `realWidth/realHeight`) is 30×20. In that case `cutWidth > realWidth`,
 * `frame.u1 = 1` still maps the *full* 32px, and UV fractions like `7/30` sample at pixel 7.47 instead
 * of 7 — causing severe vertical misalignment for the row boundaries.
 *
 * Fix: add a one-time sub-frame covering either the full content area (`realWidth × realHeight`) or
 * a caller-provided crop rectangle (used for nine-slice slice-union bounds). The sub-frame gets
 * `u1 = realW/atlasW < 1` when needed, so `updateQuadUVs` correctly scales each UV fraction through
 * the frame's range and maps 7/30 → 7/32. The vertex positions (determined by `this.width/height`,
 * not the frame) are unaffected.
 */
function ensureNineSliceUVCorrectedFrame(
  tex: Phaser.Textures.Texture,
  origFrame: Phaser.Textures.Frame,
  sourceRect: Rect | null,
): string | number {
  const fullContentW = origFrame.realWidth;
  const fullContentH = origFrame.realHeight;
  const atlasW = origFrame.cutWidth;
  const atlasH = origFrame.cutHeight;

  const cropX = sourceRect?.x ?? 0;
  const cropY = sourceRect?.y ?? 0;
  const cropW = sourceRect?.w ?? fullContentW;
  const cropH = sourceRect?.h ?? fullContentH;

  const wantsSubFrame =
    atlasW > fullContentW ||
    atlasH > fullContentH ||
    cropX !== 0 ||
    cropY !== 0 ||
    cropW !== fullContentW ||
    cropH !== fullContentH;

  if (!wantsSubFrame) {
    return origFrame.name; // No atlas padding — original frame UV is correct.
  }

  const correctedName = `${String(origFrame.name)}__benne_ns_uv_${cropX}_${cropY}_${cropW}_${cropH}`;
  if (!tex.has(correctedName)) {
    // Create a frame covering the requested crop at the same atlas origin.
    // Its u1/v1 reflect crop extents, so UV fractions map to authored slice boundaries.
    tex.add(
      correctedName,
      origFrame.sourceIndex,
      origFrame.cutX + cropX,
      origFrame.cutY + cropY,
      cropW,
      cropH,
    );
  }
  return correctedName;
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

/**
 * Positions the top-left of a `width`×`height` panel using the same trim + anchor math as GUI `image` sprites.
 */
function positionNineSlicePanel(args: {
  go: { x: number; y: number; setPosition(x: number, y: number): void };
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

export function estimateNineSliceSizeForGridAlign(c: GuiNineSliceImageControl): { w: number; h: number } {
  const w = c.width;
  const h = c.height;
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
    return { w: Math.round(w), h: Math.round(h) };
  }
  return { w: 32, h: 32 };
}

/**
 * Builds a 9-slice GUI control using Phaser's native {@link Phaser.GameObjects.NineSlice} (WebGL).
 *
 * Slice dimensions (left/right column widths, top/bottom row heights) are read from Aseprite's
 * `meta.slices` JSON and passed directly to Phaser — no Canvas drawing workarounds required.
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
): Phaser.GameObjects.NineSlice | null {
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

  /** Invisible sprite used only to resolve the correct atlas frame + drive animation updates. */
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

  const sliceParams = readNineSliceParams(probe, raw, sliceMap, c.sliceNames, authorTag, gui.id);
  if (!sliceParams) {
    probe.destroy();
    return null;
  }
  const { leftW, rightW, topH, bottomH, sourceRect } = sliceParams;

  const nsFrameName = ensureNineSliceUVCorrectedFrame(scene.textures.get(guiTextureKey), probe.frame, sourceRect);

  const ns = scene.add.nineslice(
    0, 0,
    guiTextureKey,
    nsFrameName,
    panelW, panelH,
    leftW, rightW, topH, bottomH,
  );
  ns.setScrollFactor(0, 0);
  ns.setDepth(depth + (c.zIndex ?? 0));
  ns.setOrigin(0, 0);
  const vis = startVisible && c.visible !== false;
  ns.setVisible(vis);

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

  const positionPanel = (): void => {
    positionNineSlicePanel({
      go: ns,
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

  positionPanel();

  /** Update NineSlice frame when the probe's animation advances. */
  const syncFrame = (): void => {
    positionPanel();
    const latest = readNineSliceParams(probe, raw, sliceMap, c.sliceNames, authorTag, gui.id);
    const nextSourceRect = latest?.sourceRect ?? null;
    ns.setFrame(ensureNineSliceUVCorrectedFrame(scene.textures.get(guiTextureKey), probe.frame, nextSourceRect));
  };
  probe.on(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
  probe.on(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
  overlayDisposers.push(() => {
    probe.off(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
    probe.off(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
    ns.setData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY, undefined);
  });

  const hitRect = new Phaser.Geom.Rectangle(0, 0, panelW, panelH);
  const wireInteractivity = (): void => {
    ns.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: makeGuiRectHitWithDefer(scene, hitRect, imageInputDeferBelow),
      draggable: false,
    });
  };
  wireInteractivity();
  ns.setData('benneGuiControl', true);

  /** Runtime resize for Display Text and similar dynamic nine-slice panels. */
  const applyNineSlicePanelSize = (nw: number, nh: number): void => {
    const W = Math.max(1, Math.round(nw));
    const H = Math.max(1, Math.round(nh));
    panelW = W;
    panelH = H;
    ns.setSlices(W, H, leftW, rightW, topH, bottomH);
    hitRect.width = W;
    hitRect.height = H;
    wireInteractivity();
    positionPanel();
  };
  ns.setData(BENNE_GUI_NINE_SLICE_RESIZE_FN_KEY, applyNineSlicePanelSize);

  if (parent) {
    parent.add(ns);
  }
  extraDrawables.push(ns);
  overlayDisposers.push(() => {
    probe.destroy();
  });

  const cid = c.id?.trim();
  if (cid) {
    controlsById.set(cid, ns);
  }

  return ns;
}
