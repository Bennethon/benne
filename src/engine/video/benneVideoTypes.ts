/** Options for `video.x.play()` / `video.x.playAndWait()`. */
export interface VideoPlayOptions {
  /** Loop the video until explicitly stopped (default `false`). Looping videos never fire `onComplete`. */
  loop?: boolean;
  /** Per-playback volume multiplier (0–1) on top of the game-config master volume (default `1`). */
  volume?: number;
  /** When true, a primary click/tap stops the active video. Defaults to `false`. */
  clickToSkip?: boolean;
  /** Invoked once when the video finishes or is stopped. */
  onComplete?: () => void;
}
