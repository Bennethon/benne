import type * as Phaser from 'phaser';
import type { GameFontsManifest } from '../types/fonts';
import { collectFontIdsReferencedByGuiControls } from './loadGuiData';
import gameFontsManifest from './assets/fonts/fonts.json';
import { resolveGameFontUrl } from './resolveGameAssetUrl';

const manifest = gameFontsManifest as GameFontsManifest;

/** Queue `load.font` for every font id used by GUI text controls (see `fonts/fonts.json`). */
export function queueGuiFontsForBootLoader(loader: Phaser.Loader.LoaderPlugin): void {
  for (const fontId of collectFontIdsReferencedByGuiControls()) {
    const def = manifest[fontId];
    if (!def) {
      console.error(
        `[Benne] GUI text references unknown font id "${fontId}" — add it to src/game/assets/fonts/fonts.json.`,
      );
      continue;
    }
    try {
      const url = resolveGameFontUrl(`fonts/${def.file}`);
      loader.font(fontId, url, def.format);
    } catch (e) {
      console.error(`[Benne] Failed to resolve font file for id "${fontId}":`, e);
    }
  }
}
