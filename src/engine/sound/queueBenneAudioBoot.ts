import type * as Phaser from 'phaser';
import { getBenneAudioBootEntries } from '../content/resolveGameAssetUrl.js';

/** Queues every bundled `assets/audio/sfx`, `assets/audio/music`, and `assets/audio/voice` file. */
export function queueBenneAudioForBootLoader(load: Phaser.Loader.LoaderPlugin): void {
  const { sfx, music, voice } = getBenneAudioBootEntries();
  for (const e of sfx) {
    const u = e.urls;
    load.audio(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
  for (const e of music) {
    const u = e.urls;
    load.audio(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
  for (const e of voice) {
    const u = e.urls;
    load.audio(e.cacheKey, u.length === 1 ? u[0]! : [...u]);
  }
}
