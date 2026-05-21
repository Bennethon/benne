import type { BenneGameStateFlagValue } from '../../types/gameState.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import {
  inventoryCursorAnimationVariableKey,
  inventoryDefaultAnimationVariableKey,
  readEffectiveInventoryCursorAnimationTag,
  readEffectiveInventoryDefaultAnimationTag,
} from '../inventory/inventoryScriptingAnimations.js';
import type { BenneScriptInventoryItemFacade } from './benneScriptFacades.js';
import { withNow, type BlockingWithNow } from './BenneScriptCore.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { runSnapshotFlushHooks } from '../gameState/snapshotFlushHooks.js';
import { SCENE_ROOM } from '../../game/constants.js';
import type { SaveMetadata } from '../../types/gameState.js';

/**
 * When provided to {@link createBenneScriptInventoryNamespace}, **`B.inventory.add` / `remove`**
 * (blocking form) and per-item **`animation`** / **`cursorAnimation`** setters enqueue on the owning
 * script’s interaction tail (same ordering as **`B.player.animation`**).
 */
export type BenneScriptInventoryInteractionQueue = (factory: () => Promise<unknown>) => void;
export type BenneScriptGameStateManagerResolver = () => GameStateManager | null | undefined;

type SyncWithNow<TArgs extends readonly unknown[], TResult> = ((
  ...args: TArgs
) => TResult) & { now: (...args: TArgs) => TResult };

function withNowResult<TArgs extends readonly unknown[], TResult>(
  impl: (...args: TArgs) => TResult,
): SyncWithNow<TArgs, TResult> {
  const fn = impl as SyncWithNow<TArgs, TResult>;
  fn.now = impl;
  return fn;
}

function resolveManagerOrWarn(
  resolveManager: BenneScriptGameStateManagerResolver,
  actionLabel: string,
): GameStateManager | null {
  const manager = resolveManager();
  if (manager) {
    return manager;
  }
  if (import.meta.env.DEV) {
    console.warn(`[Benne] B.state.${actionLabel}: game state manager is not active yet — ignored.`);
  }
  return null;
}

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
  getSaveList(): SaveMetadata[];
  save: SyncWithNow<[name: string, slot?: number], void>;
  load: SyncWithNow<[nameOrSlot: string | number], boolean>;
  deleteSave: SyncWithNow<[nameOrSlot: string | number], void>;
  renameSave: SyncWithNow<[oldName: string, newName: string], void>;
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
  /** See {@link import('../gameState/GameStateManager.js').GameStateManager.getCurrentRoom}. */
  getCurrentRoom(): string;
  getLastRoom(): string | null;
  setCurrentRoom(roomId: string): void;
  setLastRoom(roomId: string | null): void;
  /**
   * Read-only: `true` while a cutscene block is active on the current {@link RoomScene}
   * (any of: `B.cutscene(…)`, `whenEnterRoom`, `whenEnterAnyRoom`, `whenEnterRoomAfterFade`,
   * `whenEnterAnyRoomAfterFade`, or `whenChoice` handler). `false` outside a room or when
   * no cutscene is in progress.
   */
  readonly isCutsceneActive: boolean;
  /**
   * Pull live runtime state on the active room scene (currently: character feet world
   * positions and prop authoring positions) into the {@link GameStateManager} so the next
   * room load — or save snapshot — restores it. Most state (visibility, alpha, animation
   * overrides, flags, variables, inventory) is already eagerly persisted on every change;
   * `flush` exists for **lazily-saved** fields that aren't worth writing per-tick.
   *
   * Also runs automatically inside {@link GameStateManager.getSnapshot} (so
   * `B.state.save` / `exportJson` already pick everything up) and on room-transition
   * leave (see `RoomTransitionOrchestrator.prepareForLeave`). Call it directly only at custom
   * save points.
   */
  flush(): void;
}

/**
 * `B.inventory` — quantities per item id (see `GameStateManager`), plus **`B.inventory(itemId)`** for per-item
 * animation fields (see {@link BenneScriptInventoryItemFacade}).
 */
export interface BenneScriptInventoryNamespace {
  (itemId: string): BenneScriptInventoryItemFacade;
  /** Queues on the owning script interaction tail when wired with chain; `.now` applies immediately. */
  add: BlockingWithNow<[string, number?]>;
  remove: BlockingWithNow<[string, number?]>;
  has(id: string): boolean;
  quantityOf(id: string): number;
  /** Legacy accessor for inventory entries; prefer `add`/`remove`/`has`/`quantityOf` for gameplay logic. */
  readonly items: ReadonlyArray<{ id: string; quantity: number }>;
  clearInventory(): void;
}

