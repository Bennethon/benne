import * as Phaser from 'phaser';
import type { GuiTextAlign, GuiTextControl, GuiTextOutline } from '../../types/gui';
import {
  applyGuiBitmapTextFillTint,
  BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY,
  BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY,
  configureBenneGuiBitmapTextForRoundPixels,
  createGuiBitmapTextOutlines,
  guiTextOutlineMaxAbsOffsetForBounds,
  resolveEffectiveGuiTextOutline,
  syncOutlinedGuiBitmapTextAll,
  syncOutlinedGuiBitmapTextPositions,
} from './guiTextOutline';
import { ensureBenneDomGuiFontFacesRegistered, getDomFontCssFamilyForBitmapFontId } from './benneDomGuiFontFaces';
import { ensureBenneDomGuiTextBaseCss } from './benneDomGuiTextCss';

export type GuiTextLineHandle =
  | {
      kind: 'bitmap';
      main: Phaser.GameObjects.BitmapText;
      outlines: Phaser.GameObjects.BitmapText[];
    }
  | {
      kind: 'dom';
      dom: Phaser.GameObjects.DOMElement;
      outlinePad: number;
    };

export interface CreateGuiTextLineParams {
  scene: Phaser.Scene;
  backend: 'bitmap' | 'dom';
  x: number;
  y: number;
  depth: number;
  visible: boolean;
  initialText: string;
  fontKey: string;
  fontSize: number;
  colorHex: string;
  align: GuiTextAlign | undefined;
  wordWrapWidth?: number;
  letterSpacing?: number;
  textOutline?: GuiTextOutline;
  /** Phaser `BitmapText` size (from {@link effectiveBitmapFontRenderSize}); ignored for DOM. */
  bitmapRenderSize: number;
  /** DOM `font-family` from `fonts-dom.json`; required when `backend === 'dom'`. */
  cssFamily: string;
  /** Outline depth ceiling for `BitmapText` clones (button vs free text). */
  outlineDepthCeiling: number;
  /** When set, packed in draw order after creation (e.g. button hit container). */
  parent?: Phaser.GameObjects.Container;
  /** Vertical origin fraction; default from {@link originFromAlign} (usually `0`). Buttons use `0.5`. */
  labelOriginY?: number;
}

function bitmapTextLineAlign(align: GuiTextAlign | undefined): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

function originFromAlign(align: GuiTextAlign | undefined): { x: number; y: number } {
  switch (align) {
    case 'center':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * CSS `font-size` / line box height that approximates Phaser {@link Phaser.GameObjects.BitmapText}
 * for the same authored `fontSize`, using BMFont `size` + `lineHeight` from the loaded font cache.
 */
export function effectiveDomGuiFontSizePx(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  if (!fontKey || !scene.cache.bitmapFont.exists(fontKey)) {
    return Math.max(1, Math.round(Math.abs(fontSize)));
  }
  const entry = scene.cache.bitmapFont.get(fontKey) as {
    data?: { size?: number; lineHeight?: number };
  } | null;
  const dataSize = entry?.data?.size;
  const lineHeight = entry?.data?.lineHeight;
  if (dataSize == null || dataSize === 0 || lineHeight == null || !(lineHeight > 0)) {
    return Math.max(1, Math.round(Math.abs(fontSize)));
  }
  const user = Math.abs(fontSize);
  const design = Math.abs(dataSize);
  return Math.max(1, Math.round(lineHeight * (user / design)));
}

function hexStringToTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0xffffff;
  }
}

function guiTextOutlineToCssTextShadow(outline: GuiTextOutline | undefined): string {
  const spec = resolveEffectiveGuiTextOutline(outline);
  if (!spec) {
    return 'none';
  }
  const c = Phaser.Display.Color.IntegerToColor(spec.tint);
  const rgba = `rgba(${c.red},${c.green},${c.blue},${spec.alpha})`;
  return spec.offsets.map(({ dx, dy }) => `${dx}px ${dy}px 0 ${rgba}`).join(', ');
}

function unionOutlinedBitmapTextScreenBounds(main: Phaser.GameObjects.BitmapText): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  const expand = (r: Phaser.Geom.Rectangle): void => {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  };
  expand(main.getBounds());
  const outs = main.getData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY) as Phaser.GameObjects.BitmapText[] | undefined;
  if (Array.isArray(outs)) {
    for (const o of outs) {
      expand(o.getBounds());
    }
  }
  return { left, top, right, bottom };
}

