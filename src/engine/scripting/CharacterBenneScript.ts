import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { CharacterVerbInteractPayload } from '../events/propInteractionEvents.js';
import { characterVerbEventId } from '../events/verbInteractionEvents.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { BenneScriptCore, withNow } from './BenneScriptCore.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import { getRegisteredInventoryDefinitionIds } from '../inventory/inventoryDefinitionRegistry.js';
import {
  globalInventoryOnCharacterEventId,
  roomInventoryOnCharacterEventId,
} from '../events/inventoryOnVerbEvents.js';
import type {
  AnyInventoryUsedOnPayload,
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
  RoomInventoryUsedOnRegistrar,
} from './benneScriptFacades.js';

/**
 * Bennescript facade for `*.character.ts`: self-only verb channels (`characterVerbEventId`) so
 * {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction} still prefers room-scoped handlers first.
 */
export class CharacterBenneScript extends BenneScriptCore {
  private static unresolvedInventoryOnCharacterWarnings = new Set<string>();

  private readonly characterId: string;
  private readonly roomId: string;
  private readonly roomScene: RoomScene;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  readonly whenInventoryUsedOn: RoomInventoryUsedOnRegistrar;

  constructor(events: Phaser.Events.EventEmitter, characterId: string, roomId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time, () => roomScene);
    this.characterId = characterId;
    this.roomId = roomId;
    this.roomScene = roomScene;
    const manager = resolveGameStateManager(roomScene.game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(manager);
    this.whenInventoryUsedOn = Object.assign(
      (
        targetId: string,
        handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
        options?: { doNotClear?: boolean },
      ) => {
        this.registerInventoryUsedOnForCharacterTarget(targetId, handler, options?.doNotClear === true);
      },
      {
        doNotClear: (targetId: string, handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void)) => {
          this.registerInventoryUsedOnForCharacterTarget(targetId, handler, true);
        },
      },
    ) as RoomInventoryUsedOnRegistrar;
  }

  private warnInventoryOnWrongCharacter(targetId: string): void {
    const key = `${this.roomId}:${this.characterId}:${targetId}`;
    if (CharacterBenneScript.unresolvedInventoryOnCharacterWarnings.has(key)) {
      return;
    }
    CharacterBenneScript.unresolvedInventoryOnCharacterWarnings.add(key);
    console.warn(
      `[Benne] whenInventoryUsedOn("${targetId}") in character script "${this.characterId}" expects targetId === character id — handler was not registered.`,
    );
  }

  private registerInventoryUsedOnForCharacterTarget(
    targetId: string,
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
    doNotClear: boolean,
  ): void {
    if (targetId !== this.characterId) {
      this.warnInventoryOnWrongCharacter(targetId);
      return;
    }
    for (const itemId of getRegisteredInventoryDefinitionIds()) {
      this.subscribeInventoryUsedOnTargetEvents(
        roomInventoryOnCharacterEventId(this.roomId, this.characterId, itemId),
        globalInventoryOnCharacterEventId(this.characterId, itemId),
        handler,
        doNotClear,
      );
    }
  }

  private subscribeSelfVerb(
    verbId: string,
    handler: ((p: CharacterVerbInteractPayload) => void) | (() => void),
  ): void {
    const eventId = characterVerbEventId(this.characterId, verbId);
    this.subscribe(eventId, (payload) => {
      const p = payload as CharacterVerbInteractPayload;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: CharacterVerbInteractPayload) => void)(p);
      }
    });
  }

  whenLookAt(handler: () => void): void;
  whenLookAt(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenLookAt(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('look'), handler);
  }

  whenUse(handler: () => void): void;
  whenUse(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenUse(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('use'), handler);
  }

  whenPickUp(handler: () => void): void;
  whenPickUp(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPickUp(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('pickUp'), handler);
  }

  whenPush(handler: () => void): void;
  whenPush(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPush(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('push'), handler);
  }

  whenPull(handler: () => void): void;
  whenPull(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenPull(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('pull'), handler);
  }

  whenOpen(handler: () => void): void;
  whenOpen(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenOpen(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('open'), handler);
  }

  whenClose(handler: () => void): void;
  whenClose(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenClose(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('close'), handler);
  }

  whenTalkTo(handler: () => void): void;
  whenTalkTo(handler: (p: CharacterVerbInteractPayload) => void): void;
  whenTalkTo(handler: ((p: CharacterVerbInteractPayload) => void) | (() => void)): void {
    this.subscribeSelfVerb(this.resolveVerbId('talkTo'), handler);
  }

  whenVerb(verbId: string, handler: () => void): void;
  whenVerb(verbId: string, handler: (p: CharacterVerbInteractPayload) => void): void;
  whenVerb(
    verbId: string,
    handler: ((p: CharacterVerbInteractPayload) => void) | (() => void),
  ): void {
    this.subscribeSelfVerb(verbId, handler);
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

    return {
      walkTo: withNow(
        (target: Point2 | string) => {
          B.chain(() => scene.walkCharacterTo(definitionId, target));
        },
        (target: Point2 | string) => {
          void scene.walkCharacterTo(definitionId, target);
        },
      ),
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
