import * as Phaser from 'phaser';
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

function uniqueInventoryIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cloneSnapshot(state: SerializableBenneGameState): SerializableBenneGameState {
  return {
    version: 1,
    flags: { ...state.flags },
    variables: { ...state.variables },
    inventory: [...state.inventory],
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
      inventory: uniqueInventoryIds(initial?.inventory ?? []),
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
      inventory: uniqueInventoryIds(snapshot.inventory),
    };
    const payload: GameStateReplacedPayload = { snapshot: this.getSnapshot() };
    this.events.emit(GAME_STATE_REPLACED_EVENT, payload);
  }

  exportSnapshotJson(): string {
    return JSON.stringify(this.getSnapshot());
  }

  importSnapshotJson(json: string): void {
    try {
      const parsed = JSON.parse(json) as SerializableBenneGameState;
      this.applySnapshot(parsed);
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

  addToInventory(itemId: string): boolean {
    if (itemId.length === 0 || this.state.inventory.includes(itemId)) {
      return false;
    }
    this.state.inventory.push(itemId);
    const payload: GameStateInventoryChangedPayload = {
      reason: 'add',
      itemId,
      inventory: [...this.state.inventory],
    };
    this.events.emit(GAME_STATE_INVENTORY_CHANGED_EVENT, payload);
    return true;
  }

  hasInInventory(itemId: string): boolean {
    return this.state.inventory.includes(itemId);
  }

  removeFromInventory(itemId: string): boolean {
    const i = this.state.inventory.indexOf(itemId);
    if (i < 0) {
      return false;
    }
    this.state.inventory.splice(i, 1);
    const payload: GameStateInventoryChangedPayload = {
      reason: 'remove',
      itemId,
      inventory: [...this.state.inventory],
    };
    this.events.emit(GAME_STATE_INVENTORY_CHANGED_EVENT, payload);
    return true;
  }

  clearInventory(): void {
    if (this.state.inventory.length === 0) {
      return;
    }
    this.state.inventory = [];
    const payload: GameStateInventoryChangedPayload = {
      reason: 'clear',
      inventory: [],
    };
    this.events.emit(GAME_STATE_INVENTORY_CHANGED_EVENT, payload);
  }

  getInventorySnapshot(): string[] {
    return [...this.state.inventory];
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
