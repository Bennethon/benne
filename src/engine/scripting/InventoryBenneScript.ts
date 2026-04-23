import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type { InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import { inventoryVerbEventId, roomInventoryVerbEventId } from '../events/inventoryVerbEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
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
  InventoryWhenUseHandler,
  InventoryWhenUseRegistrar,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';

/**
 * Bennescript facade for `*.inventory.ts`: subscribes to room-scoped and global inventory verb ids so
 * {@link import('../verbs/dispatchInventoryVerb.js').dispatchInventoryVerbInteraction} precedence matches characters.
 */
export class InventoryBenneScript extends BenneScriptCore {
  private static readonly unresolvedInventoryOnItemWarnings = new Set<string>();

  private readonly itemId: string;
  private readonly roomId: string;
  private readonly roomScene: RoomScene;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  /**
   * **`doNotActivate`** registers a use handler that does not call {@link setActiveInventory} for this item
   * after queued steps (default **`whenUse`** activates this item id for use-on-target).
   */
  readonly whenUse: InventoryWhenUseRegistrar;

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
    this.inventory = createBenneScriptInventoryNamespace(manager);
    const registerWhenUse = (skipActivate: boolean) => {
      return (handler: InventoryWhenUseHandler): void => {
        this.subscribeInventoryUseVerb(skipActivate, handler);
      };
    };
    this.whenUse = Object.assign(registerWhenUse(false), {
      doNotActivate: registerWhenUse(true),
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

  /**
   * Like {@link subscribeInventoryVerb} for the resolved **use** verb, then after the interaction queue drains
   * calls {@link setActiveInventory} with this item’s id unless `skipActivate` is true.
   */
  private subscribeInventoryUseVerb(
    skipActivate: boolean,
    handler: ((p: InventoryVerbInteractPayload) => void) | (() => void),
  ): void {
    const verbId = this.resolveVerbId('use');
    const inner = (payload: unknown) => {
      const p = payload as InventoryVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: InventoryVerbInteractPayload) => void)(p);
      }
    };
    const afterTail = (): void => {
      if (!skipActivate) {
        this.setActiveInventory(this.itemId);
      }
    };
    this.subscribeAfterInteractionTail(
      roomInventoryVerbEventId(this.roomId, this.itemId, verbId),
      inner,
      afterTail,
    );
    this.subscribeAfterInteractionTail(inventoryVerbEventId(this.itemId, verbId), inner, afterTail);
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

    const runCharacterPlayAnimation = (tag: string): void => {
      const sprite = scene.getCharacterSprite(definitionId);
      if (sprite instanceof Phaser.GameObjects.Sprite && sprite.anims) {
        if (scene.anims.exists(tag)) {
          sprite.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for character "${definitionId}"`);
        }
      }
    };

    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const sprite = scene.getCharacterSprite(definitionId) as DirectionalCharacterSprite | undefined;
      if (sprite?.anims) {
        playDirectionalAnimation(sprite, 'Idle', direction);
      }
    };

    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runCharacterPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runCharacterPlayAnimation,
      ),
      say: this.composeFixedCharacterSayHybrid(scene, definitionId, logCharacterSay),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
    };
  }

  private makePlayerFacade(): BenneScriptPlayerFacade {
    const scene = this.roomScene;

    const runPlayerPlayAnimation = (tag: string): void => {
      const pl = scene.player;
      if (pl?.anims) {
        if (scene.anims.exists(tag)) {
          pl.play(tag);
        } else {
          console.warn(`[Benne] Unknown animation tag "${tag}" for player`);
        }
      }
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const pl = scene.player;
      if (pl) {
        playDirectionalAnimation(pl, 'Idle', direction);
      }
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          void scene.walkPlayerTo(target);
        },
      ),
      walkToClicked: withNow(
        () => this.performWalkToClicked(true),
        () => this.performWalkToClicked(false),
      ),
      faceClicked: withNow(
        () => this.performFaceClicked(true),
        () => this.performFaceClicked(false),
      ),
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: this.composeFixedCharacterSayHybrid(scene, getStartingPlayerCharacterId(), logPlayerSay),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          this.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
    };
  }

  cutscene(callback: () => void): void {
    callback();
  }
}