function createBenneScriptGameStateNamespaceFromResolver(
  resolveManager: BenneScriptGameStateManagerResolver,
): BenneScriptGameStateNamespace {
  const withManagerVoid = (
    actionLabel: string,
    run: (manager: GameStateManager) => void,
  ): void => {
    const manager = resolveManagerOrWarn(resolveManager, actionLabel);
    if (!manager) {
      return;
    }
    run(manager);
  };
  const withManagerResult = <T>(
    actionLabel: string,
    fallback: T,
    run: (manager: GameStateManager) => T,
  ): T => {
    const manager = resolveManagerOrWarn(resolveManager, actionLabel);
    if (!manager) {
      return fallback;
    }
    return run(manager);
  };
  return {
    setFlag: (id, value) => withManagerVoid('setFlag', (m) => m.setFlag(id, value)),
    getFlag: (id) => withManagerResult('getFlag', undefined, (m) => m.getFlag(id)),
    hasFlag: (id) => withManagerResult('hasFlag', false, (m) => m.hasFlag(id)),
    clearFlag: (id) => withManagerVoid('clearFlag', (m) => m.clearFlag(id)),
    setVariable: (id, value) => withManagerVoid('setVariable', (m) => m.setVariable(id, value)),
    getVariable: (id) => withManagerResult('getVariable', undefined, (m) => m.getVariable(id)),
    hasVariable: (id) => withManagerResult('hasVariable', false, (m) => m.hasVariable(id)),
    clearVariable: (id) => withManagerVoid('clearVariable', (m) => m.clearVariable(id)),
    getSaveList: () => withManagerResult('getSaveList', [], (m) => m.getSaveList()),
    save: withNowResult((name: string, slot?: number): void => {
      withManagerVoid('save', (m) => m.save(name, slot));
    }),
    load: withNowResult((nameOrSlot: string | number): boolean => {
      return withManagerResult('load', false, (m) => {
        const loaded = m.load(nameOrSlot);
        if (!loaded) {
          return false;
        }
        const orch = tryGetRoomTransitionOrchestrator();
        if (!orch) {
          if (import.meta.env.DEV) {
            console.warn('[Benne] B.state.load: no room transition orchestrator — snapshot loaded only.');
          }
          return true;
        }
        void orch.transitionToLoadedRoom(false);
        return true;
      });
    }),
    deleteSave: withNowResult((nameOrSlot: string | number): void => {
      withManagerVoid('deleteSave', (m) => m.deleteSave(nameOrSlot));
    }),
    renameSave: withNowResult((oldName: string, newName: string): void => {
      withManagerVoid('renameSave', (m) => m.renameSave(oldName, newName));
    }),
    exportJson: () => withManagerResult('exportJson', '{}', (m) => m.exportSnapshotJson()),
    importJson: (json) => withManagerVoid('importJson', (m) => m.importSnapshotJson(json)),
    setActiveVerb: (verbId) => withManagerVoid('setActiveVerb', (m) => m.setActiveVerb(verbId)),
    getActiveVerb: () => withManagerResult('getActiveVerb', null, (m) => m.getActiveVerb()),
    clearActiveVerb: () => withManagerVoid('clearActiveVerb', (m) => m.clearActiveVerb()),
    setActiveInventory: (id) =>
      withManagerVoid('setActiveInventory', (m) => m.setActiveInventoryItem(id)),
    getActiveInventoryItemId: () =>
      withManagerResult('getActiveInventoryItemId', null, (m) => m.getActiveInventoryItemId()),
    clearActiveInventory: () =>
      withManagerVoid('clearActiveInventory', (m) => m.clearActiveInventoryItem()),
    getCurrentRoom: () => withManagerResult('getCurrentRoom', '', (m) => m.getCurrentRoom()),
    getLastRoom: () => withManagerResult('getLastRoom', null, (m) => m.getLastRoom()),
    setCurrentRoom: (roomId) => withManagerVoid('setCurrentRoom', (m) => m.setCurrentRoom(roomId)),
    setLastRoom: (roomId) => withManagerVoid('setLastRoom', (m) => m.setLastRoom(roomId)),
    get isCutsceneActive(): boolean {
      const game = tryGetActiveBenneGame();
      if (!game) {
        return false;
      }
      const scene = game.scene.getScene(SCENE_ROOM) as RoomScene | null;
      return scene?.isCutsceneActive() ?? false;
    },
    flush: () => runSnapshotFlushHooks(),
  };
}

