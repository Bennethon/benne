import type { BenneGameStateFlagValue } from '../../types/gameState.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';

/** `B.state` — flags, variables, and snapshot persistence (see `GameStateManager`). */
export interface BenneScriptGameStateNamespace {
  setFlag(id: string, value: BenneGameStateFlagValue): void;
  getFlag(id: string): BenneGameStateFlagValue | undefined;
  hasFlag(id: string): boolean;
  clearFlag(id: string): void;
  setVariable(id: string, value: unknown): void;
  getVariable(id: string): unknown;
  hasVariable(id: string): boolean;
  clearVariable(id: string): void;
  saveToBrowser(slot?: number): void;
  loadFromBrowser(slot?: number): boolean;
  clearBrowserSave(slot?: number): void;
  exportJson(): string;
  importJson(json: string): void;
  /**
   * Runtime-only "active verb" (see {@link GameStateManager.setActiveVerb}). When non-null, the
   * pointer resolver uses it for left-clicks on clickable targets (consuming it on dispatch) and
   * right-clicks clear it. Pass `null` to clear; empty strings are treated as `null`.
   */
  setActiveVerb(verbId: string | null): void;
  getActiveVerb(): string | null;
  clearActiveVerb(): void;
}

/** `B.inventory` — quantities per item id (see `GameStateManager`). */
export interface BenneScriptInventoryNamespace {
  add(id: string, quantity?: number): boolean;
  remove(id: string, quantity?: number): boolean;
  has(id: string): boolean;
  quantityOf(id: string): number;
  /** Legacy accessor for inventory entries; prefer `add`/`remove`/`has`/`quantityOf` for gameplay logic. */
  readonly items: ReadonlyArray<{ id: string; quantity: number }>;
  clearInventory(): void;
}

export function createBenneScriptGameStateNamespace(m: GameStateManager): BenneScriptGameStateNamespace {
  return {
    setFlag: (id, value) => m.setFlag(id, value),
    getFlag: (id) => m.getFlag(id),
    hasFlag: (id) => m.hasFlag(id),
    clearFlag: (id) => m.clearFlag(id),
    setVariable: (id, value) => m.setVariable(id, value),
    getVariable: (id) => m.getVariable(id),
    hasVariable: (id) => m.hasVariable(id),
    clearVariable: (id) => m.clearVariable(id),
    saveToBrowser: (slot) => m.saveToLocalStorage(slot),
    loadFromBrowser: (slot) => m.loadFromLocalStorage(slot),
    clearBrowserSave: (slot) => m.clearLocalStorageSave(slot),
    exportJson: () => m.exportSnapshotJson(),
    importJson: (json) => m.importSnapshotJson(json),
    setActiveVerb: (verbId) => m.setActiveVerb(verbId),
    getActiveVerb: () => m.getActiveVerb(),
    clearActiveVerb: () => m.clearActiveVerb(),
  };
}

export function createBenneScriptInventoryNamespace(m: GameStateManager): BenneScriptInventoryNamespace {
  return {
    add: (id, quantity) => m.addInventory(id, quantity),
    remove: (id, quantity) => m.removeFromInventory(id, quantity),
    has: (id) => m.hasInInventory(id),
    quantityOf: (id) => m.quantityOf(id),
    get items() {
      return m.getInventoryItems();
    },
    clearInventory: () => m.clearInventory(),
  };
}
