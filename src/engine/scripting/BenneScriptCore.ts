import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { getStartingPlayerCharacterId } from '../../game/constants.js';
import { computeDialogLineDurationMs, getDialogSettings, getGameSettings } from '../ConfigManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CharacterFacing,
} from '../directionalCharacterAnimation.js';
import { getEffectiveVerbDefinitions } from '../verbs/verbConfig.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import { shouldDropActiveInventoryOnUse } from '../verbs/dispatchInventoryOnVerbTarget.js';
import type { BenneScriptPlayerFacade } from './benneScriptFacades.js';

/**
 * Callable that participates in the interaction queue; **`fn.now`** runs the same action immediately
 * without blocking subsequent chained steps (fire-and-forget).
 */
export type BlockingWithNow<TArgs extends readonly unknown[] = readonly unknown[]> = ((
  ...args: TArgs
) => void) & { now: (...args: TArgs) => void };

export function withNow<TArgs extends readonly unknown[]>(
  blocking: (...args: TArgs) => void,
  nowImpl: (...args: TArgs) => void,
): BlockingWithNow<TArgs> {
  const fn = blocking as BlockingWithNow<TArgs>;
  fn.now = nowImpl;
  return fn;
}

/** Internal keys for {@link BenneScriptCore.resolveVerbId}. */
export type VerbAlias =
  | 'look'
  | 'use'
  | 'pickUp'
  | 'give'
  | 'talkTo'
  | 'push'
  | 'pull'
  | 'open'
  | 'close';

const VERB_ALIAS_CANDIDATES: Record<VerbAlias, readonly string[]> = {
  look: ['look', 'examine'],
  use: ['use', 'interact'],
  pickUp: ['pickUp', 'pickup', 'take'],
  give: ['give'],
  talkTo: ['talkTo', 'talk', 'speak'],
  push: ['push'],
  pull: ['pull'],
  open: ['open'],
  close: ['close'],
};

/** Optional flags for `say` / `.say.now` on character/player facades. */
export interface BenneScriptSayLineOptions {
  clickToSkip?: boolean;
}

export type BenneScriptSayArgs = [line: string, options?: BenneScriptSayLineOptions];

/**
 * Shared interaction queue, verb alias resolution, dialog line + input lock, and `wait` / `raw`
 * for room, character, global, and GUI Bennescript facades.
 */
export abstract class BenneScriptCore {
  private static unresolvedVerbWarnings = new Set<string>();
  private static warnedPlayerFacadeNoRoomScene = false;

  protected readonly events: Phaser.Events.EventEmitter;
  private disposers: Array<() => void> = [];
  private interactionTail: Promise<void> = Promise.resolve();
  private readonly getClock: () => Phaser.Time.Clock | null;

  /**
   * Pause the interaction chain for **`seconds`**. **`.wait.now`** schedules the delay only (does not block the queue).
   */
  readonly wait: BlockingWithNow<[number]>;

  readonly raw: {
    on: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    once: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    off: (event: string | symbol, fn?: (...args: unknown[]) => void, context?: unknown) => void;
    emit: (event: string | symbol, ...args: unknown[]) => boolean;
  };

