import { getGameSettings } from '../ConfigManager';
import { gameEvents } from '../events/EventBus';
import {
  CHARACTER_SAY_REQUESTED_EVENT,
  FIRST_OCCURRENCE_CONSUMED_EVENT,
  FLAG_CHANGED_EVENT,
  GAME_FADE_IN_REQUESTED_EVENT,
  GAME_FADE_OUT_REQUESTED_EVENT,
  GAME_ROOM_CHANGE_REQUESTED_EVENT,
  INVENTORY_CHANGED_EVENT,
  type CharacterSayRequestedPayload,
  type FirstOccurrenceConsumedPayload,
  type FlagChangedPayload,
  type GameFadePayload,
  type GameRoomChangeRequestedPayload,
  type InventoryChangedPayload
} from './scriptingEvents';

const flags = new Map<string, unknown>();
const firstOccurrenceKeys = new Set<string>();
const inventoryItemIds = new Set<string>();
const visitedRoomIds = new Set<string>();

let currentRoomId = '';

const DEFAULT_FADE_MS = 500;

function emitFade(kind: 'in' | 'out', durationMs?: number): void {
  const payload: GameFadePayload =
    durationMs === undefined ? {} : { durationMs };
  gameEvents.emit(
    kind === 'out' ? GAME_FADE_OUT_REQUESTED_EVENT : GAME_FADE_IN_REQUESTED_EVENT,
    payload
  );
}

/**
 * Global engine helpers (PowerQuest-style `E`): room requests, flags, pacing, fade hooks.
 * Mutations emit on `gameEvents`; see `scriptingEvents.ts` for event ids.
 */
export const E = {
  /**
   * Request a room transition. Phase 1 only updates facade state and emits
   * `game:roomChangeRequested` — `RoomScene` does not switch yet until a listener implements it.
   *
   * @param roomId Target room id (matches `RoomData.id` / folder slug).
   * @param spawnPoint Optional spawn point id for the destination room (phase 2).
   */
  changeRoom(roomId: string, spawnPoint?: string): void {
    if (currentRoomId.length > 0) {
      visitedRoomIds.add(currentRoomId);
    }
    currentRoomId = roomId;
    gameEvents.emit(GAME_ROOM_CHANGE_REQUESTED_EVENT, {
      roomId,
      spawnPoint
    } satisfies GameRoomChangeRequestedPayload);
  },

  /**
   * Wait for a number of seconds (real time). Use inside `async` verb handlers.
   * Phase 2 may integrate with a pause-aware time service.
   */
  wait(seconds: number): Promise<void> {
    const ms = Math.max(0, seconds) * 1000;
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },

  /**
   * Returns `true` the first time this key is used, then `false` forever (classic adventure “first time only” gate).
   * Emits `firstOccurrence:consumed` when it returns `true`.
   */
  firstOccurrence(key: string): boolean {
    if (firstOccurrenceKeys.has(key)) {
      return false;
    }
    firstOccurrenceKeys.add(key);
    gameEvents.emit(FIRST_OCCURRENCE_CONSUMED_EVENT, { key } satisfies FirstOccurrenceConsumedPayload);
    return true;
  },

  /**
   * Store a script-visible flag. Emits `flag:changed`.
   *
   * @param value Stored as-is; compare with `E.hasFlag`.
   */
  setFlag(key: string, value: unknown): void {
    flags.set(key, value);
    gameEvents.emit(FLAG_CHANGED_EVENT, { key, value } satisfies FlagChangedPayload);
  },

  /**
   * Test whether a flag exists, or matches a specific value (strict `===`).
   * Read-only — does not emit.
   */
  hasFlag(key: string, value?: unknown): boolean {
    if (!flags.has(key)) {
      return false;
    }
    if (arguments.length < 2) {
      return true;
    }
    return flags.get(key) === value;
  },

  /**
   * Fade the screen to black (request). Phase 1: emits `game:fadeOutRequested` only.
   * @param duration Seconds; defaults to ~0.5s when omitted (see implementation).
   */
  fadeOut(duration?: number): Promise<void> {
    const durationMs =
      duration === undefined ? DEFAULT_FADE_MS : Math.max(0, duration) * 1000;
    emitFade('out', durationMs);
    // TODO: resolve when PostEffects / camera fade completes (phase 2).
    return Promise.resolve();
  },

  /**
   * Fade the screen in from black (request). Phase 1: emits `game:fadeInRequested` only.
   * @param duration Seconds; defaults to ~0.5s when omitted.
   */
  fadeIn(duration?: number): Promise<void> {
    const durationMs =
      duration === undefined ? DEFAULT_FADE_MS : Math.max(0, duration) * 1000;
    emitFade('in', durationMs);
    // TODO: resolve when fade completes (phase 2).
    return Promise.resolve();
  }
};

/**
 * Augment from **`src/game/scripting/known-characters.d.ts`** (maintained by the Create Character wizard).
 * Keys are **exact** `CharacterData.id` strings (`henry`, `shop-keeper` → use `C["shop-keeper"]`).
 */
export interface BenneKnownCharacters {}

/**
 * Script API for one character (player or NPC). Phase 1: stubs + shared inventory via `I`.
 */
export type CharacterScriptHandle = {
  /** Same string as `CharacterData.id` / `C` access key (e.g. `henry`, `clerk`, `shop-keeper`). */
  readonly characterId: string;

  /**
   * Walk toward a target (room point id, `{ x, y }`, etc. — phase 2).
   */
  walkTo(target: unknown): void;

  /** Overhead line + Talk animation; resolves when the line dismisses or a newer `say` replaces it. */
  say(text: string): Promise<void>;

  /** Play an animation clip by logical name (phase 2). */
  playAnimation(name: string): void;

  /**
   * Adds an item to the global inventory stub (`I`). Phase 2 may scope by character or emit
   * `inventory:changed` with actor metadata.
   */
  addToInventory(itemId: string): void;
};

