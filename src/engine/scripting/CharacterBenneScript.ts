import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import type { CharacterVerbInteractPayload } from '../events/propInteractionEvents.js';
import { characterVerbEventId } from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation.js';
import {
  BenneScriptCore,
  withNow,
  type BenneScriptSayLineOptions,
} from './BenneScriptCore.js';
import type {
  BenneScriptCharacterFacade,
  BenneScriptPlayerFacade,
} from './benneScriptFacades.js';

/**
 * Bennescript facade for `*.character.ts`: self-only verb channels (`characterVerbEventId`) so
 * {@link import('../verbs/dispatchVerb.js').dispatchVerbInteraction} still prefers room-scoped handlers first.
 */
export class CharacterBenneScript extends BenneScriptCore {
  private readonly characterId: string;
  private readonly roomScene: RoomScene;

  constructor(events: Phaser.Events.EventEmitter, characterId: string, roomScene: RoomScene) {
    super(events, () => roomScene.time);
    this.characterId = characterId;
    this.roomScene = roomScene;
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
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logCharacterSay(line);
          this.queueSayDialogWithInputLock(scene, line, definitionId, false, options);
        },
      ),
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
      playAnimation: withNow(
        (tag: string) => {
          this.chain(() => {
            runPlayerPlayAnimation(tag);
            return Promise.resolve();
          });
        },
        runPlayerPlayAnimation,
      ),
      say: withNow(
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), false, options);
        },
      ),
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
