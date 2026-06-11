/**
 * Depth for the room cinematic video layer (`B.video`). Sits **above** the room stack
 * (`ROOM_STACK_DEPTH_BASE = 100`, plus the dev debug overlays at `20_000`) and **below** the GUI
 * overlay band floor (`GUI_TEXT_OVERLAY_DEPTH = 25_000`), so every GUI — including the reserved
 * Speaking Text (`speaking-text`) and Display Text (`display-text`) overlays — renders on top of a
 * playing video. The optional black letterbox backdrop sits one depth below the video itself.
 */
export const ROOM_VIDEO_LAYER_DEPTH = 24_000;
