import type { CharacterAnimationsConfig } from './character';
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
  /**
   * Starting inventory: either unique id list (legacy; each becomes quantity 1) or id → quantity map.
   */
  inventory?: string[] | Record<string, number>;
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
  /** When true, stroke each slot rectangle in GUI `inventoryPanel` controls (no default slot fills). */
  showGuiOutlines?: boolean;
  /** When true, stroke each room `regions[]` polygon (distinct color from walkable / prop debug strokes). */
  showRegionOutlines?: boolean;
}

/**
 * Room region **scale walk speed** tuning (`game-config.json` `perspective`).
 * See {@link computeRoomRegionPerspective} in `src/engine/room/regionCharacterScale.ts`.
 */
export interface GameSettingsPerspective {
  /** Floor for `Math.pow(linearSpriteScale, walkScalePower)` when `RoomRegionData.scaleWalkSpeed` is true. */
  minWalkScale: number;
  /** Exponent applied to the linear region scale when deriving the walk-speed multiplier. */
  walkScalePower: number;
}

/**
 * Optional `game-config.json` `speech` block; see {@link getSpeechSettings} for merged defaults.
 * At runtime, `B.speechSettings` / `speech:*` game-state variables override these fields (see architecture.md).
 */
export interface GameSettingsSpeech {
  /**
   * Default for timed Bennescript `.say` / `.say.now` lines when the call omits **`clickToSkip`** in the options object.
   * When true, a **left**-click ends the line early (same cleanup as the timer). Per-line overrides:
   * `say('…', { clickToSkip: false })` always disables skip; `say('…', { clickToSkip: true })` always enables skip even
   * when this global flag is false. Overridable at runtime via **`B.speechSettings.clickToSkip`**.
   */
  clickToSkip: boolean;
  /** When false, `.say()` timing still runs but no Speaking Text (`speaking-text`) GUI. Overridable via **`B.speechSettings.showText`**. */
  showText: boolean;
  /** Extra offset in **game canvas pixels** applied after projecting the character `talkPoint`. Overridable via **`B.speechSettings.defaultTalkOffset`**. */
  defaultTalkOffset: { x: number; y: number };
  minDurationMs: number;
  msPerCharacter: number;
  maxDurationMs: number;
  durationMultiplier: number;
}

/**
 * Optional `game-config.json` `dialog` block; see {@link getDialogSettings} for merged defaults.
 * At runtime, `B.dialogSettings` / `dialog:*` game-state variables override these fields (see architecture.md).
 */
export interface GameSettingsDialog {
  /**
   * When set, caps how many pixels of choice option rows may stack below **`Option-Grid`** (see
   * {@link getDialogChoiceAvailableHeightPx}). Omitted = extend to the bottom of the internal canvas.
   * Overridable via **`B.dialogSettings.choiceOptionsViewportHeightPx`** (set **`undefined`** to clear override).
   */
  choiceOptionsViewportHeightPx?: number;
}

/** One verb the game exposes (ids power inventory `onVerb`, `inputProfile`, and global handler events). */
export interface GameVerbDefinition {
  /** Stable id used in room JSON (props/hotspots), inventory JSON, `inputProfile`, and scripts. */
  id: string;
  /** Optional label for future in-game verb UIs. */
  label?: string;
  /**
   * Optional short word between verb and object in composed UI copy (e.g. `"at"` → “Look at …”, `"to"` → “Give to …”).
   */
  preposition?: string;
}

/**
 * Map primary / secondary mouse buttons to verb ids.
 * Primary is usually the left button, secondary the right (see `RoomScene` + Phaser pointer).
 *
 * Each slot accepts **any defined verb id** from {@link GameSettings.verbs}, or one of two reserved
 * literal tokens:
 *
 * - **`"walkTo"`** — built-in universal walk verb. When a pointer click over a clickable resolves to
 *   this slot, the engine walks the player to the target's stand point instead of dispatching a verb.
 *   (Empty-space clicks always walk regardless of slot configuration.)
 * - **`"defaultVerb"`** — substitute with the clicked target's authored `defaultVerb` field
 *   (per-prop / hotspot / character / inventory item). When the target omits `defaultVerb`, the
 *   engine falls back to `"look"`.
 */
export interface VerbInputProfile {
  /** Verb id / `"walkTo"` / `"defaultVerb"` for the primary (typically left) mouse button. */
  primaryButtonVerb: string;
  /** Verb id / `"walkTo"` / `"defaultVerb"` for the secondary (typically right) mouse button. */
  secondaryButtonVerb: string;
}

/**
 * Central game configuration (not Phaser’s `GameConfig`).
 * Add optional fields here as the engine grows (language, shaders, accessibility, etc.).
 */
