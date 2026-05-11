import * as Phaser from 'phaser';

/**
 * WebGL defaults can leave BMFont atlas textures on LINEAR filtering when scaled from the internal resolution,
 * which smears pixel fonts. Call as soon as the font is in `cache.bitmapFont` (after loader processing).
 */
export function applyNearestFilterToBitmapFontTexture(scene: Phaser.Scene, fontKey: string): void {
  if (!scene.cache.bitmapFont.exists(fontKey)) {
    return;
  }
  const entry = scene.cache.bitmapFont.get(fontKey) as { texture?: string } | undefined;
  const texKey =
    typeof entry?.texture === 'string' && entry.texture.length > 0 ? entry.texture : fontKey;
  if (!scene.textures.exists(texKey)) {
    return;
  }
  scene.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * Listens for each finished `bitmapfont` load and applies {@link applyNearestFilterToBitmapFontTexture}.
 * Removes the listener when the queue completes. In development, logs loaded font keys once per loader run.
 */
export function wireBenneBitmapFontNearestFilterOnLoader(scene: Phaser.Scene): void {
  const loader = scene.load;
  const onFileComplete = (key: string, type: string): void => {
    if (type !== 'bitmapfont') {
      return;
    }
    applyNearestFilterToBitmapFontTexture(scene, key);
  };
  loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
  loader.once(Phaser.Loader.Events.COMPLETE, () => {
    loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    if (import.meta.env.DEV) {
      const keys = scene.cache.bitmapFont.getKeys();
      if (keys.length > 0) {
        console.log('[Benne] Bitmap font textures → NEAREST (WebGL). Font keys:', keys.join(', '));
      }
    }
  });
}
