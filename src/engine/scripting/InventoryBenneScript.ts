import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { BenneScriptCore, withNow } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import {
  globalInventoryOnInventoryItemEventId,
  roomInventoryOnInventoryItemEventId,
} from '../events/inventoryOnVerbEvents.js';
import { getRegisteredInventoryDefinitionIds } from '../inventory/inventoryDefinitionRegistry.js';
import type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  InventoryWhenGiveRegistrar,
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';

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
        targetId: string,
        handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForInventoryItemTarget(
          targetId,
          handler,
          options?.doNotClear === true,
        );
      },
      {
        doNotClear: (targetId: string, handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void)) => {
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
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
    doNotClear: boolean,
  ): void {
    if (targetId !== this.itemId) {
      this.warnInventoryOnWrongItem(targetId);
      return;
    }
    for (const sourceId of getRegisteredInventoryDefinitionIds()) {
      this.subscribeInventoryUsedOnTargetEvents(
        roomInventoryOnInventoryItemEventId(this.roomId, this.itemId, sourceId),
        globalInventoryOnInventoryItemEventId(this.itemId, sourceId),
        handler,
        doNotClear,
      );
    }
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

  whenVerb(verbId: string, handler: () => void): void;
  whenVerb(verbId: string, handler: (p: InventoryVerbInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    this.subscribeInventoryVerb(verbId, handler);
  }

  character(definitionId: string): BenneScriptCharacterFacade {
    return this.makeCharacterFacade(definitionId);
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacade();
  }

  private makeCharacterFacade(definitionId: string): BenneScriptCharacterFacade {
    const scene = this.roomScene;
    const B = this;

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      scene.faceCharacterScriptDirection(definitionId, direction);
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    const walkCharacterWithNow = withNow(
      (target: Point2 | string) => {
        B.chain(() => scene.walkCharacterTo(definitionId, target));
      },
      (target: Point2 | string) => {
        void scene.walkCharacterTo(definitionId, target);
      },
    );
    const moveToTeleport = withNow(
      (target: Point2 | string) => {
        B.chain(() => {
          scene.moveCharacterToNow(definitionId, target);
          return Promise.resolve();
        });
      },
      (target: Point2 | string) => {
        scene.moveCharacterToNow(definitionId, target);
      },
    );
    return {
      walkTo: walkCharacterWithNow,
      moveTo: moveToTeleport,
      moveToNow: (target: Point2 | string) => {
        moveToTeleport.now(target);
      },
      get animation() {
        return scene.getCharacterScriptEffectiveAnimationTag(definitionId);
      },
      set animation(tag: string | null) {
        B.chain(() => {
          scene.setCharacterScriptAnimationOverride(definitionId, tag);
          return Promise.resolve();
        });
      },
      animationNow(tag: string | null): void {
        scene.setCharacterScriptAnimationOverride(definitionId, tag);
      },
      playAnimation: withNow(
        (tag: string) => {
          B.chain(() => scene.playCharacterScriptAnimationOneShot(definitionId, tag));
        },
        (tag: string) => {
          void scene.playCharacterScriptAnimationOneShot(definitionId, tag);
        },
      ),
      stopAnimation(): void {
        scene.stopCharacterScriptAnimation(definitionId);
      },
      say: B.composeFixedCharacterSayHybrid(scene, definitionId, logCharacterSay),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          B.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    } as BenneScriptCharacterFacade;
  }

  private makePlayerFacade(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.roomScene);
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
