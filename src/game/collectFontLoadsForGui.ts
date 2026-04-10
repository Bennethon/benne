import type { GameFontsManifest } from '../types/fonts';
import type { GuiData } from '../types/gui';

export type GuiFontLoadRequest = { fontId: string; url: string; format: string };

/**
 * Font files to load for one GUI's `text` controls (deduped by font id).
 * `resolveAssetUrl` maps paths under `src/game/assets/` (e.g. `fonts/foo.ttf`) to a fetchable URL.
 */
export function collectFontLoadsForGui(
  gui: GuiData,
  manifest: GameFontsManifest,
  resolveAssetUrl: (pathUnderAssets: string) => string,
): GuiFontLoadRequest[] {
  const out: GuiFontLoadRequest[] = [];
  const seen = new Set<string>();
  for (const c of gui.controls ?? []) {
    if (c.type !== 'text') {
      continue;
    }
    if (seen.has(c.font)) {
      continue;
    }
    seen.add(c.font);
    const def = manifest[c.font];
    if (!def) {
      console.warn(`[BENNE GUI preview] Unknown font id "${c.font}" — add it to assets/fonts/fonts.json.`);
      continue;
    }
    try {
      out.push({
        fontId: c.font,
        url: resolveAssetUrl(`fonts/${def.file}`),
        format: def.format,
      });
    } catch (e) {
      console.warn(`[BENNE GUI preview] Could not resolve font file for "${c.font}":`, e);
    }
  }
  return out;
}

export function guiHasTextControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'text');
}