export function guiTextLinePackObjects(h: GuiTextLineHandle): Phaser.GameObjects.GameObject[] {
  if (h.kind === 'bitmap') {
    return [...h.outlines, h.main];
  }
  return [h.dom];
}

export function guiTextLineControlObject(h: GuiTextLineHandle): Phaser.GameObjects.GameObject {
  return h.kind === 'bitmap' ? h.main : h.dom;
}

export function guiTextLineSetText(h: GuiTextLineHandle, text: string): void {
  if (h.kind === 'bitmap') {
    syncOutlinedGuiBitmapTextAll(h.main, text);
  } else {
    h.dom.setText(text);
    h.dom.updateSize();
  }
}

export function guiTextLineGetText(h: GuiTextLineHandle): string {
  if (h.kind === 'bitmap') {
    return h.main.text;
  }
  const node = h.dom.node as HTMLElement;
  return node.innerText ?? '';
}

export function guiTextLineSetVisible(h: GuiTextLineHandle, v: boolean): void {
  if (h.kind === 'bitmap') {
    for (const o of h.outlines) {
      o.setVisible(v);
    }
    h.main.setVisible(v);
  } else {
    h.dom.setVisible(v);
  }
}

export function guiTextLineSetLetterSpacing(h: GuiTextLineHandle, spacing: number): void {
  if (h.kind === 'bitmap') {
    h.main.setLetterSpacing(spacing);
    const outs = h.main.getData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY) as Phaser.GameObjects.BitmapText[] | undefined;
    if (Array.isArray(outs)) {
      for (const o of outs) {
        o.setLetterSpacing(spacing);
      }
    }
  } else {
    const node = h.dom.node as HTMLElement;
    node.style.letterSpacing = spacing === 0 ? '' : `${spacing}px`;
    h.dom.updateSize();
  }
}

export function guiTextLineSetDepth(h: GuiTextLineHandle, d: number): void {
  if (h.kind === 'bitmap') {
    let i = 0;
    for (const o of h.outlines) {
      o.setDepth(d - i * 0.0001);
      i += 1;
    }
    h.main.setDepth(d);
  } else {
    h.dom.setDepth(d);
  }
}

export function guiTextLineSetScrollFactor(h: GuiTextLineHandle, sx: number, sy: number): void {
  if (h.kind === 'bitmap') {
    for (const o of h.outlines) {
      o.setScrollFactor(sx, sy);
    }
    h.main.setScrollFactor(sx, sy);
  } else {
    h.dom.setScrollFactor(sx, sy);
  }
}

export function guiTextLineSetPosition(h: GuiTextLineHandle, x: number, y: number): void {
  if (h.kind === 'bitmap') {
    h.main.setPosition(x, y);
    syncOutlinedGuiBitmapTextPositions(h.main);
  } else {
    h.dom.setPosition(x, y);
  }
}

export function guiTextLineSetOrigin(h: GuiTextLineHandle, ox: number, oy: number): void {
  if (h.kind === 'bitmap') {
    h.main.setOrigin(ox, oy);
    syncOutlinedGuiBitmapTextPositions(h.main);
  } else {
    h.dom.setOrigin(ox, oy);
  }
}

export function guiTextLineSyncAfterMainMove(h: GuiTextLineHandle): void {
  if (h.kind === 'bitmap') {
    syncOutlinedGuiBitmapTextPositions(h.main);
  }
}

export function guiTextLineSetAlpha(h: GuiTextLineHandle | null, a: number): void {
  if (!h) {
    return;
  }
  if (h.kind === 'bitmap') {
    for (const o of h.outlines) {
      o.setAlpha(a);
    }
    h.main.setAlpha(a);
  } else {
    h.dom.setAlpha(a);
  }
}

/** Bitmap: WebGL tint fill; DOM: `color` CSS from packed RGB tint. */
export function guiTextLineApplyFillTint(h: GuiTextLineHandle, tint: number): void {
  if (h.kind === 'bitmap') {
    applyGuiBitmapTextFillTint(h.main, tint);
    h.main.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, tint);
  } else {
    const c = Phaser.Display.Color.IntegerToColor(tint);
    (h.dom.node as HTMLElement).style.color = `rgb(${c.red},${c.green},${c.blue})`;
  }
}

