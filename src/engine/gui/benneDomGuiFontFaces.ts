import type { GameDomFontsManifest } from '../../types/fonts';
import domFontsManifest from '../../game/assets/fonts/fonts-dom.json';
import { resolveGameAssetFontTtfUrl } from '../../game/resolveGameAssetUrl';

const manifest = domFontsManifest as GameDomFontsManifest;

const STYLE_ID = 'benne-dom-gui-font-faces';
let facesInjected = false;

/**
 * Injects one `@font-face` per entry in `fonts-dom.json`. Idempotent; safe to call from BootScene
 * and preview boots before any `DOMElement` text is created.
 */
export function ensureBenneDomGuiFontFacesRegistered(): void {
  if (facesInjected || typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ID)) {
    facesInjected = true;
    return;
  }
  const rules: string[] = [];
  for (const def of Object.values(manifest)) {
    if (!def?.ttfFile || !def.cssFamily) {
      continue;
    }
    const url = resolveGameAssetFontTtfUrl(`fonts/${def.ttfFile}`);
    const fam = def.cssFamily.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    rules.push(
      `@font-face{font-family:'${fam}';src:url('${url}') format('truetype');font-display:swap;}`,
    );
  }
  if (rules.length === 0) {
    facesInjected = true;
    return;
  }
  const sheet = document.createElement('style');
  sheet.id = STYLE_ID;
  sheet.textContent = rules.join('\n');
  document.head.append(sheet);
  facesInjected = true;
}

export function hasDomFontEntryForBitmapFontId(fontId: string): boolean {
  return fontId in manifest && Boolean(manifest[fontId]?.cssFamily && manifest[fontId]?.ttfFile);
}

export function getDomFontCssFamilyForBitmapFontId(fontId: string): string | null {
  const def = manifest[fontId];
  if (!def?.cssFamily) {
    return null;
  }
  return def.cssFamily;
}
