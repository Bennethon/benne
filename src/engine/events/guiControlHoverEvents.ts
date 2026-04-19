/**
 * Event names for **GUI control pointer hover** (enter / leave).
 * Emitted by `buildGuiOverlay` for any control with a stable **`id`** (`button`, `image`,
 * `inventoryPanel`, `trigger`, `text`); {@link import('../scripting/GuiBenneScript.js').GuiBenneScript}
 * subscribes here via **`B.whenMouseEnter`** / **`B.whenMouseLeave`**.
 */

const GUI_PREFIX = 'gui:';

/** `gui:<guiId>:control:<controlId>:mouseenter` — pointer entered a GUI control’s hit area. */
export function guiControlMouseEnterEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:control:${controlId}:mouseenter`;
}

/** `gui:<guiId>:control:<controlId>:mouseleave` — pointer left a GUI control’s hit area. */
export function guiControlMouseLeaveEventId(guiId: string, controlId: string): string {
  return `${GUI_PREFIX}${guiId}:control:${controlId}:mouseleave`;
}
