import type * as Phaser from 'phaser';
import { getBenneAudioBootEntries } from '../../game/boot/resolveGameAssetUrl.js';

/** Queues every bundled `assets/audio/sfx` + `assets/audio/music` file for the boot loader. */
export function queueBenneAudioForBootLoader(load: Phaser.Loader.LoaderPlugin): void {
  const { sfx, music } = getBenneAudioBootEntries();
  for (const e of sfx) {
    const u = e.urls;
    load.audio(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
  for (const e of music) {
    const u = e.urls;
    load.audio(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
}
