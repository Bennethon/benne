import type { GameFontsManifest } from '../types/fonts';
import type { GuiData } from '../types/gui';

export type GuiFontLoadRequest = { fontId: string; textureUrl: string; dataUrl: string };

/**
 * Bitmap font files to load for one GUI's `text` controls (deduped by font id).
 * `resolveAssetUrl` maps paths under `src/game/assets/` to a fetchable URL.
 */
export function collectFontLoadsForGui(
  gui: GuiData,
  manifest: GameFontsManifest,
  resolveAssetUrl: (pathUnderAssets: string) => string,
): GuiFontLoadRequest[] {
  const out: GuiFontLoadRequest[] = [];
  const seen = new Set<string>();
  for (const c of gui.controls ?? []) {
    if (c.type !== 'text' && c.type !== 'verbLine' && c.type !== 'button') {
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
        textureUrl: resolveAssetUrl(`fonts/${def.textureFile}`),
        dataUrl: resolveAssetUrl(`fonts/${def.dataFile}`),
      });
    } catch (e) {
      console.warn(`[BENNE GUI preview] Could not resolve font files for "${c.font}":`, e);
    }
  }
  return out;
}

export function guiHasTextControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'text');
}

export function guiHasVerbLineControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'verbLine');
}

export function guiHasImageControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'image');
}

export function guiHasButtonControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'button');
}

export function guiHasTriggerControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'trigger');
}

export function guiHasGridControls(gui: GuiData): boolean {
  return (gui.controls ?? []).some((c) => c.type === 'grid');
}