export interface GameSettings {
  /**
   * Template id used by `scripts/switch-game-template.mjs` to decide where `sync-template-down`
   * writes. Matches the `game-templates/<name>/` folder (e.g. `"2-click"`, `"9-verb"`).
   * Not consumed by the engine; purely authoring/tooling metadata.
   */
  name?: string;
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
   * (unless `verbs` overrides ids and you must set an explicit `inputProfile`). Slots accept any
   * defined verb id plus the reserved literals `"walkTo"` and `"defaultVerb"` — see
   * {@link VerbInputProfile}.
   */
  inputProfile?: VerbInputProfile;
  /**
   * Suggested line when no handler handles the verb; emitted on the `verb:unhandled` bus event.
   */
  defaultFallbackLine?: string;
  /**
   * Global default policy for whether the **active inventory item** is "dropped" (active inventory +
   * active verb both cleared) after it is used on a clickable target (prop / hotspot / character).
   *
   * When **`false`** (default), the active inventory selection stays armed after each use, so the
   * player can use the same item on several targets in a row. When **`true`**, the active inventory
   * is cleared after use (classic point-and-click behavior).
   *
   * Individual items can override this per-item via **`InventoryItemData.dropWhenUsed`**.
   */
  dropWhenInventoryUsed?: boolean;
  /** Speech line timing, click-to-skip, and Speaking Text overlay placement (see `getSpeechSettings()`). */
  speech?: Partial<GameSettingsSpeech>;
  /** Dialog choice UI settings (viewport height cap, etc.). See `getDialogSettings()`. */
  dialog?: Partial<GameSettingsDialog>;
  /**
   * Perspective / walk-speed tuning for optional **`scaleWalkSpeed`** on room regions (`RoomRegionData`).
   * See **`getPerspectiveSettings()`** in **`ConfigManager.ts`**.
   */
  perspective?: Partial<GameSettingsPerspective>;
  /** Starting flags, variables, and inventory merged at game creation (see `GameStateManager`). */
  initialGameState?: GameSettingsInitialGameState;
  /**
   * Optional custom pointer art from `src/game/assets/images/cursor/cursor.png` + `cursor.json`
   * (Aseprite export). Uses the same `animations` / clip keys pattern as `*.character.json`.
   */
  cursor?: GameSettingsCursor;
}

/** `game-config.json` `cursor.display` block (Aseprite sheet only for now). */
export interface GameSettingsCursorDisplay {
  /** When true, load the bundled `images/cursor/cursor` Aseprite sheet. */
  aseprite?: boolean;
}

/**
 * Where the logical pointer tip sits on the cursor art (Phaser `setOrigin` fractions, except
 * **`custom`**, which uses {@link GameSettingsCursor.hotspotPixel} from the sprite top-left).
 */
export type GameSettingsCursorHotspot =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

/**
 * `game-config.json` `cursor` block — same shape as `*.character.json` clip tuning: keys in
 * {@link GameSettingsCursor.animations} are Aseprite frame tag names; {@link GameSettingsCursor.idleAnimation} /
 * {@link GameSettingsCursor.activeAnimation} pick which tags drive the two pointer states.
 */
export interface GameSettingsCursor {
  /** Aseprite tag (Phaser animation key) when the pointer is not over a clickable target. */
  idleAnimation: string;
  /** Aseprite tag when the pointer is over a prop, hotspot, clickable character, or GUI button (unless a per-target `activeCursorOverride` applies). */
  activeAnimation: string;
  /**
   * Optional Aseprite tag to play on the cursor sprite while a cutscene is active.
   * When non-empty and the animation key exists, the cursor plays this tag during cutscene mode
   * (PowerQuest-style "busy" pointer). When blank, missing, or the clip does not exist, the cursor
   * sprite is hidden entirely during cutscene (classic PowerQuest style — no pointer visible).
   */
  busyAnimation?: string;
  /** Optional per-tag `loop` / `frameDuration` / `events` (same as character `animations`). */
  animations?: CharacterAnimationsConfig;
  /**
   * Which point on the cursor sprite tracks the hardware pointer. Defaults to **`top-left`**
   * (Phaser origin `0,0`). Use **`custom`** with {@link GameSettingsCursor.hotspotPixel}.
   */
  hotspot?: GameSettingsCursorHotspot;
  /**
   * Pixel offset from the sprite’s **top-left** to the pointer hotspot (logical click position).
   * Required when {@link GameSettingsCursor.hotspot} is **`custom`** (ignored for named presets).
   */
  hotspotPixel?: { x: number; y: number };
  display?: GameSettingsCursorDisplay;
}
