/**
 * Event names for GUI button clicks (GUI-scoped Bennescript + future compositor input).
 * The overlay compositor emits these on `gameEvents`; BenneScript's `x.onClick(…)` subscribes here.
 */

/** Payload for {@link guiAllButtonsClickEventId} (catch-all within one GUI). */
export interface GuiAllButtonsClickPayload {
  buttonId: string;
}

const GUI_PREFIX = 'gui:';

/** `gui:<guiId>:button:<buttonId>:click` — one control id per GUI script file. */
export function guiButtonClickEventId(guiId: string, buttonId: string): string {
  return `${GUI_PREFIX}${guiId}:button:${buttonId}:click`;
}

/**
 * `gui:<guiId>:allButtons:click` — fired for every enabled button activation; handlers receive
 * {@link GuiAllButtonsClickPayload}. Distinct from any literal `buttonId` so ids cannot collide.
 */
export function guiAllButtonsClickEventId(guiId: string): string {
  return `${GUI_PREFIX}${guiId}:allButtons:click`;
}
