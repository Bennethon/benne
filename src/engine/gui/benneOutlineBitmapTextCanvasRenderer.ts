import * as Phaser from 'phaser';
import {
  BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY,
  BENNE_GUI_OUTLINE_CANVAS_TINT_KEY,
  BENNE_GUI_OUTLINE_DX_KEY,
} from './guiTextOutline';

// ---------------------------------------------------------------------------
// Pre-tinted atlas cache
//
// Rather than doing per-glyph offscreen canvas work every frame, we build a
// colorised copy of the font atlas *once* per (source image, tint colour)
// pair.  Subsequent render calls just swap in the cached canvas as the
// drawImage source — zero per-glyph overhead.
//
// Requirements for the font atlas PNG:
//   • Glyphs must be rendered on a TRANSPARENT background (the standard for
//     Phaser BitmapText / BMFont PNGs).  The `destination-in` composite used
//     below masks the solid tint colour with the alpha channel of the
//     original image; if the "background" of the atlas is opaque the same
//     tint colour will appear there too.
// ---------------------------------------------------------------------------

const imageIds = new WeakMap<object, number>();
let nextImageId = 0;

function getImageId(image: object): number {
  let id = imageIds.get(image);
  if (id === undefined) {
    id = nextImageId++;
    imageIds.set(image, id);
  }
  return id;
}

/** Permanent cache: `${imageId}:${tintHex}` → pre-tinted canvas. */
const tintedAtlasCache = new Map<string, HTMLCanvasElement>();

function buildTintedAtlas(image: CanvasImageSource, tint: number): HTMLCanvasElement {
  const src = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const w = src.naturalWidth ?? src.width ?? 1;
  const h = src.naturalHeight ?? src.height ?? 1;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  const r = (tint >> 16) & 0xff;
  const g = (tint >> 8) & 0xff;
  const b = tint & 0xff;

  // 1. Flood the canvas with the solid tint colour.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);

  // 2. `destination-in`: keeps the tint colour only where the original atlas
  //    pixel is opaque, producing coloured glyphs on a transparent background.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(image, 0, 0);

  return canvas;
}

function getTintedAtlas(image: CanvasImageSource, tint: number): HTMLCanvasElement {
  const key = `${getImageId(image)}:${tint}`;
  let cached = tintedAtlasCache.get(key);
  if (!cached) {
    cached = buildTintedAtlas(image, tint);
    tintedAtlasCache.set(key, cached);
  }
  return cached;
}

// ---------------------------------------------------------------------------
// Guard: only intercept BitmapText objects that BENNE created for GUI overlays
// (outline clones or main text labels with a stored fill tint key).
// Avoids touching unrelated BitmapText used elsewhere in the game.
// ---------------------------------------------------------------------------

export function isBenneGuiBitmapTextWithCustomTint(src: Phaser.GameObjects.BitmapText): boolean {
  const raw = src as unknown as { data?: { list?: Record<string, unknown> } };
  const list = raw.data?.list;
  if (list == null) {
    return false;
  }
  return (
    Object.hasOwn(list, BENNE_GUI_OUTLINE_CANVAS_TINT_KEY) ||
    Object.hasOwn(list, BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY)
  );
}

// Keep old name as alias so installBitmapTextCanvasGuiOutlineTintPatch still compiles.
export const isBenneGuiOutlineCanvasTintBitmapText = isBenneGuiBitmapTextWithCustomTint;

// ---------------------------------------------------------------------------
// Private Phaser 4 BitmapText fields that the Canvas renderer reads.
// These are not exposed on the public TypeScript type but exist at runtime.
// ---------------------------------------------------------------------------

type BitmapTextPrivateFields = {
  _text: string;
  _letterSpacing: number;
  /** Line spacing added on top of fontData.lineHeight. */
  _lineSpacing: number;
  /** 0 = left, 1 = center, 2 = right */
  _align: number;
  /** Populated by getTextBounds(); contains per-line metrics. */
  _bounds: {
    lines: {
      longest: number;
      lengths: number[];
    };
  };
};

// ---------------------------------------------------------------------------
// Tinted BitmapText canvas renderer
//
// Mirrors Phaser's BitmapTextCanvasRenderer.js exactly, with the single
// change of replacing `image` with a pre-tinted version from the cache.
// Using private field names (_letterSpacing, _lineSpacing, _align, _text,
// _bounds) that match what Phaser's own Canvas renderer reads — the public
// getters exist but some fields (e.g. lineSpacing) are not consistently
// exposed as public properties in all Phaser 4 builds.
// ---------------------------------------------------------------------------

