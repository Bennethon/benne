/**
 * Per-cutscene options for **`cutscene(fn, options)`** and the room-transition hooks the engine
 * wraps in a cutscene automatically (**`room.onEnter`**, **`room.onEnterAfterFade`**,
 * **`game.onEnterAnyRoom`**, **`game.onEnterAnyRoomAfterFade`**).
 */
export interface CutsceneOptions {
  /**
   * When **`false`**, ESC cannot skip this cutscene even if `game-config.json`
   * **`cutscenesSkippable`** is true (same shape as per-line **`say('…', { clickToSkip: false })`**).
   * An unskippable cutscene also locks any cutscene nested around or inside it.
   *
   * Defaults to **`true`** (the global config flag then decides).
   */
  skippable?: boolean;
}
