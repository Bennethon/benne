/**
 * Event names for GUI list box selection and activation (GUI-scoped Bennescript).
 */

const GUI_PREFIX = 'gui:';

export interface GuiListBoxSelectionChangedPayload {
  newIndex: number;
  oldIndex: number;
}

export interface GuiListBoxItemActivatedPayload {
  index: number;
}

/** `gui:<guiId>:listBox:<controlId>:selectionChanged` — player changed selected row. */
export function guiListBoxSelectionChangedEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:listBox:${controlId}:selectionChanged`;
}

/** `gui:<guiId>:listBox:<controlId>:itemActivated` — player activated selected row (double-click / Enter). */
export function guiListBoxItemActivatedEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:listBox:${controlId}:itemActivated`;
}
