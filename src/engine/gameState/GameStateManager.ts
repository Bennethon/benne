import * as Phaser from 'phaser';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import type {
  BenneGameStateFlagValue,
  GameStateFlagChangedPayload,
  GameStateInventoryChangedPayload,
  GameStateReplacedPayload,
  GameStateVariableChangedPayload,
  SerializableBenneGameState,
} from '../../types/gameState.js';
import {
  GAME_STATE_FLAG_CHANGED_EVENT,
  GAME_STATE_INVENTORY_CHANGED_EVENT,
  GAME_STATE_REPLACED_EVENT,
  GAME_STATE_VARIABLE_CHANGED_EVENT,
} from '../../types/gameState.js';

export type GameStateInitialSlice = Partial<
  Pick<SerializableBenneGameState, 'flags' | 'variables' | 'inventory'>
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

function cloneSnapshot(state: SerializableBenneGameState): SerializableBenneGameState {
  return {
    version: 1,
    flags: { ...state.flags },
    variables: { ...state.variables },
    inventory: cloneInventory(state.inventory),
  };
}

function localStorageKey(slot: number): string {
  return `benne-save-${slot}`;
}

/**
 * Cross-room persistent state (flags, variables, inventory). Emits on the bus passed at construct time.
 */
export class GameStateManager {
  private readonly events: Phaser.Events.EventEmitter;
  private state: SerializableBenneGameState;

  constructor(events: Phaser.Events.EventEmitter, initial?: GameStateInitialSlice) {
    this.events = events;
    this.state = {
      version: 1,
      flags: initial?.flags != null ? { ...initial.flags } : {},
      variables: initial?.variables != null ? { ...initial.variables } : {},
      inventory: normalizeSerializedInventory(initial?.inventory),
    };
  }

  getSnapshot(): SerializableBenneGameState {
    return cloneSnapshot(this.state);
  }

  /**
   * Replaces in-memory state. Emits only {@link GAME_STATE_REPLACED_EVENT}.
   */
  applySnapshot(snapshot: SerializableBenneGameState): void {
    if (snapshot.version !== 1) {
      console.error(`[Benne] GameStateManager.applySnapshot: unsupported version ${snapshot.version}`);
      return;
    }
    this.state = {
      version: 1,
      flags: { ...snapshot.flags },
      variables: { ...snapshot.variables },
      inventory: normalizeSerializedInventory(snapshot.inventory),
    };
    const payload: GameStateReplacedPayload = { snapshot: this.getSnapshot() };
    this.events.emit(GAME_STATE_REPLACED_EVENT, payload);
  }

  exportSnapshotJson(): string {
    return JSON.stringify(this.getSnapshot());
  }

  importSnapshotJson(json: string): void {
    try {
      const parsed = JSON.parse(json) as SerializableBenneGameState & { inventory?: unknown };
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
    return true;
  }

  clearInventory(): void {
    if (Object.keys(this.state.inventory).length === 0) {
      return;
    }
    this.state.inventory = {};
    this.emitInventory('clear');
  }

  getInventoryItems(): ReadonlyArray<{ id: string; quantity: number }> {
    return Object.entries(this.state.inventory)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ id, quantity }))
      .sort((a, b) => a.id.localeCompare(b.id));
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
}