/** Union AABB in world space (same contract as legacy `BitmapText` + outline union). */
export function guiTextLineGetBoundsUnion(h: GuiTextLineHandle): Phaser.Geom.Rectangle {
  if (h.kind === 'bitmap') {
    const bb = unionOutlinedBitmapTextScreenBounds(h.main);
    if (!(bb.right > bb.left && bb.bottom > bb.top)) {
      return new Phaser.Geom.Rectangle(h.main.x, h.main.y, 0, 0);
    }
    return new Phaser.Geom.Rectangle(bb.left, bb.top, bb.right - bb.left, bb.bottom - bb.top);
  }
  const b = (h.dom as unknown as { getBounds(): Phaser.Geom.Rectangle }).getBounds();
  const pad = h.outlinePad;
  if (pad <= 0) {
    return b;
  }
  return new Phaser.Geom.Rectangle(b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad);
}

/**
 * Same behavior as legacy {@link buildGuiOverlay} clamp for Speaking Text — works for bitmap and DOM lines.
 */
export function clampGuiTextLineBottomCenterToScreen(
  line: GuiTextLineHandle,
  anchorX: number,
  anchorY: number,
  viewW: number,
  inset: number,
): void {
  guiTextLineSetOrigin(line, 0.5, 1);
  guiTextLineSetPosition(line, Math.round(anchorX), Math.round(anchorY));
  guiTextLineSyncAfterMainMove(line);
  const bb = guiTextLineGetBoundsUnion(line);
  if (!(bb.width > 0 && bb.height > 0)) {
    return;
  }
  const minX = inset;
  const maxX = viewW - inset;
  const minY = inset;
  let dx = 0;
  let dy = 0;
  const innerW = maxX - minX;
  const spanW = bb.width;
  if (innerW > 0 && spanW <= innerW) {
    if (bb.left < minX) {
      dx = minX - bb.left;
    } else if (bb.right > maxX) {
      dx = maxX - bb.right;
    }
  } else if (innerW > 0) {
    dx = minX - bb.left;
  }
  if (bb.top < minY) {
    dy = minY - bb.top;
  }
  if (dx !== 0 || dy !== 0) {
    const mainX = line.kind === 'bitmap' ? line.main.x : line.dom.x;
    const mainY = line.kind === 'bitmap' ? line.main.y : line.dom.y;
    guiTextLineSetPosition(line, Math.round(mainX + dx), Math.round(mainY + dy));
    guiTextLineSyncAfterMainMove(line);
  }
}

function finalizeDomHandle(p: CreateGuiTextLineParams, dom: Phaser.GameObjects.DOMElement, outlinePad: number): GuiTextLineHandle {
  const handle: GuiTextLineHandle = { kind: 'dom', dom, outlinePad };
  if (p.parent) {
    for (const go of guiTextLinePackObjects(handle)) {
      p.parent.add(go);
    }
  }
  return handle;
}

