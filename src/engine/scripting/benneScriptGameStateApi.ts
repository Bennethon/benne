import type { BenneGameStateFlagValue } from '../../types/gameState.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import {
  inventoryCursorAnimationVariableKey,
  inventoryDefaultAnimationVariableKey,
  readEffectiveInventoryCursorAnimationTag,
  readEffectiveInventoryDefaultAnimationTag,
} from '../inventory/inventoryScriptingAnimations.js';
import type { BenneScriptInventoryItemFacade } from './benneScriptFacades.js';

/**
 * When provided to {@link createBenneScriptInventoryNamespace}, inventory item **`animation`** /
 * **`cursorAnimation`** setters enqueue on the owning script’s interaction tail (same ordering as
 * **`B.player.animation`**).
 */
export type BenneScriptInventoryInteractionQueue = (factory: () => Promise<unknown>) => void;

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
  /**
   * Active inventory item for use-on-target (see {@link GameStateManager.setActiveInventory}). Persisted in
   * save snapshots. Pass `null` to clear; empty strings are treated as `null`. (Maps to {@link GameStateManager.setActiveInventoryItem}.)
   */
  setActiveInventory(id: string | null): void;
  getActiveInventoryItemId(): string | null;
  clearActiveInventory(): void;
}

/**
 * `B.inventory` — quantities per item id (see `GameStateManager`), plus **`B.inventory(itemId)`** for per-item
 * animation fields (see {@link BenneScriptInventoryItemFacade}).
 */
export interface BenneScriptInventoryNamespace {
  (itemId: string): BenneScriptInventoryItemFacade;
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
    setActiveInventory: (id) => m.setActiveInventoryItem(id),
    getActiveInventoryItemId: () => m.getActiveInventoryItemId(),
    clearActiveInventory: () => m.clearActiveInventoryItem(),
  };
}

function createBenneScriptInventoryItemFacade(
  itemId: string,
  manager: GameStateManager,
  getRoomScene?: () => RoomScene | undefined,
  queueInteraction?: BenneScriptInventoryInteractionQueue,
): BenneScriptInventoryItemFacade {
  const applyDefault = (tag: string): void => {
    const scene = getRoomScene?.();
    if (scene) {
      scene.setInventoryScriptDefaultAnimationTag(itemId, tag);
      return;
    }
    const def = getInventoryDefinition(itemId);
    if (!def) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.inventory("${itemId}"): unknown item id.`);
      }
      return;
    }
    const t = tag.trim();
    if (t.length === 0) {
      manager.clearVariable(inventoryDefaultAnimationVariableKey(itemId));
      return;
    }
    manager.setVariable(inventoryDefaultAnimationVariableKey(itemId), t);
  };

  const applyCursor = (tag: string): void => {
    const scene = getRoomScene?.();
    if (scene) {
      scene.setInventoryScriptCursorAnimationTag(itemId, tag);
      return;
    }
    const def = getInventoryDefinition(itemId);
    if (!def) {
      if (import.meta.env.DEV) {
        console.warn(`[Benne] B.inventory("${itemId}"): unknown item id.`);
      }
      return;
    }
    const t = tag.trim();
    if (t.length === 0) {
      manager.clearVariable(inventoryCursorAnimationVariableKey(itemId));
      return;
    }
    manager.setVariable(inventoryCursorAnimationVariableKey(itemId), t);
  };

  const queueOrRun = (run: () => void): void => {
    if (queueInteraction) {
      queueInteraction(() => {
        run();
        return Promise.resolve();
      });
    } else {
      run();
    }
  };

  return {
    get animation() {
      const def = getInventoryDefinition(itemId);
      return def ? readEffectiveInventoryDefaultAnimationTag(manager, def) : '';
    },
    set animation(tag: string) {
      queueOrRun(() => applyDefault(tag));
    },
    animationNow(tag: string): void {
      applyDefault(tag);
    },
    get cursorAnimation() {
      const def = getInventoryDefinition(itemId);
      if (!def) {
        return '';
      }
      return readEffectiveInventoryCursorAnimationTag(manager, def) ?? '';
    },
    set cursorAnimation(tag: string) {
      queueOrRun(() => applyCursor(tag));
    },
    cursorAnimationNow(tag: string): void {
      applyCursor(tag);
    },
  };
}

export function createBenneScriptInventoryNamespace(
  m: GameStateManager,
  getRoomScene?: () => RoomScene | undefined,
  queueInteraction?: BenneScriptInventoryInteractionQueue,
): BenneScriptInventoryNamespace {
  const methods = {
    add: (id: string, quantity?: number) => m.addInventory(id, quantity),
    remove: (id: string, quantity?: number) => m.removeFromInventory(id, quantity),
    has: (id: string) => m.hasInInventory(id),
    quantityOf: (id: string) => m.quantityOf(id),
    get items() {
      return m.getInventoryItems();
    },
    clearInventory: () => m.clearInventory(),
  };
  const callable = (itemId: string) =>
    createBenneScriptInventoryItemFacade(itemId, m, getRoomScene, queueInteraction);
  return Object.assign(callable, methods) as BenneScriptInventoryNamespace;
}
