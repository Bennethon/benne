/**
 * Font registry in `src/game/assets/fonts/fonts.json`.
 * Loader keys and `fontFamily` on GUI text controls use the same string as the object key.
 */
export interface GameFontDefinition {
  /** Filename under `src/game/assets/fonts/` (not a path prefix). */
  file: string;
  /** CSS `format("…")` value for FontFace, e.g. `truetype`, `opentype`, `woff2`. */
  format: string;
}

export type GameFontsManifest = Record<string, GameFontDefinition>;
