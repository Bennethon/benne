const BASE_STYLE_ID = 'benne-dom-gui-text-base';

/**
 * Shared CSS for DOM GUI labels (retro-friendly defaults; a11y variant reserved).
 */
export function ensureBenneDomGuiTextBaseCss(): void {
  if (typeof document === 'undefined' || document.getElementById(BASE_STYLE_ID)) {
    return;
  }
  const sheet = document.createElement('style');
  sheet.id = BASE_STYLE_ID;
  sheet.textContent = [
    '.benne-gui-text{box-sizing:border-box;margin:0;padding:0;line-height:1;white-space:pre-wrap;word-break:break-word;pointer-events:none;}',
    '.benne-gui-text--pixelated{-webkit-font-smoothing:none;font-smooth:never;}',
    '.benne-gui-text--a11y{font-family:system-ui,Segoe UI,Roboto,sans-serif !important;-webkit-font-smoothing:auto;font-smooth:always;}',
  ].join('');
  document.head.append(sheet);
}
