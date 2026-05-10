import * as Phaser from 'phaser';
import type { GuiTextOutline, GuiTextOutlineSides } from '../../types/gui';

/** `BitmapText.setData` key for sibling outline layers behind this main label. */
export const BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY = 'benneGuiOutlineTexts';

/** Per-outline pixel offset from the main label (same parent / coordinate space). */
export const BENNE_GUI_OUTLINE_DX_KEY = 'benneGuiOutlineDx';
export const BENNE_GUI_OUTLINE_DY_KEY = 'benneGuiOutlineDy';

/** Main-line fill tint; reapplied in {@link syncOutlinedGuiBitmapTextAll} after `setText`. */
export const BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY = 'benneGuiBitmapTextFillTint';

/** Outline clone fill tint / alpha; reapplied in {@link syncOutlinedGuiBitmapTextAll} after `setText`. */
export const BENNE_GUI_OUTLINE_FILL_TINT_KEY = 'benneGuiOutlineFillTint';
export const BENNE_GUI_OUTLINE_FILL_ALPHA_KEY = 'benneGuiOutlineFillAlpha';

/**
 * Phaser 4 removed `setTintFill`; use {@link Phaser.GameObjects.Components.Tint.setTint} +
 * {@link Phaser.TintModes.FILL} so multiply is not applied to already-colored glyph pixels.
 */
export function applyGuiBitmapTextFillTint(go: Phaser.GameObjects.BitmapText, tint: number): void {
  go.clearTint();
  go.setTint(tint);
  go.setTintMode(Phaser.TintModes.FILL);
  go.tintTopLeft = go.tintTopRight = go.tintBottomLeft = go.tintBottomRight = tint;
}

const SIDE_UNIT_DIRS: Record<GuiTextOutlineSides, readonly [number, number][]> = {
  allSides: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
  topLeft: [
    [-1, -1],
    [-1, 0],
    [0, -1],
  ],
  top: [
    [-1, -1],
    [0, -1],
    [1, -1],
  ],
  topRight: [
    [0, -1],
    [1, -1],
    [1, 0],
  ],
  left: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
  ],
  right: [
    [1, -1],
    [1, 0],
    [1, 1],
  ],
  bottomLeft: [
    [-1, 0],
    [-1, 1],
    [0, 1],
  ],
  bottom: [
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
  bottomRight: [
    [0, 1],
    [1, 1],
    [1, 0],
  ],
};

function collectOutlinePixelOffsets(sides: GuiTextOutlineSides, thickness: number): { dx: number; dy: number }[] {
  const t = Math.max(1, Math.trunc(thickness));
  const units = SIDE_UNIT_DIRS[sides] ?? SIDE_UNIT_DIRS.allSides;
  const seen = new Set<string>();
  const out: { dx: number; dy: number }[] = [];
  for (const [ux, uy] of units) {
    for (let k = 1; k <= t; k += 1) {
      const dx = ux * k;
      const dy = uy * k;
      const key = `${dx},${dy}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ dx, dy });
      }
    }
  }
  return out;
}

export function guiTextOutlineMaxAbsOffsetForBounds(o: GuiTextOutline | undefined): number {
  const resolved = resolveEffectiveGuiTextOutline(o);
  if (!resolved) {
    return 0;
  }
  let m = 0;
  for (const { dx, dy } of resolved.offsets) {
    m = Math.max(m, Math.abs(dx), Math.abs(dy));
  }
  return m;
}

function parseRgbTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0x000000;
  }
}

export function resolveEffectiveGuiTextOutline(o: GuiTextOutline | undefined): {
  tint: number;
  alpha: number;
  offsets: readonly { dx: number; dy: number }[];
} | null {
  if (!o || o.enabled !== true) {
    return null;
  }
  const thickness = Math.max(1, Math.trunc(o.thickness ?? 1));
  const sidesRaw = o.sides;
  const sides: GuiTextOutlineSides =
    typeof sidesRaw === 'string' && sidesRaw in SIDE_UNIT_DIRS
      ? (sidesRaw as GuiTextOutlineSides)
      : 'allSides';
  const offsets = collectOutlinePixelOffsets(sides, thickness);
  if (offsets.length === 0) {
    return null;
  }
  const raw = typeof o.color === 'string' ? o.color.trim() : '';
  const tint = parseRgbTint(raw.length > 0 ? raw : '#000000');
  let alpha = typeof o.alpha === 'number' && Number.isFinite(o.alpha) ? o.alpha : 1;
  alpha = Math.min(1, Math.max(0, alpha));
  return { tint, alpha, offsets };
}

export function attachGuiBitmapTextOutlineList(
  main: Phaser.GameObjects.BitmapText,
  outlines: readonly Phaser.GameObjects.BitmapText[],
): void {
  main.setData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY, [...outlines]);
}

/**
 * Repositions outline copies to stay locked to `main` after `main` moves or its origin changes
 * (e.g. Speaking Text {@link GuiOverlayHandle.setPrimaryScreenPositionBottomCenter}).
 */
export function syncOutlinedGuiBitmapTextPositions(main: Phaser.GameObjects.BitmapText): void {
  const outs = main.getData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY) as Phaser.GameObjects.BitmapText[] | undefined;
  if (!Array.isArray(outs) || outs.length === 0) {
    return;
  }
  const ox = main.originX;
  const oy = main.originY;
  const mx = main.x;
  const my = main.y;
  for (const o of outs) {
    const dx = Number(o.getData(BENNE_GUI_OUTLINE_DX_KEY));
    const dy = Number(o.getData(BENNE_GUI_OUTLINE_DY_KEY));
    const rdx = Number.isFinite(dx) ? dx : 0;
    const rdy = Number.isFinite(dy) ? dy : 0;
    o.setOrigin(ox, oy);
    o.setPosition(mx + rdx, my + rdy);
  }
}

export function syncOutlinedGuiBitmapTextAll(main: Phaser.GameObjects.BitmapText, text: string): void {
  main.setText(text);
  const mainFill = main.getData(BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY);
  if (typeof mainFill === 'number') {
    applyGuiBitmapTextFillTint(main, mainFill);
  }
  const outs = main.getData(BENNE_GUI_BITMAP_TEXT_OUTLINE_KEY) as Phaser.GameObjects.BitmapText[] | undefined;
  if (Array.isArray(outs)) {
    for (const o of outs) {
      o.setText(text);
      const fillTint = o.getData(BENNE_GUI_OUTLINE_FILL_TINT_KEY);
      if (typeof fillTint === 'number') {
        applyGuiBitmapTextFillTint(o, fillTint);
        const fillAlpha = o.getData(BENNE_GUI_OUTLINE_FILL_ALPHA_KEY);
        if (typeof fillAlpha === 'number') {
          o.setAlpha(fillAlpha);
        }
      }
    }
  }
  syncOutlinedGuiBitmapTextPositions(main);
}
