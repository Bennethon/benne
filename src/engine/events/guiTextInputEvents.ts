/**
 * Event names for GUI text input changes and submits (GUI-scoped Bennescript).
 */

const GUI_PREFIX = 'gui:';

export interface GuiTextInputValueChangedPayload {
  newValue: string;
  oldValue: string;
}

export interface GuiTextInputSubmitPayload {
  finalValue: string;
}

/** `gui:<guiId>:textInput:<controlId>:valueChanged` — player edited text. */
export function guiTextInputValueChangedEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:textInput:${controlId}:valueChanged`;
}

/** `gui:<guiId>:textInput:<controlId>:submit` — player submitted final value. */
export function guiTextInputSubmitEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:textInput:${controlId}:submit`;
}