  constructor(events: Phaser.Events.EventEmitter, getClock: () => Phaser.Time.Clock | null) {
    this.events = events;
    this.getClock = getClock;

    this.raw = {
      on: (event, fn, context) => this.events.on(event, fn as (...args: unknown[]) => void, context),
      once: (event, fn, context) => this.events.once(event, fn as (...args: unknown[]) => void, context),
      off: (event, fn, context) => this.events.off(event, fn as never, context),
      emit: (event, ...args) => this.events.emit(event, ...args),
    };

    this.wait = withNow(
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.chain(
          () =>
            new Promise<void>((resolve) => {
              const clock = this.getClock();
              if (!clock) {
                resolve();
                return;
              }
              clock.delayedCall(ms, () => resolve());
            }),
        );
      },
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.getClock()?.delayedCall(ms, () => {});
      },
    );
  }

  dispose(): void {
    for (const off of this.disposers) {
      off();
    }
    this.disposers = [];
  }

  /**
   * Set the runtime "active verb" (see {@link GameStateManager.setActiveVerb}). Available on every
   * Bennescript facade (room / character / global / inventory / GUI) via `B.setActiveVerb(...)`.
   * Pass `null` or an empty string to clear. Typical wiring: a verb GUI button calls
   * `B.setActiveVerb('open')` from its `whenButtonClick` handler.
   */
  setActiveVerb(verbId: string | null): void {
    const manager = tryGetActiveGameStateManager();
    if (!manager) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Benne] B.setActiveVerb called before the game was created — ignored.',
        );
      }
      return;
    }
    manager.setActiveVerb(verbId);
  }

  /** Current active verb id, or `null` when none is set. */
  getActiveVerb(): string | null {
    return tryGetActiveGameStateManager()?.getActiveVerb() ?? null;
  }

  /** Convenience for `setActiveVerb(null)`. */
  clearActiveVerb(): void {
    tryGetActiveGameStateManager()?.clearActiveVerb();
  }

  /**
   * Set the runtime active inventory item for use-on-target (see {@link GameStateManager.setActiveInventoryItem}).
   * Available on every Bennescript facade via `B.setActiveInventory(...)` and on `B.state`. Pass `null` or an
   * empty string to clear.
   */
  setActiveInventory(id: string | null): void {
    const manager = tryGetActiveGameStateManager();
    if (!manager) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Benne] B.setActiveInventory called before the game was created — ignored.',
        );
      }
      return;
    }
    manager.setActiveInventoryItem(id);
  }

  /** Current active inventory item id, or `null` when none is set. */
  getActiveInventoryItemId(): string | null {
    return tryGetActiveGameStateManager()?.getActiveInventoryItemId() ?? null;
  }

  /** Convenience for `setActiveInventory(null)`. */
  clearActiveInventory(): void {
    tryGetActiveGameStateManager()?.clearActiveInventoryItem();
  }

  private beginInteraction(): void {
    this.interactionTail = Promise.resolve();
  }

  private endInteraction(): Promise<void> {
    return this.interactionTail;
  }

  /**
   * Append async work to the interaction tail (lazy `factory` — see class docstring).
   * Subclasses (e.g. GUI Bennescript) use this for queued tweens.
   */
  protected chain(factory: () => Promise<unknown>): void {
    this.interactionTail = this.interactionTail.then(factory).then(() => undefined);
  }

  protected subscribe(eventId: string, run: (payload: unknown) => void): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        run(payload);
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Like {@link subscribe}, then invokes **`afterTail`** synchronously after the interaction queue drains.
   * Use for follow-ups that must run after queued `walkTo` / `say` steps from **`run`** (e.g. inventory use-on-target activation).
   */
  protected subscribeAfterInteractionTail(
    eventId: string,
    run: (payload: unknown) => void,
    afterTail: () => void,
  ): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        run(payload);
        await this.endInteraction();
        afterTail();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Subscribes to room + global inventory-on-target ids. After the handler’s queued steps, the
   * active inventory item is cleared according to the **drop policy**:
   *
   * - **`doNotClear: true`** — per-handler hard opt-out; never clear.
   * - Otherwise, consult {@link shouldDropActiveInventoryOnUse} for the payload's `itemId`
   *   (per-item **`dropWhenUsed`** → global **`dropWhenInventoryUsed`** → default **`false`**).
   *
   * Synchronous clearing of the **active verb** when it was consumed is handled by `RoomScene`
   * at dispatch time (also gated on the drop policy).
   */
  protected subscribeInventoryUsedOnTargetEvents(
    roomEventId: string,
    globalEventId: string,
    handler: ((p: AnyInventoryUsedOnPayload) => void) | (() => void),
    doNotClear: boolean,
  ): void {
    let lastPayload: AnyInventoryUsedOnPayload | null = null;
    const run = (payload: unknown): void => {
      const p = payload as AnyInventoryUsedOnPayload;
      lastPayload = p;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        (handler as (x: AnyInventoryUsedOnPayload) => void)(p);
      }
    };
    const afterTail = (): void => {
      if (doNotClear) {
        return;
      }
      const itemId = lastPayload?.itemId;
      if (itemId == null) {
        return;
      }
      if (shouldDropActiveInventoryOnUse(itemId)) {
        this.clearActiveInventory();
      }
    };
    this.subscribeAfterInteractionTail(roomEventId, run, afterTail);
    this.subscribeAfterInteractionTail(globalEventId, run, afterTail);
  }

  /**
   * Like {@link subscribe}, but the handler runs **synchronously** and never awaits the interaction tail.
   * Use for high-frequency events (e.g. GUI pointer hover) that must not serialize behind queued tweens.
   */
  protected subscribeImmediate(eventId: string, run: () => void): void {
    const fn = (): void => {
      try {
        run();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, fn);
    this.disposers.push(() => this.events.off(eventId, fn));
  }

  /**
   * Maps a Bennescript alias to the first matching `verbs[].id` from `game-config.json`.
   */
  protected resolveVerbId(alias: VerbAlias): string {
    const settings = getGameSettings();
    const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
    const candidates = VERB_ALIAS_CANDIDATES[alias];
    for (const id of candidates) {
      if (configured.has(id)) {
        return id;
      }
    }
    const warnKey = alias;
    if (!BenneScriptCore.unresolvedVerbWarnings.has(warnKey)) {
      BenneScriptCore.unresolvedVerbWarnings.add(warnKey);
      console.warn(
        `[Benne] No verb in game-config matches alias "${alias}" (tried: ${candidates.join(', ')}). ` +
          `Handlers register under id "${alias}". Add a matching verb to game-config.json.`,
      );
    }
    return alias;
  }

  protected applySayLineDirectionalBase(
    scene: RoomScene,
    characterDefinitionId: string,
    baseName: 'Talk' | 'Idle',
  ): void {
    const sprite = scene.getCharacterSprite(characterDefinitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
      return;
    }
    const facing: CharacterFacing =
      (sprite.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(sprite);
    playDirectionalAnimation(sprite, baseName, facing);
  }

  protected queueSayDialogWithInputLock(
    scene: RoomScene,
    line: string,
    talkCharacterDefinitionId: string,
    chain: boolean,
    options?: BenneScriptSayLineOptions,
  ): void {
    const ms = computeDialogLineDurationMs(line);
    const lineOpt = options?.clickToSkip;
    const allowClickToSkip =
      lineOpt === true || (lineOpt !== false && getDialogSettings().clickToSkip);

    const runLine = (resolve?: () => void): void => {
      let completed = false;
      let timer: Phaser.Time.TimerEvent | null = null;

      const finish = (): void => {
        if (completed) {
          return;
        }
        completed = true;
        timer?.remove(false);
        timer = null;
        scene.clearScriptedDialogClickToSkip();
        this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Idle');
        scene.setDialogTextOverlay({ visible: false });
        scene.popScriptedDialogInputSuppression();
        resolve?.();
      };

      scene.pushScriptedDialogInputSuppression();
      scene.setDialogTextOverlay({
        visible: true,
        text: line,
        talkCharacterDefinitionId,
      });
      this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Talk');

      timer = scene.time.delayedCall(ms, finish);

      if (allowClickToSkip) {
        scene.setScriptedDialogClickToSkip(() => {
          timer?.remove(false);
          timer = null;
          finish();
        });
      }
    };

    if (chain) {
      this.chain(() => new Promise<void>((resolve) => runLine(resolve)));
    } else {
      runLine();
    }
  }

  /**
   * Shared with {@link import('./GlobalBenneScript.js').GlobalBenneScript} so global handlers can use **`B.player.say`**
   * (resolves the room scene on each call).
   */
  protected makePlayerFacadeFromScene(resolveScene: () => RoomScene | null | undefined): BenneScriptPlayerFacade {
    const getScene = (): RoomScene | undefined => resolveScene() ?? undefined;

    const warnNoRoom = (): void => {
      if (import.meta.env.DEV && !BenneScriptCore.warnedPlayerFacadeNoRoomScene) {
        BenneScriptCore.warnedPlayerFacadeNoRoomScene = true;
        console.warn('[Benne] B.player used while RoomScene is not active — ignored.');
      }
    };

    const runPlayerPlayAnimation = (tag: string): void => {
      const scene = getScene();
      if (!scene) {
        return;
      }
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
      const scene = getScene();
      if (!scene) {
        return;
      }
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
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return;
          }
          this.chain(() => scene.walkPlayerTo(target));
        },
        (target: Point2 | string) => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return;
          }
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
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return;
          }
          logPlayerSay(line);
          this.queueSayDialogWithInputLock(scene, line, getStartingPlayerCharacterId(), true, options);
        },
        (line: string, options?: BenneScriptSayLineOptions) => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return;
          }
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
}
