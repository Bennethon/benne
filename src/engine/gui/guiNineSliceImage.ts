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

/**
 * Positions the top-left of a `width`×`height` panel using the same trim + anchor math as GUI `image` sprites.
 */
function positionNineSlicePanelContainer(args: {
  container: Phaser.GameObjects.Container;
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
    container,
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
    container.setPosition(Math.round(px), Math.round(py));
  };

  const fromCenterPoint = (cx: number, cy: number): void => {
    container.setPosition(Math.round(cx - outW / 2), Math.round(cy - outH / 2));
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

function layoutNineSliceImages(
  guiTextureKey: string,
  probe: Phaser.GameObjects.Sprite,
  raw: Record<string, unknown>,
  sliceMap: Map<string, AsepriteSliceEntry>,
  sliceNames: GuiNineSliceImageSliceNames,
  authorTag: string,
  guiId: string,
  outW: number,
  outH: number,
  tiles: Phaser.GameObjects.Sprite[],
): boolean {
  const timelineFrame = resolveAsepriteTimelineFrame(probe, raw, authorTag, guiId);
  const inset = getAsepriteSpriteSourceInset(probe.frame);

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

  const frameName = probe.frame.name;
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

  for (let i = 0; i < 9; i++) {
    const spr = tiles[i]!;
    const spec = layoutSpec[i]!;
    const cr = sliceInsetCrop(spec.crop, inset);
    if (cr.w <= 0 || cr.h <= 0) {
      spr.setVisible(false);
      spr.setCrop();
      continue;
    }
    const dw = Math.max(0, Math.round(spec.dw));
    const dh = Math.max(0, Math.round(spec.dh));
    if (dw <= 0 || dh <= 0) {
      spr.setVisible(false);
      spr.setCrop();
      continue;
    }
    spr.setVisible(true);
    spr.setTexture(guiTextureKey, frameName);
    spr.setCrop(cr.x, cr.y, cr.w, cr.h);
    /**
     * Canvas `batchSprite` computes the drawImage dest offset as:
     *   x = -displayOriginX + crop.x
     * If origin=(0,0) this becomes +crop.x, displacing tiles whose crop starts at x>0.
     *
     * Fix — set origin to (cr.x/cr.w, cr.y/cr.h) so displayOriginX = cr.x, which makes the
     * offset: -cr.x + cr.x = 0. The tile then draws flush at its container position.
     *
     * setSize(cr.w, cr.h) must come first: updateDisplayOrigin() inside setOrigin multiplies
     * originX by _sizeWidth, so we need _sizeWidth = cr.w (not the full atlas realWidth).
     *
     * setScale(dw/cr.w, dh/cr.h) scales the cropped region to the target cell size
     * because batchSprite dest size = crop.cw * scaleX = dw.
     */
    spr.setScale(dw / cr.w, dh / cr.h);
    spr.setSize(cr.w, cr.h);
    spr.setOrigin(cr.x / cr.w, cr.y / cr.h);
    spr.setPosition(Math.round(spec.dx), Math.round(spec.dy));
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
 * Builds a 9-slice GUI control: nine cropped sprites in a container (Canvas renderer).
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
): Phaser.GameObjects.Container | null {
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

  const outW = Math.round(c.width);
  const outH = Math.round(c.height);
  if (outW < 1 || outH < 1) {
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

  const container = scene.add.container(0, 0);
  container.setScrollFactor(0, 0);
  container.setDepth(depth + (c.zIndex ?? 0));
  const vis = startVisible && c.visible !== false;
  container.setVisible(vis);

  const tiles: Phaser.GameObjects.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const spr = scene.add.sprite(0, 0, guiTextureKey, probe.frame.name);
    spr.setScrollFactor(0, 0);
    spr.setVisible(false);
    container.add(spr);
    tiles.push(spr);
  }

  const relayout = (): void => {
    layoutNineSliceImages(
      guiTextureKey,
      probe,
      raw,
      sliceMap,
      c.sliceNames,
      authorTag,
      gui.id,
      outW,
      outH,
      tiles,
    );
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

  const positionContainer = (): void => {
    positionNineSlicePanelContainer({
      container,
      anchor,
      effSpriteAnchor: effPlacementAnchor,
      lx,
      ly,
      placementAnchorX: facadePlacementX,
      placementAnchorY: facadePlacementY,
      bgOffX,
      bgOffY,
      outW,
      outH,
      frame: probe.frame,
      parent,
      rootTL,
    });
  };

  positionContainer();
  relayout();

  const syncFrame = (): void => {
    positionContainer();
    relayout();
  };
  probe.on(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
  probe.on(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
  overlayDisposers.push(() => {
    probe.off(Phaser.Animations.Events.ANIMATION_UPDATE, syncFrame);
    probe.off(Phaser.Animations.Events.ANIMATION_COMPLETE, syncFrame);
  });

  const hitRect = new Phaser.Geom.Rectangle(0, 0, outW, outH);
  container.setInteractive({
    hitArea: hitRect,
    hitAreaCallback: makeGuiRectHitWithDefer(scene, hitRect, imageInputDeferBelow),
    draggable: false,
  });
  container.setData('benneGuiControl', true);

  if (parent) {
    parent.add(container);
  }
  extraDrawables.push(container);
  overlayDisposers.push(() => {
    probe.destroy();
  });

  const cid = c.id?.trim();
  if (cid) {
    controlsById.set(cid, container);
  }

  return container;
}
