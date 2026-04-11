/**
 * Bitmap font registry in `src/game/assets/fonts/fonts.json`.
 * Loader keys and GUI `text` control `font` use the same string as the object key.
 *
 * **Export checklist (BMFont / Bitmap Font Generator):** use `smooth=0` for pixel fonts; if glyphs look soft,
 * try `aa=0` in the exported XML where the tool allows; prefer **1px padding** on the atlas to limit neighbor bleed;
 * match in-game `fontSize` to the exported pixel size (BMFont `info size` magnitude).
 */
export interface GameBitmapFontDefinition {
  /** Image file under `src/game/assets/fonts/` (e.g. BMFont page PNG). */
  textureFile: string;
  /** BMFont `.xml` under `src/game/assets/fonts/`. */
  dataFile: string;
  /**
   * Default Phaser `BitmapText` letter spacing for this font when a GUI text control omits `letterSpacing`.
   * Use small integers (often 0 or 1) to correct tight `xadvance` from the exporter without affecting other fonts.
   */
  defaultLetterSpacing?: number;
}

export type GameFontDefinition = GameBitmapFontDefinition;

export type GameFontsManifest = Record<string, GameFontDefinition>;