/** Same helper Phaser's `BitmapTextCanvasRenderer` uses. */
const SetTransform = Phaser.Renderer.Canvas.SetTransform;

type BitmapGlyphChar = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & {
  xAdvance: number;
};

export function renderTintedBitmapTextCanvas(
  renderer: Phaser.Renderer.Canvas.CanvasRenderer,
  src: Phaser.GameObjects.BitmapText,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix: Phaser.GameObjects.Components.TransformMatrix | undefined,
  tint: number,
): void {
  const priv = src as unknown as BitmapTextPrivateFields;

  let text = priv._text;
  let textLength = text.length;

  const ctx = renderer.currentContext;

  if (textLength === 0 || !SetTransform(renderer, ctx, src, camera, parentMatrix)) {
    return;
  }

  camera.addToRenderList(src);

  const textureFrame = src.fromAtlas
    ? src.frame
    : (src.texture.frames as Record<string, Phaser.Textures.Frame>)['__BASE'];

  const originalImage = textureFrame.source.image as CanvasImageSource;

  // Swap in the pre-tinted atlas; white (0xffffff) is a no-op.
  const image = tint === 0xffffff ? originalImage : getTintedAtlas(originalImage, tint);

  const chars = src.fontData.chars as Record<number, BitmapGlyphChar>;
  const lineHeight = src.fontData.lineHeight;
  const letterSpacing = priv._letterSpacing;
  const lineSpacing = priv._lineSpacing;

  let xAdvance = 0;
  let yAdvance = 0;
  let charCode = 0;

  let glyph: BitmapGlyphChar | null = null;
  let glyphX = 0;
  let glyphY = 0;
  let glyphW = 0;
  let glyphH = 0;

  let x = 0;
  let y = 0;

  let lastGlyph: BitmapGlyphChar | null = null;
  let lastCharCode = 0;

  // Glyph positions in the atlas are relative to textureFrame.cutX / cutY.
  // The pre-tinted canvas is a full-size copy of the original image so these
  // offsets remain valid.
  const textureX = textureFrame.cutX;
  const textureY = textureFrame.cutY;

  const scale = src.fontSize / src.fontData.size;
  const align = priv._align;
  let currentLine = 0;
  let lineOffsetX = 0;

  // getTextBounds updates _bounds (wrapping, line metrics).
  const bounds = src.getTextBounds(false);

  if (src.maxWidth > 0) {
    text = bounds.wrappedText;
    textLength = text.length;
  }

  const lineData = priv._bounds.lines;

  if (align === 1) {
    lineOffsetX = (lineData.longest - lineData.lengths[0]) / 2;
  } else if (align === 2) {
    lineOffsetX = lineData.longest - lineData.lengths[0];
  }

  ctx.translate(-src.displayOriginX, -src.displayOriginY);

  const roundPixels = camera.roundPixels;
  let kerningOffset: number | undefined;

  for (let i = 0; i < textLength; i++) {
    charCode = text.charCodeAt(i);

    if (charCode === 10) {
      currentLine++;
      if (align === 1) {
        lineOffsetX = (lineData.longest - lineData.lengths[currentLine]) / 2;
      } else if (align === 2) {
        lineOffsetX = lineData.longest - lineData.lengths[currentLine];
      }
      xAdvance = 0;
      yAdvance += lineHeight + lineSpacing;
      lastGlyph = null;
      continue;
    }

    glyph = chars[charCode] ?? null;
    if (!glyph) {
      continue;
    }

    glyphX = textureX + glyph.x;
    glyphY = textureY + glyph.y;
    glyphW = glyph.width;
    glyphH = glyph.height;

    x = glyph.xOffset + xAdvance;
    y = glyph.yOffset + yAdvance;

    if (lastGlyph !== null) {
      kerningOffset = glyph.kerning[lastCharCode];
      x += kerningOffset !== undefined ? kerningOffset : 0;
    }

    x *= scale;
    y *= scale;
    x += lineOffsetX;

    xAdvance +=
      glyph.xAdvance + letterSpacing + (kerningOffset !== undefined ? kerningOffset : 0);
    lastGlyph = glyph;
    lastCharCode = charCode;

    if (glyphW === 0 || glyphH === 0 || charCode === 32) {
      continue;
    }

    if (roundPixels) {
      x = Math.round(x);
      y = Math.round(y);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(image, glyphX, glyphY, glyphW, glyphH, 0, 0, glyphW, glyphH);
    ctx.restore();
  }

  ctx.restore();
}
