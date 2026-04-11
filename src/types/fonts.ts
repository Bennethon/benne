/**
 * Bitmap font registry in `src/game/assets/fonts/fonts.json`.
 * Loader keys and GUI `text` control `font` use the same string as the object key.
 */
export interface GameBitmapFontDefinition {
  /** Image file under `src/game/assets/fonts/` (e.g. BMFont page PNG). */
  textureFile: string;
  /** BMFont `.xml` under `src/game/assets/fonts/`. */
  dataFile: string;
}

export type GameFontDefinition = GameBitmapFontDefinition;

export type GameFontsManifest = Record<string, GameFontDefinition>;
