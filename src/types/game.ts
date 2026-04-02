export interface RoomManifestEntry {
  id: string;
  definition: string;
}

export interface RoomsManifestData {
  startRoomId: string;
  rooms: RoomManifestEntry[];
}

/** Loaded from `src/game/game-config.json` (authoritative game bootstrap settings). */
export interface GameSettingsResolution {
  width: number;
  height: number;
}

export interface GameSettingsAudio {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  dialogueVolume: number;
}

/**
 * Central game configuration (not Phaser’s `GameConfig`).
 * Add optional fields here as the engine grows (language, shaders, accessibility, etc.).
 */
export interface GameSettings {
  resolution: GameSettingsResolution;
  /** Folder name under `src/game/characters/` for the default player character. */
  startingPlayerCharacter: string;
  /**
   * Which room id to load first. When set, overrides `startRoomId` in `rooms.manifest.json`.
   * Omit to use the manifest value.
   */
  startingRoomId?: string;
  audio: GameSettingsAudio;
}
