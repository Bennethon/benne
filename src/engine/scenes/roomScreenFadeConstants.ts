/** Default full-screen fade duration when the duration argument is omitted (`BenneScriptCore` fade API). */
export const BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC = 0.35;

export const BENNE_SCREEN_FADE_DEFAULT_COLOR = 0x000000;

/**
 * Renders above HUD, choice-dialog, and display-text GUI overlays; below Speaking Text
 * ({@link SPEAKING_TEXT_OVERLAY_DEPTH}) and the {@link RoomScene} custom game cursor
 * (see `CUSTOM_CURSOR_DEPTH` in `RoomScene.ts`).
 */
export const BENNE_SCREEN_FADE_OVERLAY_DEPTH = 450_000;

/**
 * Speaking Text (`speaking-text`, Bennescript `say`) draws above the screen fade so lines
 * stay readable during `B.fadeOut`, and below the custom cursor (`CUSTOM_CURSOR_DEPTH`).
 */
export const SPEAKING_TEXT_OVERLAY_DEPTH = 460_000;
