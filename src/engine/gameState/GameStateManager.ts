import * as Phaser from 'phaser';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import type {
  BenneGameStateFlagValue,
  GameStateActiveInventoryItemChangedPayload,
  GameStateActiveVerbChangedPayload,
  GameStateFlagChangedPayload,
  GameStateInventoryChangedPayload,
  GameStateReplacedPayload,
  GameStateRoomContextChangedPayload,
  GameStateVariableChangedPayload,
  SerializableBenneGameState,
} from '../../types/gameState.js';

/** In-memory state always has normalized room context (unlike optional fields on snapshot JSON). */
type PersistedGameStateSlice = SerializableBenneGameState & {
  currentRoom: string;
  lastRoom: string | null;
};
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
  GAME_STATE_FLAG_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
  GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
} from '../../types/gameState.js';
import { mergePreserveAudioVolumeVariables } from '../sound/audioGameState.js';
import { runSnapshotFlushHooks } from './snapshotFlushHooks.js';

export type GameStateInitialSlice = Partial<
  Pick<SerializableBenneGameState, 'flags' | 'variables' | 'inventory' | 'currentRoom' | 'lastRoom'>
>;

/** Accepts v1 map, legacy string[], or empty. */
export function normalizeSerializedInventory(raw: unknown): Record<string, number> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k.length === 0) {
        continue;
      }
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) {
        continue;
      }
      const q = Math.floor(n);
      if (q > 0) {
        out[k] = q;
      }
    }
    return out;
  }
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const id of raw) {
      if (typeof id === 'string' && id.length > 0) {
        out[id] = (out[id] ?? 0) + 1;
      }
    }
    return out;
  }
  return {};
}

function cloneInventory(inv: Record<string, number>): Record<string, number> {
  return { ...inv };
}

function normalizeActiveInventoryItemId(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
  return null;
}

function cloneSnapshot(state: PersistedGameStateSlice): SerializableBenneGameState {
  return {
    version: 1,
    flags: { ...state.flags },
    variables: { ...state.variables },
    inventory: cloneInventory(state.inventory),
    currentRoom: state.currentRoom,
    lastRoom: state.lastRoom,
  };
}

