import { getUiTextSettings } from '../ConfigManager';
import type { GameSettingsTextRendering } from '../../types/game';
import type { GuiTextRenderingOverride } from '../../types/gui';

export type ResolvedBenneGuiTextBackend = 'bitmap' | 'dom';

/**
 * Resolves whether a `text` / `button` label uses DOM or BitmapText from {@link getUiTextSettings}
 * and an optional per-control override. When **`hasDomFontEntry`** is false, DOM is never chosen
 * (falls back to bitmap; warns in dev when a control asked for DOM).
 */
export function resolveGuiTextBackendForControl(
  controlOverride: GuiTextRenderingOverride | undefined,
  hasDomFontEntry: boolean,
): ResolvedBenneGuiTextBackend {
  const { textRendering: mode } = getUiTextSettings();
  if (!hasDomFontEntry) {
    if (wantsDom(mode, controlOverride)) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Benne] DOM GUI text was requested but `fonts-dom.json` has no TTF mapping for this bitmap font id — using BitmapText.',
        );
      }
    }
    return 'bitmap';
  }
  if (mode === 'bitmap') {
    if (import.meta.env.DEV && controlOverride === 'dom') {
      console.warn(
        '[Benne] `ui.text.textRendering` is `bitmap`; ignoring per-control `textRendering: "dom"`.',
      );
    }
    return 'bitmap';
  }
  if (mode === 'dom') {
    if (controlOverride === 'bitmap') {
      return 'bitmap';
    }
    return 'dom';
  }
  // hybrid — default bitmap; opt in per control
  if (controlOverride === 'dom') {
    return 'dom';
  }
  return 'bitmap';
}

function wantsDom(mode: GameSettingsTextRendering, controlOverride: GuiTextRenderingOverride | undefined): boolean {
  if (controlOverride === 'dom') {
    return true;
  }
  return mode === 'dom';
}