export function createGuiTextLineHandle(p: CreateGuiTextLineParams): GuiTextLineHandle {
  if (p.backend === 'dom') {
    ensureBenneDomGuiFontFacesRegistered();
    ensureBenneDomGuiTextBaseCss();
    const align = p.align ?? 'left';
    const ta = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const maxW = p.wordWrapWidth != null && p.wordWrapWidth > 0 ? `${Math.floor(p.wordWrapWidth)}px` : '';
    const ls = p.letterSpacing != null && p.letterSpacing !== 0 ? `${p.letterSpacing}px` : '';
    const shadow = guiTextOutlineToCssTextShadow(p.textOutline);
    const domPx = effectiveDomGuiFontSizePx(p.scene, p.fontKey, p.fontSize);
    const style: Record<string, string> = {
      fontFamily: `'${p.cssFamily}',monospace`,
      fontSize: `${domPx}px`,
      lineHeight: `${domPx}px`,
      color: p.colorHex.startsWith('#') ? p.colorHex : `#${p.colorHex}`,
      textAlign: ta,
      textShadow: shadow,
      maxWidth: maxW,
      letterSpacing: ls,
      display: 'inline-block',
    };
    const dom = p.scene.add.dom(p.x, p.y, 'span', style, p.initialText);
    dom.setClassName('benne-gui-text benne-gui-text--pixelated');
    const oa = originFromAlign(p.align);
    dom.setOrigin(oa.x, p.labelOriginY ?? oa.y);
    dom.setDepth(p.depth);
    dom.setScrollFactor(0, 0);
    dom.setVisible(p.visible);
    dom.pointerEvents = 'none';
    dom.updateSize();
    return finalizeDomHandle(p, dom, guiTextOutlineMaxAbsOffsetForBounds(p.textOutline));
  }

  const lineAlign = bitmapTextLineAlign(p.align);
  const bt = p.scene.add.bitmapText(
    p.x,
    p.y,
    p.fontKey,
    p.initialText,
    p.bitmapRenderSize,
    lineAlign,
  );
  configureBenneGuiBitmapTextForRoundPixels(bt);
  const oa = originFromAlign(p.align);
  bt.setOrigin(oa.x, p.labelOriginY ?? oa.y);
  const mainTint = hexStringToTint(p.colorHex);
  applyGuiBitmapTextFillTint(bt, mainTint);
  bt.setData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY, mainTint);
  if (p.letterSpacing != null && p.letterSpacing !== 0) {
    bt.setLetterSpacing(p.letterSpacing);
  }
  if (p.wordWrapWidth != null && p.wordWrapWidth > 0) {
    const mw = Math.floor(p.wordWrapWidth);
    if (mw > 0) {
      bt.setMaxWidth(mw % 2 === 0 ? mw : mw - 1);
    }
  }
  bt.setScrollFactor(0, 0);
  bt.setVisible(p.visible);
  const outs = createGuiBitmapTextOutlines(
    p.scene,
    bt,
    p.textOutline,
    p.visible,
    p.outlineDepthCeiling,
  );
  bt.setDepth(p.depth);
  const handle: GuiTextLineHandle = { kind: 'bitmap', main: bt, outlines: outs };
  if (p.parent) {
    for (const go of guiTextLinePackObjects(handle)) {
      p.parent.add(go);
    }
  }
  return handle;
}

/**
 * Measures DOM label bounds for grid sizing (destroys a temporary `DOMElement`).
 */
export function estimateDomGuiTextBlockSize(
  scene: Phaser.Scene,
  c: Pick<GuiTextControl, 'font' | 'fontSize' | 'align' | 'wordWrapWidth' | 'letterSpacing' | 'textOutline' | 'color'>,
  initial: string,
): { w: number; h: number } {
  ensureBenneDomGuiFontFacesRegistered();
  ensureBenneDomGuiTextBaseCss();
  const css = getDomFontCssFamilyForBitmapFontId(c.font);
  if (!css) {
    return { w: 64, h: 16 };
  }
  const align = c.align ?? 'left';
  const ta = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  const maxW = c.wordWrapWidth != null && c.wordWrapWidth > 0 ? `${Math.floor(c.wordWrapWidth)}px` : '';
  const ls = c.letterSpacing != null && c.letterSpacing !== 0 ? `${c.letterSpacing}px` : '';
  const shadow = guiTextOutlineToCssTextShadow(c.textOutline);
  const color = (c.color ?? '#ffffff').startsWith('#') ? (c.color ?? '#ffffff') : `#${c.color ?? 'ffffff'}`;
  const domPx = effectiveDomGuiFontSizePx(scene, c.font, c.fontSize);
  const style: Record<string, string> = {
    fontFamily: `'${css}',monospace`,
    fontSize: `${domPx}px`,
    lineHeight: `${domPx}px`,
    color,
    textAlign: ta,
    textShadow: shadow,
    maxWidth: maxW,
    letterSpacing: ls,
    display: 'inline-block',
  };
  const dom = scene.add.dom(0, 0, 'span', style, initial);
  dom.setClassName('benne-gui-text benne-gui-text--pixelated');
  const oa = originFromAlign(c.align);
  dom.setOrigin(oa.x, oa.y);
  dom.setVisible(false);
  dom.pointerEvents = 'none';
  dom.updateSize();
  const b = (dom as unknown as { getBounds(): Phaser.Geom.Rectangle }).getBounds();
  dom.destroy();
  const pad = guiTextOutlineMaxAbsOffsetForBounds(c.textOutline);
  return {
    w: Math.max(1, Math.round(b.width) + 2 * pad),
    h: Math.max(1, Math.round(b.height) + 2 * pad),
  };
}
