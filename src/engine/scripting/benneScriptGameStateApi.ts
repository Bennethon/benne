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
}

/** `B.inventory` — unique string item ids (see `GameStateManager`). */
export interface BenneScriptInventoryNamespace {
  addToInventory(itemId: string): boolean;
  hasInInventory(itemId: string): boolean;
  removeFromInventory(itemId: string): boolean;
  clearInventory(): void;
  items(): readonly string[];
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
  };
}

export function createBenneScriptInventoryNamespace(m: GameStateManager): BenneScriptInventoryNamespace {
  return {
    addToInventory: (itemId) => m.addToInventory(itemId),
    hasInInventory: (itemId) => m.hasInInventory(itemId),
    removeFromInventory: (itemId) => m.removeFromInventory(itemId),
    clearInventory: () => m.clearInventory(),
    items: () => m.getInventorySnapshot(),
  };
}