/**
 * Typed root for {@link C}: `Player` (alias for default PC), optional ids from {@link BenneKnownCharacters},
 * and any string key for runtime-only ids.
 */
export type BenneCharacterRoot = {
  readonly Player: CharacterScriptHandle;
} & Readonly<BenneKnownCharacters> &
  Record<string, CharacterScriptHandle>;

/**
 * Inventory (`I`): phase 1 in-memory set + `inventory:changed` events. No UI or loader integration yet.
 * Declared before `C` so character handles can call `I.add`.
 */
export const I = {
  /** Add an item id if missing; emits `inventory:changed` with `action: 'add'` when newly added. */
  add(itemId: string): void {
    if (inventoryItemIds.has(itemId)) {
      return;
    }
    inventoryItemIds.add(itemId);
    gameEvents.emit(INVENTORY_CHANGED_EVENT, {
      itemId,
      action: 'add'
    } satisfies InventoryChangedPayload);
  },

  /** Remove an item id; emits `inventory:changed` with `action: 'remove'` when it existed. */
  remove(itemId: string): void {
    if (!inventoryItemIds.delete(itemId)) {
      return;
    }
    gameEvents.emit(INVENTORY_CHANGED_EVENT, {
      itemId,
      action: 'remove'
    } satisfies InventoryChangedPayload);
  },

  /** Whether the inventory contains this item id. Read-only — does not emit. */
  has(itemId: string): boolean {
    return inventoryItemIds.has(itemId);
  }
};

const characterHandles = new Map<string, CharacterScriptHandle>();

function createCharacterScriptHandle(characterId: string): CharacterScriptHandle {
  return {
    characterId,
    walkTo(_target: unknown): void {
      // TODO: phase 2 — emit walk / tween with `characterId`.
    },
    say(text: string): Promise<void> {
      return new Promise((resolve) => {
        gameEvents.emit(CHARACTER_SAY_REQUESTED_EVENT, {
          characterId,
          text,
          complete: resolve,
        } satisfies CharacterSayRequestedPayload);
      });
    },
    playAnimation(_name: string): void {
      // TODO: phase 2 — RoomScene animation with `characterId`.
    },
    addToInventory(itemId: string): void {
      I.add(itemId);
    }
  };
}

function getOrCreateCharacterHandle(characterId: string): CharacterScriptHandle {
  let handle = characterHandles.get(characterId);
  if (!handle) {
    handle = createCharacterScriptHandle(characterId);
    characterHandles.set(characterId, handle);
  }
  return handle;
}

/** `game-config.json` `startingPlayerCharacter` — same id as `C.clerk` when the PC is clerk, etc. */
function getDefaultPlayerCharacterId(): string {
  const id = getGameSettings().startingPlayerCharacter.trim();
  return id.length > 0 ? id : 'player';
}

/**
 * BenneScript character namespace.
 *
 * Implemented with a **Proxy** on an empty target:
 * - **`C.Player`** → same handle as **`C[getDefaultPlayerCharacterId()]`** (from `startingPlayerCharacter` in `game-config.json`).
 * - Any other **string** key → handle for that exact character **`id`** (`C.henry`, `C["shop-keeper"]`). No renaming or casing rules.
 * - Unknown ids still return a stub handle at runtime (`Record<string, CharacterScriptHandle>`).
 *
 * Prefer listing ids in `src/game/scripting/known-characters.d.ts` for autocomplete.
 */
const cProxyTarget: Record<string, unknown> = Object.create(null);

export const C: BenneCharacterRoot = new Proxy(cProxyTarget, {
  get(_target, prop, _receiver) {
    if (typeof prop === 'symbol') {
      if (prop === Symbol.toStringTag) {
        return 'BenneCharacters';
      }
      return undefined;
    }
    if (prop === 'Player') {
      return getOrCreateCharacterHandle(getDefaultPlayerCharacterId());
    }
    // Avoid treating common object-property probes as character ids.
    if (prop === 'constructor' || prop === '__proto__') {
      return undefined;
    }
    return getOrCreateCharacterHandle(prop);
  }
}) as BenneCharacterRoot;

const roomCurrent = {
  /** Room id last set by `E.changeRoom`, or `''` until then (boot sync is phase 2). */
  get id(): string {
    return currentRoomId;
  },
  /**
   * `true` the first time you are “in” this room id after a transition, then `false` on later visits.
   * Derived from visit tracking when leaving a room via `E.changeRoom`.
   */
  get firstTimeVisited(): boolean {
    return !visitedRoomIds.has(currentRoomId);
  }
};

/** Room helpers (`R.Current`, future room-scoped APIs). */
export const R = {
  /** The room currently selected by the facade (see `E.changeRoom`). */
  Current: roomCurrent
};

/**
 * Future audio helpers (music, SFX, voice). Phase 1: placeholder for discoverability.
 *
 * @todo `playMusic(id: string): void` — loop/stream from manifest
 * @todo `stopMusic(): void`
 * @todo `playSfx(id: string): void`
 */
export const Audio: Record<string, never> = {};

/**
 * Future camera helpers (shake, pan, zoom). Phase 1: placeholder.
 *
 * @todo `panTo(x: number, y: number, duration?: number): Promise<void>`
 * @todo `shake(intensity?: number, duration?: number): void`
 */
export const Camera: Record<string, never> = {};
