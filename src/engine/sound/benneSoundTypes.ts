/** Options for `B.sound.play` / `B.sound.playAndWait`. */
export interface SoundPlayOptions {
  /** Extra multiplier (0–1) on top of effective SFX volume. Default 1. */
  volume?: number;
  /** Default false for one-shot SFX. */
  loop?: boolean;
}

/** Options for `B.sound.playMusic`. */
export interface MusicPlayOptions {
  volume?: number;
  /** Default true for background music. */
  loop?: boolean;
}
