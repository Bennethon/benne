import * as Phaser from 'phaser';
import type { DialogId, GameVerbId, InventoryItemId } from '../../types/generated/benne-game-ids.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { BenneScriptCore } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import {
  globalInventoryOnInventoryRowEventId,
  roomInventoryOnInventoryRowEventId,
} from '../events/inventoryOnVerbEvents.js';
import type {
  BenneScriptDialogCommandSurface,
  BenneScriptPlayerFacade,
  InventoryWhenGiveRegistrar,
  InventoryWhenUsedOnPayloadHandler,
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';
import { createBenneScriptDialogAccessor } from './DialogBenneScript.js';

/**
 * Bennescript facade for `*.inventory.ts`: subscribes to room-scoped and global inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} precedence matches characters.
 *
 * The resolved **use** and **give** verbs on this row always arm this item for use-on-target after the interaction
 * queue drains, even with no {@link InventoryBenneScript.whenUse} / {@link InventoryBenneScript.whenGive} handlers.
 * Those helpers add behavior on top; **`doNotActivate`** opts out of arming for that verb (consumables, etc.).
 */
export class InventoryBenneScript extends BenneScriptCore {
  private static readonly unresolvedInventoryOnItemWarnings = new Set<string>();

  private readonly itemId: string;
  private readonly roomId: string;
  private readonly roomScene: RoomScene;

  private readonly inventoryUseHandlers: Array<{
    skipActivate: boolean;
    handler: InventoryWhenUseHandler;
  }> = [];
  private inventoryUseVerbSubscriptionInstalled = false;

  private readonly inventoryGiveHandlers: Array<{
    skipActivate: boolean;
    handler: InventoryWhenUseHandler;
  }> = [];
  private inventoryGiveVerbSubscriptionInstalled = false;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;
  readonly dialog: (dialogId: DialogId) => BenneScriptDialogCommandSurface;

  /**
   * Extra handlers for the resolved **use** verb; arming still happens unless every registered handler
   * used **`doNotActivate`** (see **`doNotActivate`**).
   */
  readonly whenUse: InventoryWhenUseRegistrar;

  /**
   * Extra handlers for the resolved **give** verb; same arming rules as {@link InventoryBenneScript.whenUse}.
   */
  readonly whenGive: InventoryWhenGiveRegistrar;

  /**
   * When this **item row** is the use-on-target (another inventory item is armed and the use verb
   * path applies), handle {@link import('../events/inventoryOnVerbEvents.js').InventoryUsedOnInventoryItemPayload} — same
   * `itemId` / `doNotClear` semantics as {@link import('./CharacterBenneScript.js').CharacterBenneScript.whenInventoryUsedOn}.
   */
  readonly whenInventoryUsedOn: RoomInventoryUsedOnRegistrar;

  constructor(events: Phaser.Events.EventEmitter, itemId: string, roomId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time, () => roomScene);
    this.itemId = itemId;
    this.roomId = roomId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager, () => this.roomScene, (factory) =>
      this.chain(factory),
    );
    this.dialog = createBenneScriptDialogAccessor(manager, roomScene.game, (factory) => this.chain(factory));
    const registerWhenUse = (skipActivate: boolean) => {
      return (handler: InventoryWhenUseHandler): void => {
        this.inventoryUseHandlers.push({ skipActivate, handler });
        this.ensureInventoryUseVerbSubscription();
      };
    };
    this.whenUse = Object.assign(registerWhenUse(false), {
      doNotActivate: registerWhenUse(true),
    });
    const registerWhenGive = (skipActivate: boolean) => {
      return (handler: InventoryWhenUseHandler): void => {
        this.inventoryGiveHandlers.push({ skipActivate, handler });
        this.ensureInventoryGiveVerbSubscription();
      };
    };
    this.whenGive = Object.assign(registerWhenGive(false), {
      doNotActivate: registerWhenGive(true),
    });
    this.whenInventoryUsedOn = Object.assign(
      (
        targetId: InventoryItemId,
        handler: InventoryWhenUsedOnPayloadHandler,
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForInventoryItemTarget(
          targetId,
          handler,
          options?.doNotClear === true,
        );
      },
      {
        doNotClear: (targetId: string, handler: InventoryWhenUsedOnPayloadHandler) => {
          this.registerInventoryUsedOnForInventoryItemTarget(targetId, handler, true);
        },
      },
    ) as RoomInventoryUsedOnRegistrar;
  }

  /**
   * Wires default **use** and **give**→{@link setActiveInventory} when the author’s `registerInventoryScript` body
   * did not register handlers (no-op inventory scripts). Safe to call after **`whenUse`** / **`whenGive`** —
   * installs at most one subscription per verb.
   */
  ensureDefaultInventoryUseAndGiveActivationAfterRegister(): void {
    this.ensureInventoryUseVerbSubscription();
    this.ensureInventoryGiveVerbSubscription();
  }

  private ensureInventoryUseVerbSubscription(): void {
    if (this.inventoryUseVerbSubscriptionInstalled) {
      return;
    }
    this.inventoryUseVerbSubscriptionInstalled = true;
    const verbId = this.resolveVerbId('use');
    const run = (payload: unknown): void => {
      const p = payload as InventoryVerbInteractPayload;
      for (const { handler } of this.inventoryUseHandlers) {
        if (handler.length === 0) {
          (handler as () => void)();
        } else {
          (handler as (x: InventoryVerbInteractPayload) => void)(p);
        }
      }
    };
    const afterTail = (): void => {
      const handlers = this.inventoryUseHandlers;
      const shouldActivate = handlers.length === 0 || handlers.some((h) => !h.skipActivate);
      if (shouldActivate) {
        this.setActiveInventory(this.itemId);
      }
    };
    this.subscribeAfterInteractionTail(
      roomInventoryVerbEventId(this.roomId, this.itemId, verbId),
      run,
      afterTail,
    );
    this.subscribeAfterInteractionTail(inventoryVerbEventId(this.itemId, verbId), run, afterTail);
  }

  private ensureInventoryGiveVerbSubscription(): void {
    if (this.inventoryGiveVerbSubscriptionInstalled) {
      return;
    }
    this.inventoryGiveVerbSubscriptionInstalled = true;
    const verbId = this.resolveVerbId('give');
    const run = (payload: unknown): void => {
      const p = payload as InventoryVerbInteractPayload;
      for (const { handler } of this.inventoryGiveHandlers) {
        if (handler.length === 0) {
          (handler as () => void)();
        } else {
          (handler as (x: InventoryVerbInteractPayload) => void)(p);
        }
      }
    };
    const afterTail = (): void => {
      const handlers = this.inventoryGiveHandlers;
      const shouldActivate = handlers.length === 0 || handlers.some((h) => !h.skipActivate);
      if (shouldActivate) {
        this.setActiveInventory(this.itemId);
      }
    };
    this.subscribeAfterInteractionTail(
      roomInventoryVerbEventId(this.roomId, this.itemId, verbId),
      run,
      afterTail,
    );
    this.subscribeAfterInteractionTail(inventoryVerbEventId(this.itemId, verbId), run, afterTail);
  }

  private warnInventoryOnWrongItem(targetId: string): void {
    const key = `${this.roomId}:${this.itemId}:${targetId}`;
    if (InventoryBenneScript.unresolvedInventoryOnItemWarnings.has(key)) {
      return;
    }
    InventoryBenneScript.unresolvedInventoryOnItemWarnings.add(key);
    console.warn(
      `[Benne] whenInventoryUsedOn("${targetId}") in inventory script "${this.itemId}" expects targetId === item id — handler was not registered.`,
    );
  }

  private registerInventoryUsedOnForInventoryItemTarget(
    targetId: string,
    handler: InventoryWhenUsedOnPayloadHandler,
    doNotClear: boolean,
  ): void {
    if (targetId !== this.itemId) {
      this.warnInventoryOnWrongItem(targetId);
      return;
    }
    this.subscribeInventoryUsedOnTargetEvents(
      roomInventoryOnInventoryRowEventId(this.roomId, this.itemId),
      globalInventoryOnInventoryRowEventId(this.itemId),
      handler,
      doNotClear,
    );
  }

  private subscribeInventoryVerb(
    verbId: string,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    const inner = (payload: unknown) => {
      const p = payload as InventoryVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: InventoryVerbInteractPayload) => void)(p);
      }
    };
    this.subscribe(roomInventoryVerbEventId(this.roomId, this.itemId, verbId), inner);
    this.subscribe(inventoryVerbEventId(this.itemId, verbId), inner);
  }

  whenLookAt(handler: () => void): void;
  whenLookAt(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenLookAt(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('look'), handler);
  }

  whenPickUp(handler: () => void): void;
  whenPickUp(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPickUp(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('pickUp'), handler);
  }

  whenPush(handler: () => void): void;
  whenPush(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPush(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('push'), handler);
  }

  whenPull(handler: () => void): void;
  whenPull(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenPull(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('pull'), handler);
  }

  whenOpen(handler: () => void): void;
  whenOpen(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenOpen(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('open'), handler);
  }

  whenClose(handler: () => void): void;
  whenClose(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenClose(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('close'), handler);
  }

  whenTalkTo(handler: () => void): void;
  whenTalkTo(handler: (p: InventoryVerbInteractPayload) => void): void;
  whenTalkTo(handler: ((p: InventoryVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeInventoryVerb(this.resolveVerbId('talkTo'), handler);
  }

  whenVerb(verbId: GameVerbId, handler: () => void): void;
  whenVerb(verbId: GameVerbId, handler: (p: InventoryVerbInteractPayload) => void): void;
  whenVerb(
    verbId: GameVerbId,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    this.subscribeInventoryVerb(verbId, handler);
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacade();
  }

  private makePlayerFacade(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.roomScene);
  }

}
