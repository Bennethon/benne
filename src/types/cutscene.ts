/**
 * Per-cutscene options for **`B.cutscene(fn, options)`** and the hooks the engine wraps in a
 * cutscene automatically (**`whenEnterRoom`**, **`whenEnterRoomAfterFade`**, **`whenEnterAnyRoom`**,
 * **`whenEnterAnyRoomAfterFade`**, **`whenChoice`**).
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
