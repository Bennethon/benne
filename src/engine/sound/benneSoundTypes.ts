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
  /** When > 0, crossfade from the current music track over this many seconds (blocking `playMusic` waits for the full duration). */
  fadeSeconds?: number;
  /**
   * When true with a positive **`fadeSeconds`**, seeks the incoming track to match the outgoing
   * playback position when the runtime exposes it (Web Audio / HTML5). Falls back to an unsynced
   * crossfade when alignment is not possible.
   */
  sync?: boolean;
}