export function createBenneScriptGameStateNamespace(m: GameStateManager): BenneScriptGameStateNamespace {
  return createBenneScriptGameStateNamespaceFromResolver(() => m);
}

export function createLazyBenneScriptGameStateNamespace(
  resolveManager: BenneScriptGameStateManagerResolver,
): BenneScriptGameStateNamespace {
  return createBenneScriptGameStateNamespaceFromResolver(resolveManager);
}

function createBenneScriptInventoryItemFacade(
  itemId: string,
  resolveManager: BenneScriptGameStateManagerResolver,
  getRoomScene?: () => RoomScene | undefined,
  queueInteraction?: BenneScriptInventoryInteractionQueue,
): BenneScriptInventoryItemFacade {
  const resolveInventoryManager = (): GameStateManager | null => {
    const manager = resolveManager();
    if (manager) {
      return manager;
    }
    if (import.meta.env.DEV) {
      console.warn(
        `[Benne] B.inventory("${itemId}"): game state manager is not active yet — ignored.`,
      );
    }
    return null;
  };
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
    const manager = resolveInventoryManager();
    if (!manager) {
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
    const manager = resolveInventoryManager();
    if (!manager) {
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
      const manager = resolveManager();
      if (!manager) {
        return getInventoryDefinition(itemId)?.defaultAnimation ?? '';
      }
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
      const manager = resolveManager();
      if (!manager) {
        return def.cursorAnimation?.trim() ?? '';
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
  return createBenneScriptInventoryNamespaceFromResolver(
    () => m,
    getRoomScene,
    queueInteraction,
  );
}

function createBenneScriptInventoryNamespaceFromResolver(
  resolveManager: BenneScriptGameStateManagerResolver,
  getRoomScene?: () => RoomScene | undefined,
  queueInteraction?: BenneScriptInventoryInteractionQueue,
): BenneScriptInventoryNamespace {
  const resolveInventoryManager = (actionLabel: string): GameStateManager | null => {
    const manager = resolveManager();
    if (manager) {
      return manager;
    }
    if (import.meta.env.DEV) {
      console.warn(`[Benne] B.inventory.${actionLabel}: game state manager is not active yet — ignored.`);
    }
    return null;
  };
  const queueOrRunSync = (run: () => void): void => {
    if (queueInteraction) {
      queueInteraction(() => {
        run();
        return Promise.resolve();
      });
    } else {
      run();
    }
  };

  const methods = {
    add: withNow(
      (id: string, quantity?: number) => {
        queueOrRunSync(() => {
          const manager = resolveInventoryManager('add');
          if (!manager) {
            return;
          }
          void manager.addInventory(id, quantity);
        });
      },
      (id: string, quantity?: number) => {
        const manager = resolveInventoryManager('add.now');
        if (!manager) {
          return;
        }
        void manager.addInventory(id, quantity);
      },
    ),
    remove: withNow(
      (id: string, quantity?: number) => {
        queueOrRunSync(() => {
          const manager = resolveInventoryManager('remove');
          if (!manager) {
            return;
          }
          void manager.removeFromInventory(id, quantity);
        });
      },
      (id: string, quantity?: number) => {
        const manager = resolveInventoryManager('remove.now');
        if (!manager) {
          return;
        }
        void manager.removeFromInventory(id, quantity);
      },
    ),
    has: (id: string) => {
      const manager = resolveInventoryManager('has');
      return manager ? manager.hasInInventory(id) : false;
    },
    quantityOf: (id: string) => {
      const manager = resolveInventoryManager('quantityOf');
      return manager ? manager.quantityOf(id) : 0;
    },
    get items() {
      const manager = resolveInventoryManager('items');
      return manager ? manager.getInventoryItems() : [];
    },
    clearInventory: () => {
      const manager = resolveInventoryManager('clearInventory');
      if (!manager) {
        return;
      }
      manager.clearInventory();
    },
  };
  const callable = (itemId: string) =>
    createBenneScriptInventoryItemFacade(itemId, resolveManager, getRoomScene, queueInteraction);
  return Object.assign(callable, methods) as BenneScriptInventoryNamespace;
}

export function createLazyBenneScriptInventoryNamespace(
  resolveManager: BenneScriptGameStateManagerResolver,
  getRoomScene?: () => RoomScene | undefined,
  queueInteraction?: BenneScriptInventoryInteractionQueue,
): BenneScriptInventoryNamespace {
  return createBenneScriptInventoryNamespaceFromResolver(resolveManager, getRoomScene, queueInteraction);
}
