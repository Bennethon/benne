/**
 * Event names for GUI slider value changes (GUI-scoped Bennescript).
 * The overlay compositor emits these on `gameEvents` when the player changes the value via pointer.
 */

const GUI_PREFIX = 'gui:';

export interface GuiSliderValueChangedPayload {
  value: number;
}

/** `gui:<guiId>:slider:<sliderId>:valueChanged` — player changed this control’s value (pointer-driven). */
export function guiSliderValueChangedEventId(guiId: string, sliderId: string): string {
  return `${GUI_PREFIX}${guiId}:slider:${sliderId}:valueChanged`;
}
