/**
 * Event names for GUI checkbox check / uncheck (GUI-scoped Bennescript).
 * The overlay compositor emits these on `gameEvents`; BenneScript's `x.onChange(…)` subscribes here.
 */

const GUI_PREFIX = 'gui:';

/** `gui:<guiId>:checkbox:<checkboxId>:check` — player toggled this control to checked. */
export function guiCheckboxCheckEventId(guiId: string, checkboxId: string): string {
  return `${GUI_PREFIX}${guiId}:checkbox:${checkboxId}:check`;
}

/** `gui:<guiId>:checkbox:<checkboxId>:uncheck` — player toggled this control to unchecked. */
export function guiCheckboxUncheckEventId(guiId: string, checkboxId: string): string {
  return `${GUI_PREFIX}${guiId}:checkbox:${checkboxId}:uncheck`;
}
