import * as Phaser from 'phaser';
import {
  isBenneGuiBitmapTextWithCustomTint,
  renderTintedBitmapTextCanvas,
} from './benneOutlineBitmapTextCanvasRenderer';

/**
 * Phaser 4's Canvas `BitmapText` renderer (`BitmapTextCanvasRenderer.js`) draws
 * glyphs with plain `ctx.drawImage` and never consults the Tint component, which
 * is marked `@webglOnly`.  BENNE uses the Canvas renderer for pixel-perfect
 * BitmapText rendering, so we must supply our own tint path.
 *
 * This patch intercepts `BitmapText.prototype.renderCanvas` for the small subset
 * of objects that BENNE GUI code has marked with one of:
 *   • {@link BENNE_GUI_OUTLINE_CANVAS_TINT_KEY}  — outline clone layers
 *   • {@link BENNE_GUI_BITMAP_TEXT_FILL_TINT_KEY} — main text labels with a
 *                                                    non-white configured colour
 *
 * For every other `BitmapText` in the game the original renderer is called
 * unchanged.
 *
 * The replacement renderer reads `src.tintTopLeft` (set via `setTint(colour)` in
 * `applyGuiBitmapTextFillTint`) and swaps in a **pre-tinted copy** of the font
 * atlas built once per (source image, colour) pair.  The render loop is then
 * identical to Phaser's original — just a different `drawImage` source — so
 * there is zero per-glyph overhead and no FPS impact.
 *
 * Installed once when this module is first imported.
 */
let installed = false;

export function installBitmapTextCanvasGuiOutlineTintPatch(): void {
  if (installed) {
    return;
  }
  installed = true;

  const BT = Phaser.GameObjects.BitmapText;
  type RenderCanvas = (
    this: Phaser.GameObjects.BitmapText,
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    src: Phaser.GameObjects.BitmapText,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => void;

  const proto = BT.prototype as { renderCanvas?: RenderCanvas };
  const orig = proto.renderCanvas;

  if (typeof orig !== 'function') {
    return;
  }

  proto.renderCanvas = function renderCanvasWithGuiTint(
    this: Phaser.GameObjects.BitmapText,
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    src: Phaser.GameObjects.BitmapText,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ): void {
    // Only intercept BENNE GUI BitmapText objects (outline clones + main labels
    // that have a fill-tint key stored via applyGuiBitmapTextFillTint).
    if (!isBenneGuiBitmapTextWithCustomTint(src)) {
      orig.call(this, renderer, src, camera, parentMatrix);
      return;
    }

    const tint = src.tintTopLeft;

    // 0xffffff == default / white == "no tint" — use the stock renderer.
    if (tint === 0xffffff) {
      orig.call(this, renderer, src, camera, parentMatrix);
      return;
    }

    renderTintedBitmapTextCanvas(renderer, src, camera, parentMatrix, tint);
  };
}

installBitmapTextCanvasGuiOutlineTintPatch();
