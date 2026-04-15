import type { BenneGameStateFlagValue } from './gameState';

export interface RoomManifestEntry {
  id: string;
  definition: string;
}

export interface RoomsManifestData {
  startRoomId: string;
  rooms: RoomManifestEntry[];
}

/** Optional starting slice for {@link import('../engine/gameState/GameStateManager.js').GameStateManager}. */
export interface GameSettingsInitialGameState {
  flags?: Record<string, BenneGameStateFlagValue>;
  variables?: Record<string, unknown>;
  inventory?: string[];
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

export interface GameSettingsDebug {
  /** When true, stroke walkable polygons in the room scene (distinct color from prop colliders). */
  showWalkable?: boolean;
  /** When true, stroke prop `collider` polygons for props that define one. */
  showPropOutlines?: boolean;
}

/** Optional `game-config.json` `dialog` block; see {@link getDialogSettings} for merged defaults. */
export interface GameSettingsDialog {
  /**
   * Default for timed Bennescript `.say` / `.say.now` lines when the call omits **`clickToSkip`** in the options object.
   * When true, a **left**-click ends the line early (same cleanup as the timer). Per-line overrides:
   * `say('…', { clickToSkip: false })` always disables skip; `say('…', { clickToSkip: true })` always enables skip even
   * when this global flag is false.
   */
  clickToSkip: boolean;
  /** When false, `.say()` timing still runs but no dialog-text GUI (reserved for future spoken-only lines). */
  showText: boolean;
  /** Extra offset in **game canvas pixels** (same space as GUI `controls[].x` / `y`) applied after projecting the character `talkPoint`. */
  defaultTalkOffset: { x: number; y: number };
  minDurationMs: number;
  msPerCharacter: number;
  maxDurationMs: number;
  durationMultiplier: number;
}

/** One verb the game exposes (ids power `onVerb`, `inputProfile`, and global handler events). */
export interface GameVerbDefinition {
  /** Stable id used in room JSON (`onVerb`), `inputProfile`, and scripts. */
  id: string;
  /** Optional label for future in-game verb UIs. */
  label?: string;
}

/**
 * Map primary / secondary mouse buttons to verb ids (classic “2 verb” adventures).
 * Primary is usually the left button, secondary the right (see `RoomScene` + Phaser pointer).
 */
export interface VerbInputProfileTwoVerb {
  kind: 'twoVerb';
  /** Verb for the primary (typically left) mouse button. */
  primaryButtonVerb: string;
  /** Verb for the secondary (typically right) mouse button. */
  secondaryButtonVerb: string;
}

/** How input selects the verb before an interaction is resolved (extensible for 9-verb UI later). */
export type VerbInputProfile = VerbInputProfileTwoVerb;

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
   * When omitted, the manifest value is used.
   */
  startingRoomId?: string;
  audio: GameSettingsAudio;
  /** Editor / QA toggles (polygon overlays, etc.). */
  debug?: GameSettingsDebug;
  /**
   * Declared verbs for this game. When omitted, the engine assumes `look` and `use` (see architecture).
   */
  verbs?: GameVerbDefinition[];
  /**
   * How pointer input maps to a verb before dispatch. When omitted, defaults to left → `look`, right → `use`
   * (unless `verbs` overrides ids and you must set an explicit `inputProfile`).
   */
  inputProfile?: VerbInputProfile;
  /**
   * Suggested line when no handler handles the verb; emitted on the `verb:unhandled` bus event.
   */
  defaultFallbackLine?: string;
  /** In-game dialog line timing and `dialog-text` GUI placement (see `getDialogSettings()`). */
  dialog?: Partial<GameSettingsDialog>;
  /** Starting flags, variables, and inventory merged at game creation (see `GameStateManager`). */
  initialGameState?: GameSettingsInitialGameState;
}
