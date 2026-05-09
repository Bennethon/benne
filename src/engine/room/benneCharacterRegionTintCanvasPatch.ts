import * as Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Character region tint — Canvas renderer patch
//
// Phaser 4's Canvas renderer (`batchSprite` in CanvasRenderer.js) draws sprites
// with plain `ctx.drawImage` and never consults the Tint component, which is
// marked @webglOnly.  BENNE uses the Canvas renderer, so `setTint` / `clearTint`
// would be silently ignored.
//
// This patch intercepts `Sprite.prototype.renderCanvas` and
// `Image.prototype.renderCanvas` for any character sprite that carries the
// BENNE_REGION_TINT_COLOR_KEY data key.  It draws the frame to a reused
// offscreen canvas, overlays the tint colour using `source-atop` compositing
// (so only opaque pixels are affected), then calls `renderer.batchSprite` with
// a mock frame that points to the tinted offscreen canvas.
//
// Installed once via side-effect import from RoomScene.ts.
// ---------------------------------------------------------------------------

export const BENNE_REGION_TINT_COLOR_KEY = 'benne:regionTintColor';
export const BENNE_REGION_TINT_ALPHA_KEY = 'benne:regionTintAlpha';

// Single reusable offscreen canvas; grown as needed, never shrunk.
let offCanvas: HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | null = null;

function ensureOffCtx(minW: number, minH: number): CanvasRenderingContext2D {
  if (!offCanvas) {
    offCanvas = document.createElement('canvas');
    offCtx = offCanvas.getContext('2d', { willReadFrequently: false })!;
  }
  if (offCanvas.width < minW) {
    offCanvas.width = minW;
  }
  if (offCanvas.height < minH) {
    offCanvas.height = minH;
  }
  return offCtx!;
}

type SpriteOrImage = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

function hasRegionTint(src: SpriteOrImage): boolean {
  const raw = src as unknown as { data?: { list?: Record<string, unknown> } };
  return raw.data?.list != null && Object.hasOwn(raw.data.list, BENNE_REGION_TINT_COLOR_KEY);
}

/**
 * Builds a mock Phaser frame object that points at the tinted offscreen canvas.
 * `batchSprite` reads only the fields listed here, so a plain object suffices.
 */
function buildTintedMockFrame(
  frame: Phaser.Textures.Frame,
  tintColor: number,
  tintAlpha: number,
): Record<string, unknown> {
  const cd = frame.canvasData as { x: number; y: number };
  const fw = frame.cutWidth;
  const fh = frame.cutHeight;
  const image = frame.source.image as CanvasImageSource;

  const ctx = ensureOffCtx(fw, fh);

  // 1. Clear the area we will use (avoids bleed from previous frames).
  ctx.clearRect(0, 0, fw, fh);

  // 2. Draw the original frame at (0, 0) on the offscreen canvas.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(image, cd.x, cd.y, fw, fh, 0, 0, fw, fh);

  // 3. Overlay the tint colour clipped to the sprite's opaque pixels.
  //    `source-atop`: new drawing only appears where the destination (sprite) is
  //    non-transparent, so transparent frame margins are left untouched.
  const r = (tintColor >> 16) & 0xff;
  const g = (tintColor >> 8) & 0xff;
  const b = tintColor & 0xff;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = tintAlpha;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, fw, fh);

  // 4. Restore context state.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // 5. Return a mock frame that points to (0,0) in the tinted offscreen canvas.
  //    batchSprite uses: canvasData.{x,y}, cutWidth, cutHeight, customPivot,
  //    source.{image, resolution, scaleMode}, x, y, realWidth, realHeight.
  return {
    canvasData: { x: 0, y: 0 },
    cutWidth: fw,
    cutHeight: fh,
    customPivot: frame.customPivot,
    source: {
      image: offCanvas!,
      resolution: frame.source.resolution,
      scaleMode: frame.source.scaleMode,
    },
    x: frame.x,
    y: frame.y,
    realWidth: frame.realWidth,
    realHeight: frame.realHeight,
  };
}

function renderWithRegionTint(
  renderer: Phaser.Renderer.Canvas.CanvasRenderer,
  src: SpriteOrImage,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix: Phaser.GameObjects.Components.TransformMatrix | undefined,
): void {
  camera.addToRenderList(src);

  const tintColor = src.getData(BENNE_REGION_TINT_COLOR_KEY) as number | null | undefined;
  if (tintColor == null || (src as { isCropped?: boolean }).isCropped) {
    // No tint or cropped frame: fall back to the normal batchSprite path.
    renderer.batchSprite(src, src.frame, camera, parentMatrix);
    return;
  }

  const tintAlpha = (src.getData(BENNE_REGION_TINT_ALPHA_KEY) as number | null | undefined) ?? 1;
  const mockFrame = buildTintedMockFrame(src.frame, tintColor, tintAlpha);
  renderer.batchSprite(src, mockFrame as unknown as Phaser.Textures.Frame, camera, parentMatrix);
}

let installed = false;

/**
 * Patches `Sprite.prototype.renderCanvas` and `Image.prototype.renderCanvas`
 * once so that sprites carrying {@link BENNE_REGION_TINT_COLOR_KEY} are drawn
 * with the tint overlay in Canvas mode.  All other sprites pass through
 * unchanged with negligible overhead (one property-existence check per frame).
 *
 * Installed via the side-effect import at the bottom of this module.
 */
export function installCharacterRegionTintCanvasPatch(): void {
  if (installed) {
    return;
  }
  installed = true;

  type RenderFn<T> = (
    this: T,
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    src: T,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => void;

  function patchProto<T extends SpriteOrImage>(proto: { renderCanvas?: RenderFn<T> }): void {
    const orig = proto.renderCanvas;
    if (typeof orig !== 'function') {
      return;
    }
    proto.renderCanvas = function patchedRenderCanvas(
      this: T,
      renderer: Phaser.Renderer.Canvas.CanvasRenderer,
      src: T,
      camera: Phaser.Cameras.Scene2D.Camera,
      parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
    ): void {
      if (!hasRegionTint(src)) {
        orig.call(this, renderer, src, camera, parentMatrix);
        return;
      }
      renderWithRegionTint(renderer, src, camera, parentMatrix);
    };
  }

  patchProto<Phaser.GameObjects.Sprite>(
    Phaser.GameObjects.Sprite.prototype as { renderCanvas?: RenderFn<Phaser.GameObjects.Sprite> },
  );
  patchProto<Phaser.GameObjects.Image>(
    Phaser.GameObjects.Image.prototype as { renderCanvas?: RenderFn<Phaser.GameObjects.Image> },
  );
}

installCharacterRegionTintCanvasPatch();
