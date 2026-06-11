import type * as Phaser from 'phaser';
import { getBenneVideoBootEntries } from '../../game/boot/resolveGameAssetUrl.js';

/**
 * Queues every bundled `assets/videos` file for the boot loader. Phaser only registers the URLs in
 * the video cache here; the actual media streams on demand when a {@link Phaser.GameObjects.Video}
 * plays the cache key, so this stays cheap even for large cinematics.
 */
export function queueBenneVideoForBootLoader(load: Phaser.Loader.LoaderPlugin): void {
  for (const e of getBenneVideoBootEntries()) {
    const u = e.urls;
    load.video(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
}