function normalizeCurrentRoomFromSnapshot(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

function normalizeLastRoomFromSnapshot(raw: unknown): string | null {
  if (raw === null) {
    return null;
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return null;
}

function formatVerbState(verbId: string | null): string {
  return verbId == null || verbId.length === 0 ? 'none' : `"${verbId}"`;
}

function formatActiveInventoryItemState(itemId: string | null): string {
  if (itemId == null || itemId.length === 0) {
    return 'none';
  }
  const def = getInventoryDefinition(itemId);
  const name = def?.name?.trim();
  return name ? `"${itemId}" (${name})` : `"${itemId}"`;
}

function localStorageKey(slot: number): string {
  return `benne-save-${slot}`;
}

/**
 * Cross-room persistent state (flags, variables, inventory). Emits on the bus passed at construct time.
 */
export class GameStateManager {
  private readonly events: Phaser.Events.EventEmitter;
  private state: PersistedGameStateSlice;
  /**
   * Runtime-only "active verb" state. Not part of the snapshot — resets on `applySnapshot`
   * (so loading a save returns the player to the default pointer profile, not mid-verb).
   */
  private activeVerbId: string | null = null;
  /**
   * Runtime "active inventory item" for use-on-target flows. Included in save snapshots (see {@link getSnapshot}).
   */
  private activeInventoryItemId: string | null = null;

  constructor(events: Phaser.Events.EventEmitter, initial?: GameStateInitialSlice) {
    this.events = events;
    this.state = {
      version: 1,
      flags: initial?.flags != null ? { ...initial.flags } : {},
      variables: initial?.variables != null ? { ...initial.variables } : {},
      inventory: normalizeSerializedInventory(initial?.inventory),
      currentRoom: initial?.currentRoom != null ? String(initial.currentRoom) : '',
      lastRoom: initial?.lastRoom === undefined ? null : normalizeLastRoomFromSnapshot(initial.lastRoom),
    };
  }

  getSnapshot(): SerializableBenneGameState {
    runSnapshotFlushHooks();
    return {
      ...cloneSnapshot(this.state),
      activeInventoryItemId: this.activeInventoryItemId,
    };
  }

  /**
   * Replaces in-memory state. Emits only {@link GAME_STATE_REPLACED_EVENT}.
   */
  applySnapshot(snapshot: SerializableBenneGameState): void {
    if (snapshot.version !== 1) {
      console.error(`[Benne] GameStateManager.applySnapshot: unsupported version ${snapshot.version}`);
      return;
    }
    const previousCurrentRoom = this.state.currentRoom;
    const previousLastRoom = this.state.lastRoom;
    const mergedVariables = mergePreserveAudioVolumeVariables(
      { ...snapshot.variables },
      this.state.variables,
    );
    this.state = {
      version: 1,
      flags: { ...snapshot.flags },
      variables: mergedVariables,
      inventory: normalizeSerializedInventory(snapshot.inventory),
      currentRoom: normalizeCurrentRoomFromSnapshot(snapshot.currentRoom),
      lastRoom: normalizeLastRoomFromSnapshot(snapshot.lastRoom),
    };
    const nextCurrent = this.state.currentRoom;
    const nextLast = this.state.lastRoom;
    if (previousCurrentRoom !== nextCurrent || previousLastRoom !== nextLast) {
      const roomPayload: GameStateRoomContextChangedPayload = {
        currentRoom: nextCurrent,
        lastRoom: nextLast,
        previousCurrentRoom,
        previousLastRoom,
      };
      this.events.emit(GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT, roomPayload);
    }
    if (this.activeVerbId !== null) {
      const previousValue = this.activeVerbId;
      this.activeVerbId = null;
      const activePayload: GameStateActiveVerbChangedPayload = { previousValue, value: null };
      this.events.emit(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, activePayload);
      console.log(
        `[Benne] Active verb became inactive (applying game state snapshot / load). Was: ${formatVerbState(previousValue)}.`,
      );
    }
    const nextActiveInventoryItemId = normalizeActiveInventoryItemId(snapshot.activeInventoryItemId);
    if (this.activeInventoryItemId !== nextActiveInventoryItemId) {
      const previousItemId = this.activeInventoryItemId;
      this.activeInventoryItemId = nextActiveInventoryItemId;
      const activeItemPayload: GameStateActiveInventoryItemChangedPayload = {
        itemId: nextActiveInventoryItemId,
      };
      this.events.emit(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, activeItemPayload);
      if (nextActiveInventoryItemId == null) {
        console.log(
          `[Benne] Active inventory item became inactive (snapshot). Was: ${formatActiveInventoryItemState(previousItemId)}.`,
        );
      } else if (previousItemId == null) {
        console.log(
          `[Benne] Active inventory item became active (snapshot): ${formatActiveInventoryItemState(nextActiveInventoryItemId)}.`,
        );
      } else {
        console.log(
          `[Benne] Active inventory item changed (snapshot): ${formatActiveInventoryItemState(previousItemId)} → ${formatActiveInventoryItemState(nextActiveInventoryItemId)}.`,
        );
      }
    }
    const payload: GameStateReplacedPayload = { snapshot: this.getSnapshot() };
    this.events.emit(GAME_STATE_REPLACED_EVENT, payload);
  }

  exportSnapshotJson(): string {
    return JSON.stringify(this.getSnapshot());
  }

  importSnapshotJson(json: string): void {
    try {
      const parsed = JSON.parse(json) as SerializableBenneGameState & {
        inventory?: unknown;
        activeInventoryItemId?: unknown;
      };
      if (parsed && typeof parsed === 'object') {
        parsed.inventory = normalizeSerializedInventory(parsed.inventory);
      }
      this.applySnapshot(parsed as SerializableBenneGameState);
    } catch (err) {
      console.error('[Benne] GameStateManager.importSnapshotJson failed:', err);
    }
  }

  setFlag(key: string, value: BenneGameStateFlagValue): void {
    const previousValue = this.state.flags[key];
    this.state.flags[key] = value;
    const payload: GameStateFlagChangedPayload = { key, previousValue, value };
    this.events.emit(GAME_STATE_FLAG_CHANGED_EVENT, payload);
  }

  getFlag(key: string): BenneGameStateFlagValue | undefined {
    return this.state.flags[key];
  }

  hasFlag(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.state.flags, key);
  }

  clearFlag(key: string): void {
    if (!this.hasFlag(key)) {
      return;
    }
    const previousValue = this.state.flags[key];
    delete this.state.flags[key];
    const payload: GameStateFlagChangedPayload = { key, previousValue, value: undefined };
    this.events.emit(GAME_STATE_FLAG_CHANGED_EVENT, payload);
  }

  setVariable(key: string, value: unknown): void {
    const previousValue = this.state.variables[key];
    this.state.variables[key] = value;
    const payload: GameStateVariableChangedPayload = { key, previousValue, value };
    this.events.emit(GAME_STATE_VARIABLE_CHANGED_EVENT, payload);
  }

  getVariable(key: string): unknown {
    return this.state.variables[key];
  }

  hasVariable(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.state.variables, key);
  }

  clearVariable(key: string): void {
    if (!this.hasVariable(key)) {
      return;
    }
    const previousValue = this.state.variables[key];
    delete this.state.variables[key];
    const payload: GameStateVariableChangedPayload = { key, previousValue, value: undefined };
    this.events.emit(GAME_STATE_VARIABLE_CHANGED_EVENT, payload);
  }

  getCurrentRoom(): string {
    return this.state.currentRoom;
  }

  getLastRoom(): string | null {
    return this.state.lastRoom;
  }

  setCurrentRoom(roomId: string): void {
    const next = String(roomId);
    if (this.state.currentRoom === next) {
      return;
    }
    const previousCurrentRoom = this.state.currentRoom;
    const previousLastRoom = this.state.lastRoom;
    this.state.currentRoom = next;
    const roomPayload: GameStateRoomContextChangedPayload = {
      currentRoom: this.state.currentRoom,
      lastRoom: this.state.lastRoom,
      previousCurrentRoom,
      previousLastRoom,
    };
    this.events.emit(GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT, roomPayload);
  }

  setLastRoom(roomId: string | null): void {
    const next = roomId != null && roomId.length > 0 ? String(roomId) : null;
    if (this.state.lastRoom === next) {
      return;
    }
    const previousCurrentRoom = this.state.currentRoom;
    const previousLastRoom = this.state.lastRoom;
    this.state.lastRoom = next;
    const roomPayload: GameStateRoomContextChangedPayload = {
      currentRoom: this.state.currentRoom,
      lastRoom: this.state.lastRoom,
      previousCurrentRoom,
      previousLastRoom,
    };
    this.events.emit(GAME_STATE_ROOM_CONTEXT_CHANGED_EVENT, roomPayload);
  }

  private emitInventory(reason: 'add' | 'remove' | 'clear', itemId?: string): void {
    const payload: GameStateInventoryChangedPayload = {
      reason,
      itemId,
      inventory: cloneInventory(this.state.inventory),
    };
    this.events.emit(GAME_STATE_INVENTORY_CHANGED_EVENT, payload);
  }

  /**
   * Adds inventory entries. Non-stackable definitions cap at quantity 1. Unknown ids default to non-stackable.
   */
  addInventory(itemId: string, quantity = 1): boolean {
    if (itemId.length === 0) {
      return false;
    }
    const q = Math.max(1, Math.floor(quantity));
    const def = getInventoryDefinition(itemId);
    const stackable = def?.stackable ?? false;
    const current = this.state.inventory[itemId] ?? 0;

    if (!stackable) {
      if (current >= 1) {
        return false;
      }
      this.state.inventory[itemId] = 1;
      this.emitInventory('add', itemId);
      return true;
    }

    this.state.inventory[itemId] = current + q;
    this.emitInventory('add', itemId);
    return true;
  }

  hasInInventory(itemId: string): boolean {
    return (this.state.inventory[itemId] ?? 0) > 0;
  }

  quantityOf(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  /**
   * Removes quantity (default 1). Non-stackable inventory entries are fully removed when present.
   */
  removeFromInventory(itemId: string, quantity = 1): boolean {
    if (itemId.length === 0) {
      return false;
    }
    const current = this.state.inventory[itemId] ?? 0;
    if (current <= 0) {
      return false;
    }
    const def = getInventoryDefinition(itemId);
    const stackable = def?.stackable ?? false;
    if (!stackable) {
      delete this.state.inventory[itemId];
      this.emitInventory('remove', itemId);
      this.disarmUseOnTargetIfActiveInventoryItemNoLongerHeld(itemId);
      return true;
    }
    const q = Math.max(1, Math.floor(quantity));
    const next = current - q;
    if (next <= 0) {
      delete this.state.inventory[itemId];
    } else {
      this.state.inventory[itemId] = next;
    }
    this.emitInventory('remove', itemId);
    this.disarmUseOnTargetIfActiveInventoryItemNoLongerHeld(itemId);
    return true;
  }

  /**
   * Script / engine inventory removal: if the player had this item armed for use-on-target and
   * it is no longer carried, clear active verb + active inventory regardless of
   * `dropWhenInventoryUsed` (that flag only affects post–use-on-target click policy).
   */
  private disarmUseOnTargetIfActiveInventoryItemNoLongerHeld(removedItemId: string): void {
    if (this.activeInventoryItemId !== removedItemId) {
      return;
    }
    if (this.hasInInventory(removedItemId)) {
      return;
    }
    this.clearActiveVerb();
    this.clearActiveInventoryItem();
  }

  clearInventory(): void {
    if (Object.keys(this.state.inventory).length === 0) {
      return;
    }
    this.state.inventory = {};
    this.emitInventory('clear');
  }

  /**
   * Returns inventory entries in **insertion order** (the order in which ids were first
   * added to state). `game-config.json`'s `initialGameState.inventory` array seeds the map
   * in that order, and subsequent `addInventory` calls append new ids to the end, so the
   * `inventoryPanel` GUI control renders items in the order the game author specified.
   */
  getInventoryItems(): ReadonlyArray<{ id: string; quantity: number }> {
    return Object.entries(this.state.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }

  saveToLocalStorage(slot = 0): void {
    try {
      localStorage.setItem(localStorageKey(slot), this.exportSnapshotJson());
    } catch (err) {
      console.error('[Benne] GameStateManager.saveToLocalStorage failed:', err);
    }
  }

  loadFromLocalStorage(slot = 0): boolean {
    try {
      const raw = localStorage.getItem(localStorageKey(slot));
      if (raw == null || raw.length === 0) {
        return false;
      }
      this.importSnapshotJson(raw);
      return true;
    } catch (err) {
      console.error('[Benne] GameStateManager.loadFromLocalStorage failed:', err);
      return false;
    }
  }

  clearLocalStorageSave(slot = 0): void {
    try {
      localStorage.removeItem(localStorageKey(slot));
    } catch (err) {
      console.error('[Benne] GameStateManager.clearLocalStorageSave failed:', err);
    }
  }

  /**
   * Runtime-only "active verb" (e.g. set from a verb-button click). When non-null, the pointer
   * resolver uses it on left-click against a clickable (and clears it once consumed) and clears
   * it on right-click. See {@link resolvePointerVerb} and the verb system section of the docs.
   */
  getActiveVerb(): string | null {
    return this.activeVerbId;
  }

  setActiveVerb(verbId: string | null): void {
    const next = verbId != null && verbId.length > 0 ? verbId : null;
    if (this.activeVerbId === next) {
      return;
    }
    const previousValue = this.activeVerbId;

    if (next != null && this.activeInventoryItemId != null) {
      this.clearActiveInventoryItem();
    }

    this.activeVerbId = next;
    const payload: GameStateActiveVerbChangedPayload = { previousValue, value: next };
    this.events.emit(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, payload);
    if (next == null) {
      console.log(
        `[Benne] Active verb became inactive. Was: ${formatVerbState(previousValue)}. (Cleared by script, UI, or input.)`,
      );
    } else if (previousValue == null) {
      console.log(`[Benne] Active verb became active: ${formatVerbState(next)}.`);
    } else {
      console.log(
        `[Benne] Active verb changed: ${formatVerbState(previousValue)} → ${formatVerbState(next)}.`,
      );
    }
  }

  clearActiveVerb(): void {
    this.setActiveVerb(null);
  }

  getActiveInventoryItemId(): string | null {
    return this.activeInventoryItemId;
  }

  setActiveInventoryItem(id: string | null): void {
    const next = id != null && id.length > 0 ? id : null;
    if (this.activeInventoryItemId === next) {
      return;
    }
    const previousItemId = this.activeInventoryItemId;
    this.activeInventoryItemId = next;
    const payload: GameStateActiveInventoryItemChangedPayload = { itemId: next };
    this.events.emit(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, payload);
    if (next == null) {
      console.log(
        `[Benne] Active inventory item became inactive (use-on-target selection cleared). Was: ${formatActiveInventoryItemState(previousItemId)}.`,
      );
    } else if (previousItemId == null) {
      console.log(
        `[Benne] Active inventory item became active (use-on-target): ${formatActiveInventoryItemState(next)}.`,
      );
    } else {
      console.log(
        `[Benne] Active inventory item changed (use-on-target): ${formatActiveInventoryItemState(previousItemId)} → ${formatActiveInventoryItemState(next)}.`,
      );
    }
  }

  clearActiveInventoryItem(): void {
    this.setActiveInventoryItem(null);
  }
}
