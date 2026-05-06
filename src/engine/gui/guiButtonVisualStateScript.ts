import type { BenneGuiScriptButtonVisualState } from '../../types/gui';

/** Stored on GUI button hit containers (`buildGuiOverlay` → `buildGuiButton`). */
export const BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY = 'benneGuiButtonApplyVisualState' as const;

/**
 * When **`true`**, pointer-driven sprite / label swaps are suppressed so scripted **`.setVisualState`**
 * stays in control until **`setVisualState('normal')`** clears it (`GuiRuntime` **ControlFacade**).
 */
export const BENNE_GUI_BUTTON_VISUAL_SCRIPT_LOCK_DATA_KEY = 'benneGuiButtonVisualScriptLock' as const;

export type BenneGuiButtonApplyVisualStateFn = (state: BenneGuiScriptButtonVisualState) => void;

export function parseBenneGuiScriptButtonVisualState(raw: string): BenneGuiScriptButtonVisualState {
  const s = raw.trim().toLowerCase();
  if (s === 'normal' || s === 'hover' || s === 'pressed' || s === 'disabled') {
    return s;
  }
  throw new Error(
    `[Benne] GUI control .setVisualState: expected "normal", "hover", "pressed", or "disabled"; got ${JSON.stringify(raw)}.`,
  );
}

/** @internal Wired by `buildGuiButton`; read by pointer listeners + **ControlFacade.setVisualState**. */
export function benneGuiButtonReadVisualScriptLock(holder: {
  getData?: (key: string) => unknown;
}): boolean {
  return typeof holder.getData === 'function'
    ? holder.getData(BENNE_GUI_BUTTON_VISUAL_SCRIPT_LOCK_DATA_KEY) === true
    : false;
}
