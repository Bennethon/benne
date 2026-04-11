import type * as Phaser from 'phaser';
import type { GameFontsManifest } from '../types/fonts';
import { collectFontIdsReferencedByGuiControls } from './loadGuiData';
import gameFontsManifest from './assets/fonts/fonts.json';
import { resolveGameAssetUrl, resolveGameAssetXmlUrl } from './resolveGameAssetUrl';

const manifest = gameFontsManifest as GameFontsManifest;

/** Queue `load.bitmapFont` for every font id used by GUI text controls (see `fonts/fonts.json`). */
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
      const tex = resolveGameAssetUrl(`fonts/${def.textureFile}`);
      const xml = resolveGameAssetXmlUrl(`fonts/${def.dataFile}`);
      loader.bitmapFont(fontId, tex, xml);
    } catch (e) {
      console.error(`[Benne] Failed to resolve bitmap font files for id "${fontId}":`, e);
    }
  }
}
